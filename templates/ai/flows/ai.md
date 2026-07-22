# /ai

Use this dispatcher for normal guided work when the user wants the AI engineering workflow without remembering every phase command.

## Inputs

- Required: `<change>` name.
- Optional: natural-language request, screenshots, affected files, or follow-up instructions.

## Protocol

1. Read `.ai/core/workflow.md`.
2. Resolve `<change>` from `/ai <change>` or from the active change in `harness/config.json`.
3. If the user did not use `/ai`, treat the message as ordinary conversation and do not force this workflow.
4. If the user explicitly uses `/ai:propose`, `/ai:plan`, `/ai:apply`, `/ai:verify`, `/ai:review`, or `/ai:finish`, use that exact flow instead of dispatching.
5. Read `harness/state.json` when present.
6. If the user asks to switch or inspect integrations, handle that request before change dispatch:
   - "切到官方模式" / "use official" -> `pnpm ai integration:use <openspec|superpowers> official`
   - "切回轻量版" / "use lightweight" -> `pnpm ai integration:use <openspec|superpowers> lightweight`
   - "混合模式" / "hybrid" -> `pnpm ai integration:use <openspec|superpowers> hybrid`
   - "检查官方资源" / "doctor official" -> `pnpm ai integration:list` and `pnpm ai doctor`
   - "验证官方集成" -> `pnpm ai integration:validate <openspec|superpowers> --dry-run`
   - "同步 Codex/Cursor/Trae/Qoder" -> `pnpm ai sync <tools...>`
   - Never install global packages, use global tools, modify PATH, or execute official CLI unless the user explicitly asks for `--execute`.
7. If the user asks to analyze Knowledge Memory, run `pnpm ai knowledge:analyze` and summarize the suggestions.
8. Inspect `openspec/changes/<change>` if it exists.
9. Dispatch:
   - If the change does not exist, use `/ai:propose <change>`.
   - If `proposal.md`, `tasks.md`, or `acceptance.md` is missing or clearly empty, use `/ai:propose <change>`.
   - If the proposal exists but implementation direction is not decision-complete, use `/ai:plan <change>`.
   - If `tasks.md` has unchecked implementation tasks, use `/ai:apply <change>`.
   - If implementation tasks are checked but acceptance is unchecked or verification is missing, use `/ai:verify <change>`.
   - If tasks and acceptance are satisfied, use `/ai:finish <change>`.
10. Tell the user which flow was selected and why in one short sentence.
11. Follow the selected flow's protocol.

## Output

Return the selected flow result and the next suggested action. Keep the user-facing command simple:

```text
/ai <change>
```

Use advanced `/ai:*` commands only when the user wants to force a specific phase.
