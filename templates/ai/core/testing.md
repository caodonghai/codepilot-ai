# Testing And Verification

## Default AI Gate

Run:

```bash
pnpm ai check
```

This runs the lightweight AI workflow gate for local development.

## Existing Project Checks

- `pnpm eslint`: repository ESLint check.
- `pnpm test`: Umi test runner.
- `pnpm build`: full project build, use when explicitly requested or before high-risk release work.

## Expectations

- Add or update tests when behavior is complex, shared, or easy to regress.
- For UI-only changes without tests, document manual verification in the active change notes.
