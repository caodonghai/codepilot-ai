# /ai:explore

Use this flow to understand a request before creating or changing code.

## Inputs

- Required: a natural-language request or a change name.
- Optional: affected app/package names, screenshots, API names, route names, or business module names.

## Protocol

1. Read `.ai/core/workflow.md`.
2. Read `.ai/core/project.md`, `.ai/core/frontend.md`, `.ai/core/api.md`, and `.ai/core/ui.md`.
3. Search the repository for terms from the request, including Chinese business names, route names, page titles, model names, API names, and component names.
4. Identify the likely affected app, page, route, model, request module, shared package, and UI states.
5. Do not edit code or OpenSpec files.
6. Ask only for product decisions that cannot be discovered from the repository.
7. Output a concise exploration summary and a recommended change name.

## Output

Return:

- Affected area.
- Relevant files and why they matter.
- Known unknowns.
- Recommended OpenSpec-compatible change scope.
- Suggested next command, usually `/ai:propose <change>`.
