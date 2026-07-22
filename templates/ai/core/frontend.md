# Frontend Rules

## Stack

- React 18.
- Umi Max 4.
- Ant Design 5 for web UI.
- Existing app and package conventions take priority over new abstractions.

## Implementation Rules

- Reuse local components, hooks, request helpers, models, and utilities before adding new ones.
- Keep changes scoped to the selected application or shared package.
- Preserve existing route, model, locale, and proxy patterns.
- Include loading, empty, error, permission, and disabled states when the feature naturally needs them.
- Do not introduce a new state-management or UI framework without an explicit OpenSpec change.

## Review Focus

- Business behavior must match the active change.
- UI text must fit its container and follow existing application language.
- Shared package edits require extra caution because they affect multiple apps.
