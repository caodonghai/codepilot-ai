# /ai:review

Use this flow to review changes for correctness and risk.

## Inputs

- Required: `<change>` name.

## Protocol

1. Read `.ai/core/workflow.md` and `.ai/core/review.md`.
2. If `openspec/changes/<change>` exists, read all files under it. If it does not exist, review the current diff against the user's stated request.
3. Read `superpowers/skills/code-review.md`.
4. Inspect the diff and relevant surrounding code.
5. Prioritize bugs, regressions, scope creep, missing states, broken request contracts, and missing verification.
6. Do not rewrite code unless explicitly asked to fix findings.
7. Provide file and line references when possible.

## Output

Return findings first, ordered by severity. If there are no findings, say so and list any residual verification risk.
