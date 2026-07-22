# /ai:plan

Use this flow to create a decision-complete implementation plan before editing code.

## Inputs

- Required: `<change>` name.

## Protocol

1. Read `.ai/core/workflow.md`.
2. If `openspec/changes/<change>` does not exist, stop and ask the user to run `/ai:propose <change>` with a short request.
3. Read all files under `openspec/changes/<change>`.
4. Read `.ai/core/project.md`, `.ai/core/frontend.md`, `.ai/core/api.md`, `.ai/core/ui.md`, and `.ai/core/testing.md`.
5. Search Knowledge Memory for relevant components, functions, patterns, and failures:
   - `pnpm ai knowledge:search <change> <module-or-domain-keywords> --limit 10`
   - Read only returned summaries. Do not read the full memory JSONL files.
   - If no records are found, explicitly say that planning proceeded without prior Knowledge Memory.
6. Read `superpowers/skills/planning.md`.
7. Inspect the likely affected files and nearby implementation patterns.
8. Do not edit code.
9. Produce an implementation plan that names:
   - affected app/package
   - pages/routes/components/models/API modules to modify
   - data flow and UI states
   - task order
   - verification commands
   - known risks
10. If the plan needs a product decision, ask before implementation.

## Output

Return a concise implementation plan, Knowledge Memory usage summary, and suggested next command: `/ai:apply <change>`.
