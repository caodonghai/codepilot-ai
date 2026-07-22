# CodePilot AI OpenSpec Compatibility

This directory stores OpenSpec-compatible change records for AI-assisted development work.

The first version does not require the official `@fission-ai/openspec` CLI. It keeps a compatible structure so the project can adopt the official CLI later.

## Change Layout

Each change lives under:

```text
openspec/changes/<change>/
  proposal.md
  tasks.md
  acceptance.md
  notes.md
```

## Lifecycle

1. Explore the request.
2. Propose a scoped change.
3. Plan the implementation.
4. Apply tasks.
5. Verify acceptance criteria.
6. Finish with `codepilot check` and a harness report.
