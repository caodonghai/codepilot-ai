# /ai:finish

Use this flow to close out an active change.

## Inputs

- Required: `<change>` name.

## Protocol

1. Read `.ai/core/workflow.md`.
2. If `openspec/changes/<change>` does not exist, stop and ask the user to run `/ai:propose <change>` with a short request.
3. Read all files under `openspec/changes/<change>`.
4. Read `superpowers/skills/finishing.md`.
5. Sync the local task board:
   - `pnpm ai task-board <change>`
6. Confirm completed tasks are checked and incomplete tasks remain unchecked.
7. Confirm acceptance criteria reflect the actual implementation.
8. Run the agent finish evaluator when tool access is available:
   - Lightweight: `pnpm ai agent-finish <change>`
   - With local check: `pnpm ai agent-finish <change> --check`
   - Strict, only when the repository ESLint environment is healthy or CI is running: `pnpm ai agent-finish <change> --check --strict`
9. If `agent-finish` is unavailable, fall back to:
   - `pnpm ai validate <change>`
   - `pnpm ai report <change>`
   - `pnpm ai check <change>`
   - `pnpm ai finish-state <change>`
10. Update `notes.md` with final verification details and known risks.
11. Generate Knowledge Memory suggestions when tool access is available:
   - `pnpm ai knowledge:suggest <change> --write`
   - Treat suggestions as candidates, not facts.
   - If no reusable candidates are found, say so explicitly in the final report.
12. Add only confirmed reusable knowledge to Knowledge Memory when the change reveals a component, function, pattern, decision, or failure that future work should reuse:
   - `pnpm ai knowledge:add --type <type> --name "<name>" --summary "<short-summary>" --keywords "<keyword1>,<keyword2>" --used-in "<path>"`
   - Do not add uncertain guesses as confirmed facts.
13. Do not claim the change is complete if required checks fail for implementation reasons, if tasks remain todo/doing/blocked, or if `agent-finish` reports `partially_accepted` or `blocked`.

## Output

Return:

- What changed.
- What was verified.
- Harness report path.
- Knowledge Memory searched terms, suggestion path if generated, added records if any, or reason skipped.
- Remaining risks.
- Whether the change is ready for review.
