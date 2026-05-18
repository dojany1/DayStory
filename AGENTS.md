# AI Agent System Rules

## Role
- Senior full-stack engineer for DayStory.
- Keep architecture lean, maintainable, and consistent with `CLAUDE.md`.

## Project Rules
- Read `CLAUDE.md` before implementation work and follow its CRITICAL rules.
- Firestore and Storage access must go through `src/js/services/*`.
- Sanitize user text with `src/js/utils/sanitize.js` before DOM insertion.
- Register page cleanup with `setOnUnmount(fn)` for `window`, `document`, or Capacitor listeners.
- Do not use browser `confirm()` or `alert()` for app UX. Use `src/js/components/confirmDialog.js`.
- Use `src/css/variables.css` tokens for colors, spacing, and z-index. Do not hardcode component/page colors.

## TDD
- Write or update failing Vitest tests first using Given-When-Then scenario names.
- Implement the minimum code required to pass those tests.
- Run `npm run build` and `npm test` for feature work unless the step specifies narrower acceptance criteria.

## Agent Harness
- Codex reads this `AGENTS.md`; Claude reads `CLAUDE.md`. Keep harness behavior aligned in both files.
- Outside an active harness step, when the user asks to apply or run the harness automatically, run `npm run harness:auto` yourself instead of asking the user to type a command.
- Inside a harness step session started by `scripts/codex-harness.mjs`, do not run `npm run harness:auto` recursively. Execute only the current step in the prompt.
- `npm run harness:auto` discovers the next pending phase, snapshots a dirty worktree with a safe commit, removes only unlisted empty phase folders, and chooses Codex or Claude CLI automatically.
- Manual execution remains available with `npm run harness -- <phase-dir>`.
- For a harness step, read `AGENTS.md`, `CLAUDE.md`, relevant `docs/*.md`, the current `phases/{phase}/index.json`, previous completed step summaries, and the current `phases/{phase}/stepN.md`.
- Execute only the current pending step. Do not add unrelated features or refactors.
- Update `phases/{phase}/index.json` before finishing the step:
  - Success: set `status` to `"completed"` and add a one-line `summary`.
  - Failed after reasonable fixes: set `status` to `"error"` and add `error_message`.
  - User input or external setup required: set `status` to `"blocked"` and add `blocked_reason`.
- Do not commit from inside a harness step. `scripts/codex-harness.mjs` creates separated code and metadata commits.

## Session Log
- If this session changed any file, append one entry to the bottom of `docs/SESSION_LOG.md` before ending the session. Use Edit/Write — never skip.
- Required fields per entry: `YYYY-MM-DD HH:MM — <agent>`, `요구사항`, `구현방법`, `변경파일`. Use the user's local 24-hour time.
- Format, rules, and template live at the top of `docs/SESSION_LOG.md`. Follow it exactly.
- Do not edit existing entries. If a previous entry was wrong, add a new corrective entry.
- Skip the log for pure question / explanation / review sessions where no files changed.
- Inside a harness step, base the entry on that step's requirement, implementation, and changed files.

## Session Checkpoint
- At the end of every file-changing session, save all changes to GitHub through `scripts/session-checkpoint.sh`.
- Claude Code runs this automatically through `.claude/settings.json` Stop hook.
- Codex CLI, Cursor, and other agents must run this manually after appending `docs/SESSION_LOG.md`:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/session-checkpoint.ps1
  ```
- Bash environments can use `bash scripts/session-checkpoint.sh` instead.
- The script commits with `chore: auto session checkpoint YYYY-MM-DD HH:MM`, then pushes to `origin/<branch>`.
- If there are no changes, the script exits as a no-op.
- If the current branch is `main` or `master`, the script switches to `session-checkpoint` first to avoid automatic commits on the main line.
- The script never force-pushes. If push fails, the local commit remains as a recovery point.

## Conversation Autopilot
- When the user talks naturally with requests like "알아서 해줘", "계속해", "적용해", "구현해", "진행해", "fix it", or "continue", check for a pending harness phase first.
- If a pending phase exists, run `npm run harness:auto` yourself; do not wait for the user to type a command.
- If no pending phase exists, continue with the user request normally and implement directly using the project rules.
- Do not run `npm run harness:auto` for pure questions, explanations, reviews, or planning-only requests unless the user asks to apply or execute.
- Never delete or reset user work while preparing automation. Preserve dirty worktree changes through the harness snapshot commit path.
