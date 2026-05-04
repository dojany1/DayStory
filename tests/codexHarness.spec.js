import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { HarnessError, createCodexHarness, parseArgs } from '../scripts/codex-harness.mjs';

const tempRoots = [];

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function makeProject({ withAgents = true, steps } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'codex-harness-'));
  tempRoots.push(root);

  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'phases', '0-mvp'), { recursive: true });

  if (withAgents) {
    writeFileSync(join(root, 'AGENTS.md'), '# Codex Rules\n\nUse TDD first.\n', 'utf8');
  }
  writeFileSync(join(root, 'CLAUDE.md'), '# Project Rules\n\nKeep services isolated.\n', 'utf8');
  writeFileSync(join(root, 'docs', 'ARCHITECTURE.md'), '# Architecture\n\nService layer only.\n', 'utf8');
  writeJson(join(root, 'phases', 'index.json'), {
    phases: [{ dir: '0-mvp', status: 'pending' }],
  });
  writeJson(join(root, 'phases', '0-mvp', 'index.json'), {
    project: 'DayStory',
    phase: '0-mvp',
    steps: steps || [
      { step: 0, name: 'setup', status: 'pending' },
    ],
  });
  writeFileSync(join(root, 'phases', '0-mvp', 'step0.md'), '# Step 0: setup\n\nDo the setup.\n', 'utf8');
  writeFileSync(join(root, 'phases', '0-mvp', 'step1.md'), '# Step 1: ui\n\nDo the UI.\n', 'utf8');

  return root;
}

function makeHarness(root, {
  dirty = false,
  codexAvailable = true,
  claudeAvailable = false,
  onCodexExec,
  onClaudeExec,
} = {}) {
  const calls = [];
  let worktreeDirty = dirty;
  const runCommand = (command, args, options = {}) => {
    calls.push({ command, args, options });

    if (command === 'codex' && args[0] === '--version') {
      return codexAvailable
        ? { status: 0, stdout: 'codex-cli 0.126.0-alpha.8\n', stderr: '' }
        : { status: 1, stdout: '', stderr: 'codex missing' };
    }

    if (command === 'claude' && args[0] === '--version') {
      return claudeAvailable
        ? { status: 0, stdout: '1.0.0\n', stderr: '' }
        : { status: 1, stdout: '', stderr: 'claude missing' };
    }

    if (command === 'codex' && args[0] === 'exec') {
      return onCodexExec?.({ args, options }) || { status: 0, stdout: '', stderr: '' };
    }

    if (command === 'claude' && args[0] === '-p') {
      return onClaudeExec?.({ args, options }) || { status: 0, stdout: '', stderr: '' };
    }

    if (command === 'git' && args.join(' ') === 'status --short') {
      return { status: 0, stdout: worktreeDirty ? ' M src/main.js\n' : '', stderr: '' };
    }

    if (command === 'git' && args.join(' ') === 'rev-parse --abbrev-ref HEAD') {
      return { status: 0, stdout: 'main\n', stderr: '' };
    }

    if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--verify') {
      return { status: 1, stdout: '', stderr: '' };
    }

    if (command === 'git' && args[0] === 'commit') {
      worktreeDirty = false;
      return { status: 0, stdout: '', stderr: '' };
    }

    if (command === 'git' && args.join(' ') === 'diff --cached --quiet') {
      return { status: worktreeDirty ? 1 : 0, stdout: '', stderr: '' };
    }

    if (command === 'git') {
      return { status: 0, stdout: '', stderr: '' };
    }

    return { status: 1, stdout: '', stderr: `Unexpected command: ${command} ${args.join(' ')}` };
  };

  return {
    calls,
    harness: createCodexHarness({
      rootDir: root,
      runCommand,
      now: () => new Date('2026-04-29T01:02:03+09:00'),
      log: () => {},
    }),
  };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('Codex harness runner', () => {
  it('Given no AGENTS.md, when validating the project, then it should fail with a clear Codex setup error', () => {
    const root = makeProject({ withAgents: false });
    const { harness } = makeHarness(root);

    expect(() => harness.run('0-mvp')).toThrow(HarnessError);
    expect(() => harness.run('0-mvp')).toThrow('AGENTS.md not found');
  });

  it('Given a dirty worktree, when running a phase, then it should stop before branch checkout', () => {
    const root = makeProject();
    const { calls, harness } = makeHarness(root, { dirty: true });

    expect(() => harness.run('0-mvp')).toThrow('worktree is not clean');
    expect(calls.some((call) => call.command === 'git' && call.args[0] === 'checkout')).toBe(false);
  });

  it('Given a pending step, when Codex completes it, then the runner should call codex exec with repo context and mark timestamps', () => {
    const root = makeProject();
    const { calls, harness } = makeHarness(root, {
      onCodexExec: ({ options }) => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[0].status = 'completed';
        index.steps[0].summary = 'setup files added';
        writeJson(indexPath, index);
        expect(options.input).toContain('# Codex Rules');
        expect(options.input).toContain('# Project Rules');
        expect(options.input).toContain('# Architecture');
        expect(options.input).toContain('# Step 0: setup');
        return { status: 0, stdout: 'done', stderr: '' };
      },
    });

    harness.run('0-mvp');

    const codexCall = calls.find((call) => call.command === 'codex' && call.args[0] === 'exec');
    expect(codexCall.args).toEqual([
      'exec',
      '--cd',
      root,
      '--sandbox',
      'danger-full-access',
      '--ask-for-approval',
      'never',
      '-',
    ]);

    const index = readJson(join(root, 'phases', '0-mvp', 'index.json'));
    expect(index.created_at).toBe('2026-04-29T01:02:03+0900');
    expect(index.completed_at).toBe('2026-04-29T01:02:03+0900');
    expect(index.steps[0].started_at).toBe('2026-04-29T01:02:03+0900');
    expect(index.steps[0].completed_at).toBe('2026-04-29T01:02:03+0900');
    expect(existsSync(join(root, 'phases', '0-mvp', 'step0-output.json'))).toBe(true);
  });

  it('Given auto mode without a phase argument, when a pending phase exists, then it should discover and run that phase', () => {
    const root = makeProject();
    const { harness } = makeHarness(root, {
      onCodexExec: () => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[0].status = 'completed';
        index.steps[0].summary = 'auto phase completed';
        writeJson(indexPath, index);
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    harness.run(undefined, { auto: true });

    const index = readJson(join(root, 'phases', '0-mvp', 'index.json'));
    expect(index.steps[0].completed_at).toBe('2026-04-29T01:02:03+0900');
  });

  it('Given auto mode and a dirty worktree, when preparing the run, then it should create a snapshot commit before checkout', () => {
    const root = makeProject();
    const { calls, harness } = makeHarness(root, {
      dirty: true,
      onCodexExec: () => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[0].status = 'completed';
        index.steps[0].summary = 'completed after snapshot';
        writeJson(indexPath, index);
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    harness.run(undefined, { auto: true, prepareWorktree: true });

    const commitCall = calls.find((call) => call.command === 'git' && call.args[0] === 'commit');
    const checkoutCall = calls.find((call) => call.command === 'git' && call.args[0] === 'checkout');
    expect(commitCall.args).toContain('chore(harness): snapshot worktree before 0-mvp');
    expect(calls.indexOf(commitCall)).toBeLessThan(calls.indexOf(checkoutCall));
  });

  it('Given auto mode and an unlisted empty phase folder, when preparing folders, then it should remove only that safe empty folder', () => {
    const root = makeProject();
    mkdirSync(join(root, 'phases', 'stale-empty'));
    mkdirSync(join(root, 'phases', '0-mvp', 'nested-empty'));
    const { harness } = makeHarness(root, {
      onCodexExec: () => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[0].status = 'completed';
        index.steps[0].summary = 'completed with cleanup';
        writeJson(indexPath, index);
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    harness.run(undefined, { auto: true, cleanupFolders: true });

    expect(existsSync(join(root, 'phases', 'stale-empty'))).toBe(false);
    expect(existsSync(join(root, 'phases', '0-mvp'))).toBe(true);
    expect(existsSync(join(root, 'phases', '0-mvp', 'nested-empty'))).toBe(true);
  });

  it('Given Codex is unavailable and Claude is available, when agent is auto, then it should invoke Claude with the same prompt context', () => {
    const root = makeProject();
    const { calls, harness } = makeHarness(root, {
      codexAvailable: false,
      claudeAvailable: true,
      onClaudeExec: ({ args }) => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[0].status = 'completed';
        index.steps[0].summary = 'claude completed';
        writeJson(indexPath, index);
        expect(args.at(-1)).toContain('# Codex Rules');
        expect(args.at(-1)).toContain('# Step 0: setup');
        return { status: 0, stdout: '{"result":"done"}', stderr: '' };
      },
    });

    harness.run('0-mvp', { agent: 'auto' });

    const claudeCall = calls.find((call) => call.command === 'claude' && call.args[0] === '-p');
    expect(claudeCall.args.slice(0, 4)).toEqual(['-p', '--dangerously-skip-permissions', '--output-format', 'json']);
  });

  it('Given previous completed steps, when building the next prompt, then it should include their summaries', () => {
    const root = makeProject({
      steps: [
        { step: 0, name: 'setup', status: 'completed', summary: 'created service shell' },
        { step: 1, name: 'ui', status: 'pending' },
      ],
    });
    const { harness } = makeHarness(root, {
      onCodexExec: ({ options }) => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[1].status = 'completed';
        index.steps[1].summary = 'ui wired';
        writeJson(indexPath, index);
        expect(options.input).toContain('created service shell');
        expect(options.input).toContain('# Step 1: ui');
        return { status: 0, stdout: 'done', stderr: '' };
      },
    });

    harness.run('0-mvp');
  });

  it('Given a step that does not update status, when running it, then the runner should retry three times and mark error', () => {
    const root = makeProject();
    const { calls, harness } = makeHarness(root);

    expect(() => harness.run('0-mvp')).toThrow('failed after 3 attempts');

    const codexCalls = calls.filter((call) => call.command === 'codex' && call.args[0] === 'exec');
    const index = readJson(join(root, 'phases', '0-mvp', 'index.json'));
    const topIndex = readJson(join(root, 'phases', 'index.json'));
    expect(codexCalls).toHaveLength(3);
    expect(index.steps[0].status).toBe('error');
    expect(index.steps[0].failed_at).toBe('2026-04-29T01:02:03+0900');
    expect(index.steps[0].error_message).toContain('Step did not update status');
    expect(topIndex.phases[0].status).toBe('error');
  });

  it('Given Codex marks a step blocked, when running it, then the runner should stamp blocked metadata and stop', () => {
    const root = makeProject();
    const { harness } = makeHarness(root, {
      onCodexExec: () => {
        const indexPath = join(root, 'phases', '0-mvp', 'index.json');
        const index = readJson(indexPath);
        index.steps[0].status = 'blocked';
        index.steps[0].blocked_reason = 'Firebase API key required';
        writeJson(indexPath, index);
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    expect(() => harness.run('0-mvp')).toThrow('blocked');

    const index = readJson(join(root, 'phases', '0-mvp', 'index.json'));
    const topIndex = readJson(join(root, 'phases', 'index.json'));
    expect(index.steps[0].blocked_at).toBe('2026-04-29T01:02:03+0900');
    expect(topIndex.phases[0].status).toBe('blocked');
  });

  it('Given CLI arguments, when parsing help and push usage, then it should support the documented commands', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['0-mvp', '--push', '--agent', 'claude'])).toEqual({
      phaseDir: '0-mvp',
      push: true,
      help: false,
      auto: false,
      prepareWorktree: false,
      cleanupFolders: false,
      agent: 'claude',
    });
    expect(parseArgs(['--auto', '--prepare-worktree', '--cleanup-folders'])).toMatchObject({
      auto: true,
      prepareWorktree: true,
      cleanupFolders: true,
      agent: 'auto',
    });
  });

  it('Given agent instruction files, when inspected, then they should make conversation-triggered harness execution automatic', () => {
    const agents = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8');
    const claude = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8');

    for (const content of [agents, claude]) {
      expect(content).toContain('Conversation Autopilot');
      expect(content).toContain('npm run harness:auto');
      expect(content).toContain('do not wait for the user to type a command');
      expect(content).toContain('check for a pending harness phase first');
      expect(content).toContain('If no pending phase exists, continue with the user request normally');
    }
  });
});
