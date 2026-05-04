#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MAX_RETRIES = 3;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export class HarnessError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'HarnessError';
    this.exitCode = exitCode;
  }
}

function runSpawn(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    shell: false,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatKstTimestamp(date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return [
    kst.getUTCFullYear(),
    '-',
    pad(kst.getUTCMonth() + 1),
    '-',
    pad(kst.getUTCDate()),
    'T',
    pad(kst.getUTCHours()),
    ':',
    pad(kst.getUTCMinutes()),
    ':',
    pad(kst.getUTCSeconds()),
    '+0900',
  ].join('');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function toGitPath(...parts) {
  return parts.join('/');
}

export function parseArgs(argv) {
  const parsed = {
    phaseDir: undefined,
    push: false,
    help: false,
    auto: false,
    prepareWorktree: false,
    cleanupFolders: false,
    agent: 'auto',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--push') {
      parsed.push = true;
    } else if (arg === '--auto') {
      parsed.auto = true;
    } else if (arg === '--prepare-worktree') {
      parsed.prepareWorktree = true;
    } else if (arg === '--cleanup-folders') {
      parsed.cleanupFolders = true;
    } else if (arg === '--agent') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new HarnessError('--agent requires one of: auto, codex, claude');
      }
      parsed.agent = value;
      i += 1;
    } else if (arg.startsWith('--agent=')) {
      parsed.agent = arg.slice('--agent='.length);
    } else if (arg.startsWith('-')) {
      throw new HarnessError(`Unknown option: ${arg}`);
    } else if (!parsed.phaseDir) {
      parsed.phaseDir = arg;
    } else {
      throw new HarnessError(`Unexpected argument: ${arg}`);
    }
  }

  if (!['auto', 'codex', 'claude'].includes(parsed.agent)) {
    throw new HarnessError('--agent must be one of: auto, codex, claude');
  }

  return parsed;
}

export function formatHelp() {
  return [
    'Codex Harness Runner',
    '',
    'Usage:',
    '  npm run harness -- <phase-dir>',
    '  npm run harness -- <phase-dir> --push',
    '  npm run harness:auto',
    '',
    'Examples:',
    '  npm run harness -- 0-mvp',
    '  npm run harness -- 0-mvp --push',
    '  npm run harness:auto',
  ].join('\n');
}

class CodexHarness {
  constructor({
    rootDir = process.cwd(),
    runCommand = runSpawn,
    now = () => new Date(),
    log = console.log,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = {}) {
    this.rootDir = resolve(rootDir);
    this.runCommand = runCommand;
    this.now = now;
    this.log = log;
    this.maxRetries = maxRetries;
  }

  run(phaseDirName, {
    push = false,
    auto = false,
    prepareWorktree = false,
    cleanupFolders = false,
    agent = 'auto',
  } = {}) {
    this.phasesDir = join(this.rootDir, 'phases');
    this.topIndexPath = join(this.phasesDir, 'index.json');

    if (cleanupFolders) {
      this.cleanupHarnessFolders();
    }

    const selectedPhaseDir = phaseDirName || (auto ? this.discoverNextPhase() : undefined);

    if (!selectedPhaseDir && auto) {
      this.log('No pending harness phase found.');
      return { status: 'noop' };
    }

    if (!phaseDirName) {
      if (!selectedPhaseDir) {
        throw new HarnessError('Missing phase directory. Usage: npm run harness -- <phase-dir>');
      }
    }

    this.phaseDirName = selectedPhaseDir;
    this.phaseDir = join(this.phasesDir, selectedPhaseDir);
    this.indexPath = join(this.phaseDir, 'index.json');

    this.agent = this.detectAgent(agent);
    this.ensureProjectFiles();
    if (prepareWorktree) {
      this.prepareWorktree();
    } else {
      this.assertCleanWorktree();
    }

    this.index = readJson(this.indexPath);
    this.project = this.index.project || 'project';
    this.phaseName = this.index.phase || phaseDirName;
    this.totalSteps = this.index.steps.length;

    this.assertRunnablePhase();
    this.checkoutBranch();
    const guardrails = this.loadGuardrails();
    this.ensureCreatedAt();
    this.executeAllSteps(guardrails);
    this.finalize(push);
    return { status: 'completed', phase: this.phaseDirName, agent: this.agent };
  }

  stamp() {
    return formatKstTimestamp(this.now());
  }

  checkAgentCommand(command) {
    const result = this.runCommand(command, ['--version'], { cwd: this.rootDir });
    return result.status === 0;
  }

  detectAgent(requestedAgent) {
    if (!['auto', 'codex', 'claude'].includes(requestedAgent)) {
      throw new HarnessError('agent must be one of: auto, codex, claude');
    }

    const candidates = requestedAgent === 'auto' ? ['codex', 'claude'] : [requestedAgent];
    for (const candidate of candidates) {
      if (this.checkAgentCommand(candidate)) {
        return candidate;
      }
    }

    throw new HarnessError(
      requestedAgent === 'auto'
        ? 'No supported agent CLI is available. Install Codex or Claude CLI.'
        : `${requestedAgent} CLI is not available.`,
    );
  }

  ensureCodexCli() {
    const result = this.runCommand('codex', ['--version'], { cwd: this.rootDir });
    if (result.status !== 0) {
      const detail = result.error?.message || result.stderr || 'codex command failed';
      throw new HarnessError(`codex CLI is not available: ${detail}`);
    }
  }

  discoverNextPhase() {
    if (!existsSync(this.topIndexPath)) {
      return undefined;
    }

    const topIndex = readJson(this.topIndexPath);
    return topIndex.phases?.find((phase) => phase.status === 'pending')?.dir;
  }

  cleanupHarnessFolders() {
    if (!existsSync(this.phasesDir)) {
      return;
    }

    let protectedDirs = new Set();
    if (existsSync(this.topIndexPath)) {
      const topIndex = readJson(this.topIndexPath);
      protectedDirs = new Set((topIndex.phases || []).map((phase) => phase.dir));
    }

    const entries = readdirSync(this.phasesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || protectedDirs.has(entry.name)) {
        continue;
      }

      const absolutePath = join(this.phasesDir, entry.name);
      if (readdirSync(absolutePath).length === 0) {
        rmSync(absolutePath, { recursive: true, force: true });
      }
    }
  }

  ensureProjectFiles() {
    const requiredFiles = [
      ['AGENTS.md', 'AGENTS.md not found. Codex reads project rules from the repository root AGENTS.md.'],
      ['phases/index.json', 'phases/index.json not found. Create the harness top-level index first.'],
      [toGitPath('phases', this.phaseDirName, 'index.json'), `phases/${this.phaseDirName}/index.json not found.`],
    ];

    for (const [relativePath, message] of requiredFiles) {
      if (!existsSync(join(this.rootDir, relativePath))) {
        throw new HarnessError(message);
      }
    }
  }

  assertCleanWorktree() {
    const result = this.git(['status', '--short']);
    if (result.stdout.trim()) {
      throw new HarnessError(
        `git worktree is not clean. Commit or stash changes before running harness.\n${result.stdout.trim()}`,
      );
    }
  }

  prepareWorktree() {
    const status = this.git(['status', '--short']).stdout.trim();
    if (!status) {
      return;
    }

    this.git(['add', '-A']);
    if (this.git(['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0) {
      this.git(['commit', '-m', `chore(harness): snapshot worktree before ${this.phaseDirName}`]);
    }

    const after = this.git(['status', '--short']).stdout.trim();
    if (after) {
      throw new HarnessError(`git worktree is still dirty after snapshot commit.\n${after}`);
    }
  }

  assertRunnablePhase() {
    if (!Array.isArray(this.index.steps)) {
      throw new HarnessError(`${this.indexPath} must contain a steps array.`);
    }

    for (const step of this.index.steps) {
      if (step.status === 'error') {
        throw new HarnessError(
          `Step ${step.step} (${step.name}) is in error state: ${step.error_message || 'unknown error'}`,
        );
      }
      if (step.status === 'blocked') {
        throw new HarnessError(
          `Step ${step.step} (${step.name}) is blocked: ${step.blocked_reason || 'unknown reason'}`,
          2,
        );
      }

      const stepPath = join(this.phaseDir, `step${step.step}.md`);
      if (!existsSync(stepPath)) {
        throw new HarnessError(`${stepPath} not found.`);
      }
    }
  }

  git(args, { allowFailure = false } = {}) {
    const result = this.runCommand('git', args, { cwd: this.rootDir });
    if (!allowFailure && result.status !== 0) {
      throw new HarnessError(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
    return result;
  }

  checkoutBranch() {
    const branch = `feat-${this.phaseName}`;
    const current = this.git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
    if (current === branch) {
      return;
    }

    const exists = this.git(['rev-parse', '--verify', branch], { allowFailure: true });
    const result = exists.status === 0
      ? this.git(['checkout', branch], { allowFailure: true })
      : this.git(['checkout', '-b', branch], { allowFailure: true });

    if (result.status !== 0) {
      throw new HarnessError(`Failed to checkout ${branch}: ${result.stderr || result.stdout}`);
    }
  }

  loadGuardrails() {
    const sections = [];
    const agentsPath = join(this.rootDir, 'AGENTS.md');
    const claudePath = join(this.rootDir, 'CLAUDE.md');
    const docsPath = join(this.rootDir, 'docs');

    sections.push(`## Codex Rules (AGENTS.md)\n\n${readFileSync(agentsPath, 'utf8')}`);

    if (existsSync(claudePath)) {
      sections.push(`## Project Rules (CLAUDE.md)\n\n${readFileSync(claudePath, 'utf8')}`);
    }

    if (existsSync(docsPath)) {
      const docs = readdirSync(docsPath)
        .filter((name) => name.endsWith('.md'))
        .sort();

      for (const name of docs) {
        const docPath = join(docsPath, name);
        sections.push(`## docs/${name}\n\n${readFileSync(docPath, 'utf8')}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }

  buildStepContext(index) {
    const completed = index.steps.filter((step) => step.status === 'completed' && step.summary);
    if (completed.length === 0) {
      return '';
    }

    const summaries = completed
      .map((step) => `- Step ${step.step} (${step.name}): ${step.summary}`)
      .join('\n');

    return `## Previous Step Context\n\n${summaries}\n\n---\n\n`;
  }

  buildPreamble(guardrails, stepContext, previousError = '') {
    const retrySection = previousError
      ? `## Previous Attempt Failed\n\n${previousError}\n\n---\n\n`
      : '';

    return [
      `You are working on the ${this.project} project through the agent harness.`,
      '',
      guardrails,
      '',
      '---',
      '',
      stepContext,
      retrySection,
      '## Harness Execution Rules',
      '',
      `1. Perform only the current step from /phases/${this.phaseDirName}/stepN.md.`,
      '2. Follow strict TDD: add or update failing tests first, then implement the minimum code to pass.',
      '3. Run the Acceptance Criteria commands listed in the step file.',
      `4. Update /phases/${this.phaseDirName}/index.json for the current step:`,
      '   - success: status "completed" and a one-line "summary"',
      '   - cannot finish after reasonable fixes: status "error" and "error_message"',
      '   - user input or external setup required: status "blocked" and "blocked_reason"',
      '5. Do not commit. The harness runner creates the code and metadata commits after this session returns.',
      '',
      '---',
      '',
    ].join('\n');
  }

  ensureCreatedAt() {
    const index = readJson(this.indexPath);
    if (!index.created_at) {
      index.created_at = this.stamp();
      writeJson(this.indexPath, index);
    }
  }

  executeAllSteps(guardrails) {
    while (true) {
      const index = readJson(this.indexPath);
      const pending = index.steps.find((step) => step.status === 'pending');

      if (!pending) {
        return;
      }

      if (!pending.started_at) {
        pending.started_at = this.stamp();
        writeJson(this.indexPath, index);
      }

      this.executeSingleStep(pending, guardrails);
    }
  }

  executeSingleStep(step, guardrails) {
    let previousError = '';

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      const index = readJson(this.indexPath);
      const stepContext = this.buildStepContext(index);
      const preamble = this.buildPreamble(guardrails, stepContext, previousError);
      const output = this.invokeAgent(step, preamble);
      const updated = readJson(this.indexPath);
      const current = updated.steps.find((item) => item.step === step.step);
      const status = current?.status || 'pending';

      if (status === 'completed') {
        current.completed_at = this.stamp();
        writeJson(this.indexPath, updated);
        this.commitStep(step.step, step.name);
        return;
      }

      if (status === 'blocked') {
        current.blocked_at = this.stamp();
        writeJson(this.indexPath, updated);
        this.updateTopIndex('blocked');
        throw new HarnessError(`Step ${step.step} (${step.name}) blocked: ${current.blocked_reason || 'unknown reason'}`, 2);
      }

      const codexError = [output.stderr, output.stdout].filter(Boolean).join('\n').trim();
      const errorMessage = current?.error_message || codexError || 'Step did not update status';

      if (attempt < this.maxRetries) {
        current.status = 'pending';
        delete current.error_message;
        writeJson(this.indexPath, updated);
        previousError = errorMessage;
      } else {
        current.status = 'error';
        current.error_message = `[${this.maxRetries} attempts failed] ${errorMessage}`;
        current.failed_at = this.stamp();
        writeJson(this.indexPath, updated);
        this.updateTopIndex('error');
        this.commitStep(step.step, step.name);
        throw new HarnessError(`Step ${step.step} (${step.name}) failed after ${this.maxRetries} attempts: ${errorMessage}`);
      }
    }
  }

  invokeAgent(step, preamble) {
    const stepPath = join(this.phaseDir, `step${step.step}.md`);
    const prompt = `${preamble}${readFileSync(stepPath, 'utf8')}`;
    const [command, args, options] = this.agent === 'claude'
      ? [
        'claude',
        ['-p', '--dangerously-skip-permissions', '--output-format', 'json', prompt],
        { cwd: this.rootDir },
      ]
      : [
        'codex',
        [
        'exec',
        '--cd',
        this.rootDir,
        '--sandbox',
        'danger-full-access',
        '--ask-for-approval',
        'never',
        '-',
        ],
        { cwd: this.rootDir, input: prompt },
      ];

    const result = this.runCommand(command, args, options);

    const output = {
      step: step.step,
      name: step.name,
      agent: this.agent,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
    writeJson(join(this.phaseDir, `step${step.step}-output.json`), output);
    return output;
  }

  commitStep(stepNum, stepName) {
    const outputRel = toGitPath('phases', this.phaseDirName, `step${stepNum}-output.json`);
    const indexRel = toGitPath('phases', this.phaseDirName, 'index.json');
    const topIndexRel = toGitPath('phases', 'index.json');

    this.git(['add', '-A']);
    this.git(['reset', 'HEAD', '--', outputRel, indexRel, topIndexRel], { allowFailure: true });

    if (this.git(['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0) {
      this.git(['commit', '-m', `feat(${this.phaseName}): step ${stepNum} - ${stepName}`]);
    }

    this.git(['add', '-A']);
    if (this.git(['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0) {
      this.git(['commit', '-m', `chore(${this.phaseName}): step ${stepNum} harness metadata`]);
    }
  }

  updateTopIndex(status) {
    if (!existsSync(this.topIndexPath)) {
      return;
    }

    const topIndex = readJson(this.topIndexPath);
    const phase = topIndex.phases?.find((item) => item.dir === this.phaseDirName);
    if (!phase) {
      return;
    }

    phase.status = status;
    const timestampKey = {
      completed: 'completed_at',
      error: 'failed_at',
      blocked: 'blocked_at',
    }[status];

    if (timestampKey) {
      phase[timestampKey] = this.stamp();
    }

    writeJson(this.topIndexPath, topIndex);
  }

  finalize(push) {
    const index = readJson(this.indexPath);
    index.completed_at = this.stamp();
    writeJson(this.indexPath, index);
    this.updateTopIndex('completed');

    this.git(['add', '-A']);
    if (this.git(['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0) {
      this.git(['commit', '-m', `chore(${this.phaseName}): mark phase completed`]);
    }

    if (push) {
      this.git(['push', '-u', 'origin', `feat-${this.phaseName}`]);
    }
  }
}

export function createCodexHarness(options = {}) {
  return new CodexHarness(options);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(formatHelp());
    return 0;
  }

  if (!args.phaseDir && !args.auto) {
    throw new HarnessError('Missing phase directory. Run `npm run harness -- --help` for usage.');
  }

  createCodexHarness().run(args.phaseDir, {
    push: args.push,
    auto: args.auto,
    prepareWorktree: args.prepareWorktree || args.auto,
    cleanupFolders: args.cleanupFolders || args.auto,
    agent: args.agent,
  });
  return 0;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  try {
    process.exitCode = main();
  } catch (error) {
    if (error instanceof HarnessError) {
      console.error(`ERROR: ${error.message}`);
      process.exitCode = error.exitCode;
    } else {
      throw error;
    }
  }
}
