# CodePilot AI

[English](README.en.md) | [中文](README.md)

CodePilot AI is a repository-oriented AI engineering workflow CLI. It brings requirement and acceptance documents, staged AI workflows, local task state, Knowledge Memory, and rule synchronization for Codex, Trae, Qoder, and Cursor under one `codepilot` command.

## Core capabilities

- OpenSpec-compatible changes with proposal, tasks, acceptance, and notes documents.
- `/ai` workflows for explore, propose, plan, apply, verify, review, and finish.
- Harness state for active changes, tasks, steps, decisions, verification, and reports.
- Knowledge Memory search, entry creation, indexing, deduplication, analysis, and suggestions.
- Rule synchronization for Codex, Trae, Qoder, and Cursor by default.
- Repo-local OpenSpec and Superpowers integrations without changing the global PATH.
- Git, backup, dependency, hook, template, and upgrade utilities.

## Requirements

- Node.js 18 or later
- npm, pnpm, yarn, or bun

Examples use pnpm. With another package manager, replace `pnpm exec codepilot` with its equivalent package-execution command.

## Quick start

### 1. Install

```bash
pnpm add -D codepilot-ai
```

### 2. Initialize

The project does not have a `scripts.ai` entry before its first initialization, so run:

```bash
pnpm exec codepilot init
```

`init` detects the project framework, build tool, and package manager, creates the workflow files, and adds this script to `package.json`:

```json
{
  "scripts": {
    "ai": "codepilot"
  }
}
```

CodePilot preserves an existing `scripts.ai` entry.

### 3. Validate

```bash
pnpm ai validate
pnpm ai doctor
```

After initialization, use:

```bash
pnpm ai <command>
```

## Generated project structure

By default, initialization targets `codex,trae,qoder,cursor` and creates or maintains:

```text
.ai/                         Core rules, flows, and tool registry
openspec/                    Project specification, active changes, and archives
superpowers/                 Project-level skill documents
harness/                     Configuration, state, tasks, runs, and knowledge
.codex/                      Codex rules and commands
.trae/                       Trae rules and commands
.qoder/                      Qoder rules and commands
.cursor/                     Cursor rules and commands
```

Initialize selected tools only:

```bash
pnpm exec codepilot init --tools codex,qoder
```

Override project detection when needed:

```bash
pnpm exec codepilot init \
  --framework react \
  --build-tool vite \
  --pm pnpm
```

Initialization options:

- `--profile <profile>`: `lightweight`, `official`, or `hybrid`.
- `--tools <tools>`: comma-separated tool identifiers.
- `--force`: request overwriting generated targets.
- `--framework <framework>`: React, Vue, Angular, Svelte, Next, Nuxt, Remix, or Solid.
- `--build-tool <buildTool>`: webpack, vite, rollup, esbuild, or parcel.
- `--pm <packageManager>`: npm, yarn, pnpm, or bun.

## Recommended workflow

Create a change:

```bash
pnpm ai new bank-reconciliation --type feature
```

Supported types are `default`, `bugfix`, `feature`, `ui-change`, and `refactor`. Change names may contain lowercase letters, numbers, Chinese characters, and single hyphens.

Generated files:

```text
openspec/changes/bank-reconciliation/
├── proposal.md
├── tasks.md
├── acceptance.md
└── notes.md
```

Continue with:

```bash
pnpm ai task-board bank-reconciliation
pnpm ai agent-run bank-reconciliation --claim
pnpm ai check bank-reconciliation
pnpm ai verify bank-reconciliation --status passed
pnpm ai agent-finish bank-reconciliation --check
pnpm ai archive bank-reconciliation
```

In AI editors that support the generated command files, use:

```text
/ai bank-reconciliation
/ai:explore bank-reconciliation
/ai:propose bank-reconciliation
/ai:plan bank-reconciliation
/ai:apply bank-reconciliation
/ai:verify bank-reconciliation
/ai:review bank-reconciliation
/ai:finish bank-reconciliation
```

Regular questions do not require `/ai`.

## Command reference

### Initialization and synchronization

```bash
pnpm ai init [options]
pnpm ai sync [options]
```

`sync` regenerates editor rules from `.ai/core`, `.ai/flows`, and `superpowers/skills`:

```bash
pnpm ai sync --tools codex,qoder
pnpm ai sync --dry-run
pnpm ai sync --force
```

### Change management

```bash
pnpm ai new <change> [--type <type>] [--interactive] [--branch]
pnpm ai list [--archived]
pnpm ai validate [change] [--quiet]
pnpm ai check [change] [--strict] [--no-eslint]
pnpm ai report [change]
pnpm ai encoding [change] [--fix]
pnpm ai archive <change>
pnpm ai restore <change>
pnpm ai delete <change>
```

`delete` only removes an archived change under `openspec/archive/<change>`. Every change path is protected by name and directory-boundary validation.

### Harness state and tasks

```bash
pnpm ai status
pnpm ai current [change]
pnpm ai resume
pnpm ai task-board [change]
pnpm ai task-next [change]
pnpm ai task-doing <task> [--change <change>] [--owner <owner>]
pnpm ai task-done <task> [--change <change>] [--owner <owner>]
pnpm ai task-block <task> [--change <change>] [--owner <owner>] [--reason <reason>]
```

Record verification, steps, and decisions:

```bash
pnpm ai verify [change] --status passed --task "Run page acceptance"
pnpm ai finish-state [change]
pnpm ai step "Completed list page" --change bank-reconciliation --flow apply
pnpm ai decision "Keep the existing API" --change bank-reconciliation
pnpm ai run-log --limit 20
```

### Agent handoff

```bash
pnpm ai agent-run [change] [--claim] [--mode prompt]
pnpm ai agent-finish [change] [--check] [--strict]
```

`agent-run --claim` claims the next task. `agent-finish` evaluates task, acceptance, and check results before reporting completion.

### Knowledge Memory

Knowledge operations are nested subcommands separated by spaces:

```bash
pnpm ai knowledge search bank reconciliation --limit 10
pnpm ai knowledge list --type pattern
pnpm ai knowledge index
pnpm ai knowledge dedupe
pnpm ai knowledge analyze --limit 10
pnpm ai knowledge suggest bank-reconciliation --write
```

Add reviewed, reusable knowledge:

```bash
pnpm ai knowledge add \
  --type pattern \
  --name "React detail migration" \
  --summary "Align data flow, save entry, and grid formatting before migrating a detail page." \
  --keywords "React,detail,migration" \
  --used-in "apps/web/example/detail/index.tsx"
```

Use `--from <json-file>` to load an entry from JSON.

### OpenSpec and Superpowers integrations

Integration operations also use space-separated subcommands:

```bash
pnpm ai integration list
pnpm ai integration download openspec --dry-run
pnpm ai integration download openspec --to ../official-openspec
pnpm ai integration install openspec --source "local:../official-openspec"
pnpm ai integration use openspec official
pnpm ai integration validate openspec
pnpm ai integration validate openspec --execute
pnpm ai integration remove openspec
```

Supported integrations are `openspec` and `superpowers`. Available modes:

- `lightweight`: use CodePilot's built-in lightweight workflow.
- `official`: use official resources imported into this repository.
- `hybrid`: combine lightweight rules with repo-local official resources.

`download` requires a destination outside the repository by default. `install` and `remove` can only operate inside `harness/integrations/<name>` and reject symlink escapes.

### Configuration, diagnostics, and flows

```bash
pnpm ai doctor [--strict] [--encoding]
pnpm ai config get <key>
pnpm ai config set <key> <value>
pnpm ai config list
pnpm ai config show
pnpm ai config reset
pnpm ai flow list
pnpm ai flow show <flow>
pnpm ai flow sync
```

### Git, dependencies, hooks, templates, and backups

```bash
pnpm ai git status
pnpm ai git info
pnpm ai git branch <change>
pnpm ai git commit [change]

pnpm ai dep add <change> <target> --type requires
pnpm ai dep remove <change> <target>
pnpm ai dep list <change>
pnpm ai dep check <change>
pnpm ai dep graph [change]

pnpm ai hook list
pnpm ai hook register <name> --priority 100
pnpm ai hook trigger <name> --change <change> --task <task>
pnpm ai hook unregister <name>
pnpm ai hook clear

pnpm ai template list
pnpm ai template add <name>
pnpm ai template show <name>
pnpm ai template edit <name>
pnpm ai template remove <name>

pnpm ai backup create
pnpm ai backup list
pnpm ai backup restore <file>
pnpm ai backup delete <file>

pnpm ai upgrade version
pnpm ai upgrade check
pnpm ai upgrade install
```

## Global options

Place global options before the subcommand:

```bash
pnpm ai --verbose doctor
pnpm ai --json status
pnpm ai --locale en-US doctor
```

- `-v, --verbose`: enable debug logs.
- `-q, --quiet`: suppress regular output.
- `--dry-run`: preview an operation.
- `--json`: request JSON output.
- `--locale zh-CN|en-US`: set the output locale; defaults to `zh-CN`.

## Git recommendations

Recommended to commit:

```text
.ai/
openspec/
superpowers/
harness/config.json
harness/state.json
harness/tasks/
harness/memory/
.codex/
.trae/
.qoder/
.cursor/
```

Commit according to team policy:

```text
harness/reports/
harness/runs/
```

Usually exclude:

```text
harness/integrations/*/official/
harness/integrations/*/cache/
```

## Security boundaries

- CodePilot does not globally install OpenSpec or Superpowers and does not modify PATH.
- Official validation commands run only with explicit `integration validate --execute`.
- Integration install, cache, and removal paths are restricted to their repo-local directories.
- Change archive, restore, and deletion reject path traversal and symlink directories.
- `init` preserves existing project templates and `scripts.ai`; `sync` regenerates rules and command files for the selected editors.
- Package upgrades do not proactively overwrite `.ai`, `openspec`, `superpowers`, or `harness` project files.

## Developing this project

```bash
npm ci
npm run lint:check
npm run format:check
npm run test:coverage
npm run build
npm run smoke
```

Tests use an isolated temporary project root and do not modify real Harness data in the repository. CI runs lint, formatting, coverage, build, and smoke tests on Node.js 18 and 20.

## License

MIT
