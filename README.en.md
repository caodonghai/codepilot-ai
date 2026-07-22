# CodePilot AI

[English](README.en.md) | [中文](README.md)

CodePilot AI is an AI-powered engineering workflow toolkit designed to live in your project repository. It unifies OpenSpec-style requirement-first methodology, Superpowers-style skill workflows, local Harness acceptance status tracking, Knowledge Memory for knowledge accumulation, and multi-AI-editor rule synchronization (Codex/Trae/Qoder/Cursor) into a single command.

First-time setup: install the package and run initialization:

```bash
pnpm add -D @codepilot/ai
pnpm exec codepilot init
pnpm ai validate
```

Why `pnpm exec codepilot init` for the first time? Because the project doesn't have `"scripts": { "ai": "codepilot" }` yet. The `init` command automatically adds this script to `package.json`, so you can use:

```bash
pnpm ai init qoder
pnpm ai sync qoder
pnpm ai validate
pnpm ai knowledge:search keywords
```

If you only want to initialize specific AI editors, append their names to `init`:

```bash
pnpm exec codepilot init qoder
pnpm exec codepilot init codex cursor
pnpm exec codepilot init codex trae qoder cursor
```

Without tool names, it defaults to `codex / trae / qoder / cursor`.

After initialization, the project gets these capabilities:

- `.ai/`: Project AI rules and `/ai` workflows
- `openspec/`: Requirements, tasks, and acceptance documents
- `superpowers/`: Project-level AI skills
- `harness/`: Local state, task board, reports, and Knowledge Memory
- `AGENTS.md`, `.trae/`, `.qoder/`, `.cursor/`: Rule files for different AI editors

In AI conversations, the team can use:

```text
/ai my-change-name
Write requirement description here
```

To force a specific stage, use:

```text
/ai:propose my-change-name
/ai:plan my-change-name
/ai:apply my-change-name
/ai:verify my-change-name
/ai:finish my-change-name
```

## Recommended Usage Flow

### 1. Install the Package

```bash
pnpm add -D @codepilot/ai
```

### 2. First-time Initialization

```bash
pnpm exec codepilot init
```

This step:

- Generates `.ai / openspec / superpowers / harness`
- Generates Codex/Trae/Qoder/Cursor adapter files
- Automatically adds `"ai": "codepilot"` to `package.json`
- Does not overwrite existing `scripts.ai`

To skip automatic `package.json` modification:

```bash
pnpm exec codepilot init --no-setup-script
```

### 3. Subsequent Usage

After initialization, always use:

```bash
pnpm ai <command>
```

Examples:

```bash
pnpm ai validate
pnpm ai sync qoder
pnpm ai new bank-reconciliation
pnpm ai knowledge:search bank reconciliation
```

## Command Reference

### `pnpm ai init [tools...]`

Initialize AI engineering directories and editor adapter files.

```bash
pnpm ai init
pnpm ai init qoder
pnpm ai init codex cursor
```

Without `tools`, initializes all: `codex / trae / qoder / cursor`.

Running multiple times merges new tools into existing configuration.

### `pnpm ai sync [tools...]`

Regenerate rule files for different AI editors from `.ai/core`, `.ai/flows`, `superpowers/skills`.

```bash
pnpm ai sync
pnpm ai sync qoder cursor
pnpm ai sync --skip codex
```

If Codex is locking `.codex/skills`:

```bash
pnpm ai sync trae qoder cursor
```

### `pnpm ai new <change>`

Create an OpenSpec-compatible change directory:

```bash
pnpm ai new bank-reconciliation
pnpm ai new bugfix-139204 --type bugfix
```

Generates:

```text
openspec/changes/<change>/proposal.md
openspec/changes/<change>/tasks.md
openspec/changes/<change>/acceptance.md
openspec/changes/<change>/notes.md
```

### `pnpm ai validate [change]`

Check if required AI Kit files are complete, verify proposal/tasks/acceptance exist for current change, and check target file synchronization.

```bash
pnpm ai validate
pnpm ai validate bank-reconciliation
```

### `pnpm ai check [change]`

Execute the default check pipeline:

```bash
pnpm ai check
pnpm ai check bank-reconciliation
```

Lightweight by default, primarily for AI workflow conclusion.

### `pnpm ai report [change]`

Generate Harness JSON report:

```bash
pnpm ai report
pnpm ai report bank-reconciliation
```

Report written to:

```text
harness/reports/<timestamp>.json
```

### `pnpm ai status`

View current Harness status:

```bash
pnpm ai status
```

### `pnpm ai current [change]`

View or set the current active change:

```bash
pnpm ai current
pnpm ai current bank-reconciliation
```

### `pnpm ai resume`

Suggest the next `/ai` flow based on current Harness status.

```bash
pnpm ai resume
```

### `pnpm ai task-board <change>`

Sync local task board from `tasks.md`.

```bash
pnpm ai task-board bank-reconciliation
```

### `pnpm ai task-next <change>`

View the next pending task.

```bash
pnpm ai task-next bank-reconciliation
```

### `pnpm ai task-start / task-done / task-block`

Mark task status.

```bash
pnpm ai task-start T001 --change bank-reconciliation
pnpm ai task-done T001 --change bank-reconciliation
pnpm ai task-block T002 --change bank-reconciliation --reason "Missing runtime environment"
```

### `pnpm ai agent-run <change>`

Generate next-step Agent execution prompt, suitable for long tasks or multi-person handoffs.

```bash
pnpm ai agent-run bank-reconciliation
pnpm ai agent-run bank-reconciliation --claim
```

### `pnpm ai agent-finish <change>`

Evaluate final status based on task board, acceptance criteria, and check results.

```bash
pnpm ai agent-finish bank-reconciliation
pnpm ai agent-finish bank-reconciliation --check
```

If runtime verification is incomplete, result will be `partially_accepted`.

### `pnpm ai knowledge:search <keywords...>`

Search project Knowledge Memory.

```bash
pnpm ai knowledge:search bank reconciliation
pnpm ai knowledge:search EccApplicationMst detail --limit 10
```

AI should search Knowledge before `/ai:propose`, `/ai:plan`, `/ai:apply`.

### `pnpm ai knowledge:suggest <change> --write`

Generate reusable knowledge candidates based on current change during finish stage.

```bash
pnpm ai knowledge:suggest bank-reconciliation --write
```

Candidates are suggestions only, not automatically committed.

### `pnpm ai knowledge:add`

Manually add verified reusable knowledge to Knowledge Memory.

```bash
pnpm ai knowledge:add --type pattern --name "React detail migration" --summary "When migrating ExtJS detail pages to React, align data flow, save entry, and grid column formatting first." --keywords "ExtJS,React,detail" --used-in "apps/web/xxx/detail/index.tsx"
```

### `pnpm ai knowledge:list`

View existing Knowledge records.

```bash
pnpm ai knowledge:list
pnpm ai knowledge:list --type pattern
```

### `pnpm ai knowledge:index`

Rebuild Knowledge index.

```bash
pnpm ai knowledge:index
```

### `pnpm ai knowledge:dedupe`

Merge duplicate Knowledge records by id.

```bash
pnpm ai knowledge:dedupe
```

### `pnpm ai knowledge:analyze`

Analyze current Knowledge Memory quality and suggest future accumulation directions.

```bash
pnpm ai knowledge:analyze
```

### `pnpm ai integration:list`

View current OpenSpec/Superpowers integration mode.

```bash
pnpm ai integration:list
```

Default is `lightweight`, using CodePilot built-in lightweight compatible workflows.

### `pnpm ai integration:download <name>`

Download official OpenSpec or Superpowers source code to a directory outside the repository.

```bash
pnpm ai integration:download openspec
pnpm ai integration:download superpowers
```

This only downloads, does not enable or install globally.

### `pnpm ai integration:install <name> --source local:<path>`

Import downloaded official source code into the current project's repo-local official directory.

```bash
pnpm ai integration:install openspec --source "local:E:\path\to\openspec"
```

Wrap path in quotes if it contains spaces.

### `pnpm ai integration:use <name> <mode>`

Switch integration mode.

```bash
pnpm ai integration:use openspec lightweight
pnpm ai integration:use openspec official
pnpm ai integration:use superpowers hybrid
```

Supported modes:

- `lightweight`: Use CodePilot built-in lightweight version
- `official`: Prioritize repo-local official resources
- `hybrid`: Combine lightweight rules with repo-local official resources

### `pnpm ai integration:validate <name>`

Check if repo-local official resources are usable.

```bash
pnpm ai integration:validate openspec
pnpm ai integration:validate openspec --execute
```

Defaults to probe only, does not execute official CLI. Use `--execute` to run.

### `pnpm ai integration:remove <name>`

Remove repo-local official/cache and switch back to lightweight.

```bash
pnpm ai integration:remove openspec
```

Does not uninstall global tools as this toolkit does not use global installation.

### `pnpm ai doctor`

Check local AI Kit runtime environment and target file health status.

```bash
pnpm ai doctor
pnpm ai doctor --encoding
```

## AI Conversation Usage

Recommended way to start a requirement in AI chat:

```text
/ai bank-reconciliation
Bank transaction record query, add bank reconciliation feature
```

AI should automatically dispatch to appropriate stages:

```text
/ai:propose -> /ai:plan -> /ai:apply -> /ai:verify -> /ai:finish
```

To force a specific step:

```text
/ai:propose bank-reconciliation
/ai:apply bank-reconciliation
```

For direct questions without workflow, simply ask without `/ai`.

## File and Git Recommendations

Recommended to commit to Git:

```text
.ai/
openspec/
superpowers/
harness/config.json
harness/state.json
harness/tasks/
harness/memory/
AGENTS.md
.trae/
.qoder/
.cursor/
```

Commit with caution or per team policy:

```text
harness/reports/
harness/runs/
```

Not recommended to commit:

```text
harness/integrations/*/official/
harness/integrations/*/cache/
```

## Security Boundaries

- Defaults to lightweight mode, no strong dependency on official OpenSpec/Superpowers.
- Official resources only allowed as repo-local, no global installation.
- Does not modify PATH.
- Does not execute official CLI by default.
- `init` does not overwrite existing `scripts.ai`.
- Package upgrades should not overwrite user-edited `.ai / openspec / superpowers / harness` source files.

## Current Version Status

Version:

```text
1.0.0
```

Suitable for team trial use. Recommended further verification before official release:

- Windows / macOS / Linux
- Codex / Trae / Qoder / Cursor
- Clean repository initialization
- Re-initialization on existing repositories
- Knowledge Memory search and accumulation effectiveness in real requirements