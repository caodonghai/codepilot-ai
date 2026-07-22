# CodePilot AI Workflow

Use `/ai <change>` for guided work, advanced `/ai:*` flows for forced phases, or `codepilot` commands to keep AI work consistent across Codex, Trae, Qoder, and Cursor.

## Required Flow

1. Read this file.
2. Resolve the active change name from the user's `/ai <change>` or `/ai:* <change>` command, from `harness/config.json`, or from the user's request.
3. If `openspec/changes/<change>` does not exist and the current flow is allowed to create a change, create the directory with `proposal.md`, `tasks.md`, `acceptance.md`, and `notes.md`.
4. Read the active change in `openspec/changes/<change>`.
5. Read relevant files under `.ai/core`.
6. Use relevant skills under `superpowers/skills`.
7. Make only changes required by the active change.
8. Prefer the single command form `codepilot <command>`.
9. Run validation/report commands when the flow asks for them and tool access is available.
10. Record notable verification details in the active change notes when useful.
11. For long-running work, read `harness/state.json` before continuing.
12. Record important progress with `codepilot step "<note>" --flow <flow>` when tool access is available.
13. Record confirmed product or technical decisions with `codepilot decision "<decision>"` when tool access is available.

## Knowledge Memory

- Before `/ai:propose`, `/ai:plan`, and `/ai:apply`, search relevant project knowledge with `codepilot knowledge:search <keywords> --limit 10` when tool access is available.
- Do not read the full `harness/memory/knowledge/*.jsonl` files during normal AI work.
- Use only the summaries returned by `knowledge:search`.
- Each flow should read at most 10 knowledge records, and each record summary should stay short enough to avoid context bloat.
- During `/ai:finish`, run `codepilot knowledge:suggest <change> --write` to produce candidates.
- After `/ai:finish`, add only confirmed reusable components, functions, patterns, decisions, or failures with `codepilot knowledge:add`.
- Every final work report should include Knowledge Memory status: searched terms, suggestion path if generated, added records if any, or a short reason if skipped.
