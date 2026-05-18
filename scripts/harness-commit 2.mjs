#!/usr/bin/env node
// npm run harness:commit -- <phaseName> <stepN>
// Claude가 step을 완료한 뒤 result.json을 작성하고 이 스크립트를 호출한다.
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PHASES_DIR = join(ROOT, 'phases');

const [, , phaseName, stepNStr] = process.argv;

if (!phaseName || !stepNStr) {
  console.error('사용법: npm run harness:commit -- <phaseName> <stepN>');
  process.exit(1);
}

const stepN = parseInt(stepNStr, 10);
const phaseDir = join(PHASES_DIR, phaseName);
const idxPath = join(phaseDir, 'index.json');
const resultFile = join(phaseDir, `step${stepN}.result.json`);

if (!existsSync(idxPath)) {
  console.error(`[harness] index.json 없음: phases/${phaseName}`);
  process.exit(1);
}
if (!existsSync(resultFile)) {
  console.error(`[harness] result.json 없음: phases/${phaseName}/step${stepN}.result.json`);
  console.error('Claude가 먼저 result.json을 작성해야 합니다.');
  process.exit(1);
}

const meta = JSON.parse(readFileSync(idxPath, 'utf8'));

// result.json merge → index.json 업데이트
let result;
try { result = JSON.parse(readFileSync(resultFile, 'utf8')); }
catch {
  console.error('[harness] result.json 파싱 실패');
  process.exit(1);
}

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

meta.updated_at = new Date().toISOString();
writeFileSync(idxPath, JSON.stringify(meta, null, 2) + '\n');
console.log(`[harness] step${stepN} → ${result.status}: ${result.summary ?? result.error_message ?? result.blocked_reason}`);

// 코드 커밋 (phases/ 제외)
const git = args => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' });

const dirty = git('status --porcelain').trim();
if (dirty) {
  git('add -A');
  try { git(`restore --staged "${PHASES_DIR}"`); } catch { /* ignore */ }
  const staged = git('diff --cached --name-only').trim();
  if (staged) {
    const title = meta.title ?? phaseName;
    git(`commit -m "feat: ${phaseName} step${stepN} — ${title}"`);
    console.log('[harness] code commit 완료');
  }
}

// 메타 커밋 (phases/ only)
try { git(`add "${PHASES_DIR}"`); } catch { /* ignore */ }
const metaStaged = git('diff --cached --name-only').trim();
if (metaStaged) {
  git(`commit -m "chore: harness meta phases/${phaseName}/step${stepN}"`);
  console.log('[harness] meta commit 완료');
}

// 다음 pending phase 확인
if (meta.status === 'completed') {
  console.log(`\n✅ phase ${phaseName} 완료`);
  console.log('다음 세션에 "알아서 해줘"를 입력하면 다음 phase가 자동 시작됩니다.');
} else if (meta.status === 'in_progress') {
  console.log(`\n▶️  다음 step: phases/${phaseName}/step${meta.current_step}.md`);
  console.log('"계속해줘"를 입력하면 다음 step이 자동 시작됩니다.');
}
