# MsgFi AI Workflow

Use `/ai <change>` for guided work, advanced `/ai:*` flows for forced phases, or `pnpm ai` commands to keep AI work consistent across Codex, Trae, Qoder, and Cursor.

## Required Flow

1. Read this file.
2. Resolve the active change name from the user's `/ai <change>` or `/ai:* <change>` command, from `harness/config.json`, or from the user's request.
3. If `openspec/changes/<change>` does not exist and the current flow is allowed to create a change, create the directory with `proposal.md`, `tasks.md`, `acceptance.md`, and `notes.md`.
4. Read the active change in `openspec/changes/<change>`.
5. Read relevant files under `.ai/core`.
6. Use relevant skills under `superpowers/skills`.
7. Make only changes required by the active change.
8. Prefer the single command form `pnpm ai <command>`; use `pnpm.cmd ai <command>` only when Windows PowerShell blocks `pnpm.ps1`.
9. Run validation/report commands when the flow asks for them and tool access is available.
10. Record notable verification details in the active change notes when useful.
11. For long-running work, read `harness/state.json` before continuing.
12. Record important progress with `pnpm ai step "<note>" --flow <flow>` when tool access is available.
13. Record confirmed product or technical decisions with `pnpm ai decision "<decision>"` when tool access is available.

## Knowledge Memory

- Before `/ai:propose`, `/ai:plan`, and `/ai:apply`, search relevant project knowledge with `pnpm ai knowledge:search <keywords> --limit 10` when tool access is available.
- Do not read the full `harness/memory/knowledge/*.jsonl` files during normal AI work.
- Use only the summaries returned by `knowledge:search`.
- Each flow should read at most 10 knowledge records, and each record summary should stay short enough to avoid context bloat.
- During `/ai:finish`, run `pnpm ai knowledge:suggest <change> --write` to produce candidates.
- After `/ai:finish`, add only confirmed reusable components, functions, patterns, decisions, or failures with `pnpm ai knowledge:add`.
- Every final work report should include Knowledge Memory status: searched terms, suggestion path if generated, added records if any, or a short reason if skipped.

## Integrations

- Default integration mode is lightweight for both OpenSpec and Superpowers.
- Official and hybrid modes are optional and must use repo-local files under `harness/integrations/<name>`.
- Do not install global packages, modify PATH, or overwrite lightweight rules when switching integration modes.
- Use `pnpm ai integration:list` to inspect current modes.
- Use `pnpm ai integration:use <openspec|superpowers> <lightweight|official|hybrid>` to switch modes.
- Use `pnpm ai integration:install <name> --dry-run` before any official resource install.
- Use `pnpm ai integration:download <name> --dry-run` before downloading official sources.
- Download official sources outside the repository by default, then install with `local:<path>`.
- Official install only supports `pnpm ai integration:install <name> --source local:<path>` and copies into repo-local `harness/integrations/<name>/official`.
- Use `pnpm ai integration:remove <name>` only to clear repo-local official/cache directories and switch that integration back to lightweight.
- Conversation requests such as "切到官方模式", "切回轻量版", "同步 Codex/Cursor", "检查官方资源", and "分析 knowledge" should map to the corresponding `integration:*`, `sync`, and `knowledge:analyze` commands.
- Do not execute official CLI commands unless the user explicitly asks for official execution.

## Entry Modes

This kit supports both terminal-first and conversation-first usage.

Terminal-first:

```bash
pnpm ai new <change>
pnpm ai validate <change>
pnpm ai report <change>
```

Conversation-first:

```text
/ai <change>
<short request>
```

If the change does not exist, conversation-first flows should dispatch to propose and create it instead of asking the user to run `pnpm ai new`, unless file edits are unavailable.

## Conversation Commands

- `/ai`: dispatch to the next suitable flow for the change.
- `/ai:explore`: clarify a request without editing code.
- `/ai:propose`: create or refine change documents.
- `/ai:plan`: produce an implementation plan.
- `/ai:apply`: implement unfinished tasks.
- `/ai:verify`: verify implementation against the change.
- `/ai:review`: review changes for risks.
- `/ai:finish`: complete checks, report, and handoff notes.
