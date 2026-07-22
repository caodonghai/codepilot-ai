# /ai:propose

Use this flow to turn a request into an OpenSpec-compatible change.

## Inputs

- Required: `<change>` name.
- Required if the change files are still empty: a short natural-language request.
- Optional: screenshots, affected module names, API names, or expected behavior.

## Protocol

1. Read `.ai/core/workflow.md`.
2. Read `.ai/core/project.md`, `.ai/core/frontend.md`, `.ai/core/api.md`, and `.ai/core/ui.md`.
3. If `openspec/changes/<change>` does not exist, create it with:
   - `proposal.md`
   - `tasks.md`
   - `acceptance.md`
   - `notes.md`
4. Read existing files under `openspec/changes/<change>`.
5. Search Knowledge Memory for the change name and request keywords before repository-wide search:
   - `pnpm ai knowledge:search <change> <request-keywords> --limit 5`
   - Read only the returned summaries, not the raw `harness/memory/knowledge/*.jsonl` files.
   - If no records are found, record "Knowledge searched: no relevant records" in the response or notes.
6. Search the repository for terms from the request and change name to locate likely affected pages, routes, models, APIs, and components.
7. Do not edit business code.
8. Create or refine:
   - `openspec/changes/<change>/proposal.md`
   - `openspec/changes/<change>/tasks.md`
   - `openspec/changes/<change>/acceptance.md`
   - `openspec/changes/<change>/notes.md`
9. Make `tasks.md` actionable enough that `/ai:apply <change>` can implement without guessing.
10. Make `acceptance.md` observable enough that `/ai:verify <change>` can check it.
11. If tool access is available, run `pnpm ai validate <change>`.
12. If important product behavior is ambiguous, write the ambiguity into `notes.md` and ask a short question instead of inventing behavior.

## Output

Return:

- Summary of the proposed change.
- Affected files or areas discovered.
- Knowledge Memory terms searched and whether records were found.
- Open questions, if any.
- Suggested next command: `/ai:plan <change>`.
