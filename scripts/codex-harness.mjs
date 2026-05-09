#!/usr/bin/env node
// DayStory Harness Orchestrator
// npm run harness:auto  → 다음 pending phase 자동 실행
// npm run harness -- <phase-dir>  → 특정 phase 수동 실행
import { execSync, spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PHASES_DIR = join(ROOT, 'phases');
const GUARD = 'DAYSTORY_HARNESS_ACTIVE';

// ── 재귀 실행 방지 ────────────────────────────────────────────────────────────
if (process.env[GUARD]) {
  console.error('[harness] 재귀 실행 감지 — 중단');
  process.exit(1);
}

const [, , manualPhase] = process.argv;
if (manualPhase) {
  runPhase(manualPhase);
} else {
  runAuto();
}

// ── 자동 실행 ─────────────────────────────────────────────────────────────────
function runAuto() {
  snapshotDirtyWorktree();
  pruneEmptyUnlisted();
  const phase = findNextPending();
  if (!phase) {
    console.log('[harness] pending phase 없음 — 종료');
    process.exit(0);
  }
  runPhase(phase);
}

// ── Dirty worktree 스냅샷 커밋 ────────────────────────────────────────────────
function snapshotDirtyWorktree() {
  const dirty = git('status --porcelain').trim();
  if (!dirty) return;
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  git('add -A');
  git(`commit -m "chore: harness snapshot ${ts}" --allow-empty`);
  console.log(`[harness] snapshot commit 완료`);
}

// ── index.json 없는 빈 폴더 정리 ─────────────────────────────────────────────
function pruneEmptyUnlisted() {
  if (!existsSync(PHASES_DIR)) return;
  for (const e of readdirSync(PHASES_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = join(PHASES_DIR, e.name);
    const hasIndex = existsSync(join(dir, 'index.json'));
    const isEmpty = readdirSync(dir).length === 0;
    if (!hasIndex && isEmpty) {
      git(`rm -r --force "${dir}"`);
      console.log(`[harness] 빈 폴더 제거: ${e.name}`);
    }
  }
}

// ── 다음 pending phase 탐색 ───────────────────────────────────────────────────
function findNextPending() {
  if (!existsSync(PHASES_DIR)) return null;
  const dirs = readdirSync(PHASES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
  for (const name of dirs) {
    const idx = join(PHASES_DIR, name, 'index.json');
    if (!existsSync(idx)) continue;
    const m = loadIndex(idx);
    if (m.status === 'pending' || m.status === 'in_progress') return name;
  }
  return null;
}

// ── Phase 실행 ────────────────────────────────────────────────────────────────
function runPhase(phaseName) {
  const phaseDir = join(PHASES_DIR, phaseName);
  const idxPath = join(phaseDir, 'index.json');

  if (!existsSync(idxPath)) {
    console.error(`[harness] index.json 없음: phases/${phaseName}`);
    process.exit(1);
  }

  const meta = loadIndex(idxPath);
  if (meta.phase !== phaseName) {
    console.error(`[harness] phase 필드 불일치: "${meta.phase}" ≠ "${phaseName}"`);
    process.exit(1);
  }

  const stepN = meta.current_step;
  const stepFile = join(phaseDir, `step${stepN}.md`);
  if (!existsSync(stepFile)) {
    console.error(`[harness] step${stepN}.md 없음: phases/${phaseName}`);
    process.exit(1);
  }

  const stepContent = readFileSync(stepFile, 'utf8');
  const agent = chooseAgent(meta.agent ?? 'auto');
  if (!agent) { process.exit(1); }

  console.log(`[harness] phases/${phaseName}/step${stepN}.md → ${agent}`);
  saveIndex(idxPath, { ...meta, status: 'in_progress', updated_at: now() });

  const promptFile = join(phaseDir, '_harness_prompt.tmp.md');
  const resultFile = join(phaseDir, `step${stepN}.result.json`);

  // result.json이 이미 존재하면 에이전트 재호출 없이 바로 merge (재시작 내성)
  if (!existsSync(resultFile)) {
    writeFileSync(promptFile, buildPrompt(phaseName, stepN, stepContent), 'utf8');
    const ok = invokeAgent(agent, promptFile, phaseDir);
    try { unlinkSync(promptFile); } catch { /* ignore */ }

    if (!ok) {
      writeFileSync(resultFile, JSON.stringify({
        status: 'error',
        summary: null,
        error_message: `${agent} 프로세스가 비정상 종료됨`,
        blocked_reason: null,
      }, null, 2));
    }
  } else {
    console.log(`[harness] step${stepN}.result.json 이미 존재 — 에이전트 호출 건너뜀`);
  }

  mergeResult(idxPath, meta, stepN, resultFile);
  createCodeCommit(phaseName, stepN, meta);
  createMetaCommit(phaseName, stepN);
}

// ── 에이전트 선택 ──────────────────────────────────────────────────────────────
function chooseAgent(pref) {
  const hasCodex = isAiCodex();
  const hasClaude = isCli('claude');

  const pick = (want, fallback, fallbackName) => {
    if (want) return want === 'codex' ? (hasCodex ? 'codex' : (hasClaude ? 'claude' : null))
                                      : (hasClaude ? 'claude' : (hasCodex ? 'codex' : null));
    return fallback ? fallbackName : null;
  };

  if (pref === 'codex') {
    if (hasCodex) return 'codex';
    console.warn('[harness] codex 없음 → claude fallback');
    return hasClaude ? 'claude' : (console.error('[harness] claude도 없음'), null);
  }
  if (pref === 'claude') {
    if (hasClaude) return 'claude';
    console.warn('[harness] claude 없음 → codex fallback');
    return hasCodex ? 'codex' : (console.error('[harness] codex도 없음'), null);
  }
  // auto: codex 우선 (AGENTS.md 네이티브 지원)
  if (hasCodex) return 'codex';
  if (hasClaude) return 'claude';
  console.error('[harness] codex / claude CLI 모두 없음');
  return null;
}

function isAiCodex() {
  if (!isCli('codex')) return false;
  try {
    const out = execSync('codex --version 2>&1', { encoding: 'utf8', timeout: 5000 }).trim();
    // 정적 사이트 생성기 codex는 버전 출력에 'render', 'build', 'watch' 포함
    return /^\d+\.\d+/.test(out) && !/render|build|watch/i.test(out);
  } catch { return false; }
}

function isCli(cmd) {
  try {
    execSync(
      process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`,
      { stdio: 'ignore', timeout: 3000 }
    );
    return true;
  } catch { return false; }
}

// ── 프롬프트 빌드 ─────────────────────────────────────────────────────────────
function buildPrompt(phaseName, stepN, stepContent) {
  return [
    `You are executing harness step ${stepN} of phase "${phaseName}" for the DayStory project.`,
    ``,
    `Read AGENTS.md and CLAUDE.md before doing any work.`,
    `Current phase metadata: phases/${phaseName}/index.json`,
    ``,
    `=== STEP INSTRUCTIONS ===`,
    stepContent,
    `=== END STEP INSTRUCTIONS ===`,
    ``,
    `After completing (or failing) this step:`,
    `1. Write phases/${phaseName}/step${stepN}.result.json with this exact schema:`,
    `   { "status": "completed"|"error"|"blocked", "summary": "...", "error_message": null, "blocked_reason": null }`,
    `2. Append one entry to docs/SESSION_LOG.md as required by AGENTS.md / CLAUDE.md.`,
    `3. Do NOT commit. Do NOT run npm run harness:auto recursively.`,
    ``,
    `Environment variable ${GUARD}=1 is set. Do not re-invoke the harness.`,
  ].join('\n');
}

// ── 에이전트 호출 ──────────────────────────────────────────────────────────────
function invokeAgent(agent, promptFile, cwd) {
  const env = { ...process.env, [GUARD]: '1' };
  const TIMEOUT = 30 * 60 * 1000; // 30분

  let result;
  if (agent === 'codex') {
    // OpenAI Codex CLI: codex --file <prompt> --no-interactive
    result = spawnSync('codex', ['--file', promptFile, '--no-interactive'], {
      cwd, env, stdio: 'inherit', timeout: TIMEOUT,
    });
  } else {
    // Claude CLI: claude --print --no-interactive @<prompt-file>
    result = spawnSync('claude', ['--print', '--no-interactive', `@${promptFile}`], {
      cwd, env, stdio: 'inherit', timeout: TIMEOUT,
    });
  }
  return result.status === 0;
}

// ── index.json 관리 ────────────────────────────────────────────────────────────
function loadIndex(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function saveIndex(p, meta) { writeFileSync(p, JSON.stringify(meta, null, 2) + '\n'); }

function mergeResult(idxPath, meta, stepN, resultFile) {
  let result;
  if (!existsSync(resultFile)) {
    console.warn('[harness] result.json 없음 → error 처리');
    result = { status: 'error', summary: null, error_message: 'Agent가 result 파일을 생성하지 않음', blocked_reason: null };
  } else {
    try { result = JSON.parse(readFileSync(resultFile, 'utf8')); }
    catch { result = { status: 'error', summary: null, error_message: 'result.json 파싱 실패', blocked_reason: null }; }
  }

  meta.steps[stepN - 1] = {
    ...meta.steps[stepN - 1],
    status: result.status,
    summary: result.summary ?? null,
    error_message: result.error_message ?? null,
    blocked_reason: result.blocked_reason ?? null,
  };

  // 상태 롤업
  const all = meta.steps;
  if (all.every(s => s.status === 'completed')) {
    meta.status = 'completed';
  } else if (all.some(s => s.status === 'error')) {
    meta.status = 'error';
  } else if (all.some(s => s.status === 'blocked')) {
    meta.status = 'blocked';
  } else {
    const nextIdx = all.findIndex(s => s.status === 'pending');
    if (nextIdx !== -1) { meta.current_step = nextIdx + 1; meta.status = 'in_progress'; }
    else { meta.status = 'completed'; }
  }

  meta.updated_at = now();
  saveIndex(idxPath, meta);
  console.log(`[harness] step${stepN} → ${result.status}: ${result.summary ?? result.error_message}`);
}

// ── 커밋 전략 ─────────────────────────────────────────────────────────────────
function createCodeCommit(phaseName, stepN, meta) {
  const dirty = git('status --porcelain').trim();
  if (!dirty) return;
  git('add -A');
  // phases/ 디렉터리는 meta commit으로 분리
  try { git(`restore --staged "${PHASES_DIR}"`); } catch { /* phases/ 없으면 무시 */ }
  const codeChanges = git('status --porcelain').trim();
  if (!codeChanges) return;
  const title = meta.title ?? phaseName;
  git(`commit -m "feat: ${phaseName} step${stepN} — ${title}"`);
  console.log(`[harness] code commit 완료`);
}

function createMetaCommit(phaseName, stepN) {
  try { git(`add "${PHASES_DIR}"`); } catch { return; }
  const staged = git('status --porcelain').trim();
  if (!staged) return;
  git(`commit -m "chore: harness meta phases/${phaseName}/step${stepN}"`);
  console.log(`[harness] meta commit 완료`);
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' });
}

function now() { return new Date().toISOString(); }
