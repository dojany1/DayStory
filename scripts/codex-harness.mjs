#!/usr/bin/env node
// DayStory Harness Orchestrator
//
// 동작 방식:
//   Claude Code가 이 스크립트를 Bash 도구로 실행 → stdout으로 step 지시사항 출력
//   → Claude가 출력을 읽고 직접 step을 처리 (외부 CLI 불필요)
//
// npm run harness:auto        → 다음 pending phase 자동 실행
// npm run harness -- <phase>  → 특정 phase 수동 실행
// npm run harness:status      → 현재 phase 상태만 출력 (dry-run)
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PHASES_DIR = join(ROOT, 'phases');
const GUARD = 'DAYSTORY_HARNESS_ACTIVE';

if (process.env[GUARD]) {
  console.error('[harness] 재귀 실행 감지 — 중단');
  process.exit(1);
}

const [, , arg] = process.argv;

if (arg === '--status') {
  printStatus();
} else if (arg) {
  runPhase(arg);
} else {
  runAuto();
}

// ── 자동 실행 ─────────────────────────────────────────────────────────────────
function runAuto() {
  snapshotDirtyWorktree();
  pruneEmptyUnlisted();
  const phase = findNextPending();
  if (!phase) {
    console.log('[harness] pending phase 없음 — 모든 작업 완료');
    process.exit(0);
  }
  runPhase(phase);
}

// ── 상태 출력 (dry-run) ───────────────────────────────────────────────────────
function printStatus() {
  if (!existsSync(PHASES_DIR)) {
    console.log('[harness] phases/ 폴더 없음');
    process.exit(0);
  }
  const dirs = readdirSync(PHASES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();

  for (const name of dirs) {
    const idx = join(PHASES_DIR, name, 'index.json');
    if (!existsSync(idx)) continue;
    const m = loadIndex(idx);
    const icon = { pending: '⏳', in_progress: '🔄', completed: '✅', error: '❌', blocked: '🚫' }[m.status] ?? '?';
    console.log(`${icon} ${name} (step ${m.current_step}/${m.steps.length}) — ${m.title}`);
  }
  process.exit(0);
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
    .filter(e => e.isDirectory()).map(e => e.name).sort();
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
  const resultFile = join(phaseDir, `step${stepN}.result.json`);

  // result.json이 이미 있으면 merge만 하고 종료 (재시작 내성)
  if (existsSync(resultFile)) {
    console.log(`[harness] step${stepN}.result.json 이미 존재 — merge 처리`);
    mergeResult(idxPath, meta, stepN, resultFile);
    createCodeCommit(phaseName, stepN, meta);
    createMetaCommit(phaseName, stepN);
    return;
  }

  // in_progress로 상태 업데이트
  saveIndex(idxPath, { ...meta, status: 'in_progress', updated_at: now() });

  // ── Claude에게 step 지시사항을 stdout으로 출력 ──────────────────────────────
  // Claude Code가 이 출력을 읽고 직접 step을 처리한다.
  // 처리 완료 후 Claude는 result.json을 작성하고 `npm run harness:commit -- <phase> <stepN>`을 실행한다.
  console.log(buildInstructions(phaseName, stepN, stepContent, meta));
}

// ── Claude에게 전달할 지시사항 출력 ──────────────────────────────────────────
function buildInstructions(phaseName, stepN, stepContent, meta) {
  const resultPath = `phases/${phaseName}/step${stepN}.result.json`;
  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║  HARNESS: phases/${phaseName}/step${stepN}`,
    `║  ${meta.title}`,
    `╚══════════════════════════════════════════════════════════════╝`,
    ``,
    `## 작업 시작 전 필독 (이 순서대로)`,
    `1. CLAUDE.md — 프로젝트 규칙 및 아키텍처 제약`,
    `2. README.md — 전체 그림 + mermaid 다이어그램`,
    `3. SESSION_LOG.md — 최근 작업 이력 (맨 아래부터 역순으로 읽어 현재 상태 파악)`,
    `4. (필요 시) docs/_archive/ARCHITECTURE.md, docs/_archive/CODE_MAP.md — 깊이 들어갈 때만`,
    `5. phases/${phaseName}/index.json — 현재 phase 메타데이터`,
    ``,
    `## 지시사항`,
    stepContent,
    ``,
    `## 완료 후 필수 작업 (이 순서대로)`,
    `1. 아래 스키마로 \`${resultPath}\` 파일을 작성한다:`,
    `   \`\`\`json`,
    `   { "status": "completed", "summary": "한 줄 요약", "error_message": null, "blocked_reason": null }`,
    `   \`\`\``,
    `   실패 시: { "status": "error", "summary": null, "error_message": "이유", "blocked_reason": null }`,
    `   차단 시: { "status": "blocked", "summary": null, "error_message": null, "blocked_reason": "이유" }`,
    ``,
    `2. \`npm run harness:commit -- ${phaseName} ${stepN}\` 을 실행해 index.json 업데이트와 커밋을 완료한다.`,
    ``,
    `3. SESSION_LOG.md 맨 아래에 세션 항목을 추가한다 (CLAUDE.md 규칙 준수).`,
    ``,
    `⚠️  \`npm run harness:auto\` 를 재귀 호출하지 말 것 — 환경변수 ${GUARD}=1 이 설정되어 있다.`,
  ];
  return lines.join('\n');
}

// ── 커밋 단계 (Claude가 result.json 작성 후 호출) ─────────────────────────────
// npm run harness:commit -- <phaseName> <stepN>
export function commitStep(phaseName, stepN) {
  const phaseDir = join(PHASES_DIR, phaseName);
  const idxPath = join(phaseDir, 'index.json');
  const resultFile = join(phaseDir, `step${stepN}.result.json`);
  const meta = loadIndex(idxPath);

  mergeResult(idxPath, meta, stepN, resultFile);
  createCodeCommit(phaseName, stepN, meta);
  createMetaCommit(phaseName, stepN);
}

// commitStep은 별도 스크립트에서 호출되므로 CLI 진입점은 harness:commit 스크립트가 담당

// ── index.json 관리 ────────────────────────────────────────────────────────────
function loadIndex(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function saveIndex(p, meta) { writeFileSync(p, JSON.stringify(meta, null, 2) + '\n'); }

function mergeResult(idxPath, meta, stepN, resultFile) {
  let result;
  try { result = JSON.parse(readFileSync(resultFile, 'utf8')); }
  catch { result = { status: 'error', summary: null, error_message: 'result.json 파싱 실패', blocked_reason: null }; }

  meta.steps[stepN - 1] = {
    ...meta.steps[stepN - 1],
    status: result.status,
    summary: result.summary ?? null,
    error_message: result.error_message ?? null,
    blocked_reason: result.blocked_reason ?? null,
  };

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
  console.log(`[harness] step${stepN} → ${result.status}: ${result.summary ?? result.error_message ?? result.blocked_reason}`);
}

// ── 커밋 전략 ─────────────────────────────────────────────────────────────────
function createCodeCommit(phaseName, stepN, meta) {
  const dirty = git('status --porcelain').trim();
  if (!dirty) return;
  git('add -A');
  try { git(`restore --staged "${PHASES_DIR}"`); } catch { /* ignore */ }
  const staged = git('diff --cached --name-only').trim();
  if (!staged) return;
  const title = meta.title ?? phaseName;
  git(`commit -m "feat: ${phaseName} step${stepN} — ${title}"`);
  console.log(`[harness] code commit 완료`);
}

function createMetaCommit(phaseName, stepN) {
  try { git(`add "${PHASES_DIR}"`); } catch { return; }
  const staged = git('diff --cached --name-only').trim();
  if (!staged) return;
  git(`commit -m "chore: harness meta phases/${phaseName}/step${stepN}"`);
  console.log(`[harness] meta commit 완료`);
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function git(args) { return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }); }
function now() { return new Date().toISOString(); }
