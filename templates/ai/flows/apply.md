# /ai:apply

Use this flow to implement unfinished tasks for an active change.

## Inputs

- Required: `<change>` name.

## Protocol

1. Read `.ai/core/workflow.md`.
2. If `openspec/changes/<change>` does not exist, stop and ask the user to run `/ai:propose <change>` with a short request.
3. Read all files under `openspec/changes/<change>`.
4. Read `.ai/core/project.md`, `.ai/core/frontend.md`, `.ai/core/api.md`, `.ai/core/ui.md`, and `.ai/core/testing.md`.
5. Search Knowledge Memory for relevant usage examples and known failures:
   - `pnpm ai knowledge:search <change> <module-or-domain-keywords> --limit 10`
   - Use only returned summaries. Do not read `harness/memory/knowledge` directly.
   - If no records are found, state that no reusable knowledge was available before editing.
6. Read `superpowers/skills/planning.md`; read `tdd.md`, `debugging.md`, or `code-review.md` when relevant.
7. Sync the local task board when tool access is available:
   - `pnpm ai task-board <change>`
8. Prepare or claim the next task before editing:
   - Prompt only: `pnpm ai agent-run <change>`
   - Claim next task: `pnpm ai agent-run <change> --claim`
9. Inspect affected files before editing.
10. If `tasks.md` is still generic or underspecified, refine it from `proposal.md` before editing code.
11. Implement only the current task or unchecked tasks in `openspec/changes/<change>/tasks.md`.
12. Keep edits inside the proposal scope. If implementation requires scope expansion, stop and update the proposal first.
13. Reuse existing components, request helpers, models, permissions, routes, and styles before adding new patterns.
14. Mark task state explicitly when tool access is available:
   - Done: `pnpm ai task-done <task-id> --change <change>`
   - Blocked: `pnpm ai task-block <task-id> --change <change> --reason "<reason>"`
15. Update `tasks.md` checkboxes only for tasks actually completed.
16. Add useful implementation notes to `notes.md`.
17. Run `pnpm ai validate <change>` when tool access is available.
18. If validation fails, fix the issue and rerun validation.
19. Run focused tests or builds only when the change risk requires them or the user asks.

## Output

Return:

- Completed tasks.
- Files changed.
- Verification result.
- Knowledge Memory records used or "none found".
- Remaining risks or blocked items.
- Suggested next command: `/ai:verify <change>`.
