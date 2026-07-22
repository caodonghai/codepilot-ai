# API Rules

## Request Handling

- Follow each app's existing request utilities and model patterns.
- Keep request and response types close to existing app conventions.
- Do not rename backend fields or normalize payload shapes unless the active change requires it.

## Error Handling

- Preserve existing error-message and notification behavior.
- Add defensive handling for nullable or missing backend fields when rendering UI.
- Keep mock changes aligned with real API assumptions.
