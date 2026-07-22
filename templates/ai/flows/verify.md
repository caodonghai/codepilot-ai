# /ai:verify

Use this flow to verify implementation against the active change.

## Inputs

- Required: `<change>` name.

## Protocol

1. Read `.ai/core/workflow.md`.
2. If `openspec/changes/<change>` does not exist, stop and ask the user to run `/ai:propose <change>` with a short request.
3. Read all files under `openspec/changes/<change>`.
4. Inspect the current diff and relevant surrounding code.
5. Sync and review the task board when tool access is available:
   - `pnpm ai task-board <change>`
6. Compare implementation with every item in `acceptance.md`.
7. Check for scope creep against `proposal.md`.
8. Run `pnpm ai validate <change>` when tool access is available.
9. Run focused tests, lint, or builds when the changed area warrants it.
10. Add verification notes to `notes.md`, including commands run and results.
11. If acceptance is not met, write exact follow-up tasks back to `tasks.md` as unchecked items instead of marking the change complete.
12. For each verified current task, mark it explicitly:
   - Done: `pnpm ai task-done <task-id> --change <change>`
   - Blocked: `pnpm ai task-block <task-id> --change <change> --reason "<reason>"`
13. Update Harness state when tool access is available:
   - `pnpm ai verify-state <change> --status accepted`
   - `pnpm ai verify-state <change> --status partially_accepted`
   - `pnpm ai verify-state <change> --status rejected`
   - `pnpm ai verify-state <change> --status blocked`
14. When adding follow-up tasks from verification, prefer the CLI form:
   - `pnpm ai verify-state <change> --status partially_accepted --task "Describe the missing acceptance item"`

## Output

Return:

- Acceptance status.
- Verification commands and results.
- Issues found.
- Harness state.
- Suggested next command: `/ai:finish <change>` if everything is acceptable, otherwise `/ai:apply <change>`.
