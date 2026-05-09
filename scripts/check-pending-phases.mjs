#!/usr/bin/env node
// 세션 시작 시 pending harness phase를 감지해 Claude context에 주입한다.
// exit(2) → Claude Code Notification hook이 메시지를 context에 삽입
// exit(0) → 무음 통과
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PHASES_DIR = join(ROOT, 'phases');

if (!existsSync(PHASES_DIR)) process.exit(0);

const pending = [];
for (const entry of readdirSync(PHASES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const indexPath = join(PHASES_DIR, entry.name, 'index.json');
  if (!existsSync(indexPath)) continue;
  let meta;
  try { meta = JSON.parse(readFileSync(indexPath, 'utf8')); } catch { continue; }
  if (meta.status === 'pending' || meta.status === 'in_progress') {
    pending.push(`${entry.name}/step${meta.current_step} (${meta.title ?? ''})`);
  }
}

if (pending.length > 0) {
  console.log(`[harness] Pending phases detected: ${pending.join(', ')}. Autopilot will run harness:auto.`);
  process.exit(2);
}

process.exit(0);
