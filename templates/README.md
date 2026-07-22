# Templates

This directory contains the first package-owned default template snapshot.

Current state:

- `.ai/core`, `.ai/flows`, `superpowers/skills`, `openspec/project.md`, and `harness/config.json` have been seeded from the current working repository.
- `manifest.json` records which paths are package templates, generated sync outputs, and project-owned state.
- The working implementation still keeps some fallback templates embedded in `scripts/ai/cli.ts`.
- Project-owned generated files remain in the repository root, such as `.ai`, `openspec`, `superpowers`, `harness`, `AGENTS.md`, `.codex`, `.trae`, `.qoder`, and `.cursor`.
- The next migration step is to extract the embedded default content into this directory without changing generated project behavior.

Target structure:

```text
templates/
  ai/
    core/
    flows/
  superpowers/
    skills/
  openspec/
    project.md
  harness/
    config.json
  targets/
    codex/
    trae/
    qoder/
    cursor/
```
