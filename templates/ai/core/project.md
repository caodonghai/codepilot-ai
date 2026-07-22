# MsgFi React Project Context

This repository is a pnpm 7 + Turborepo monorepo for MsgFi web and mobile front-end applications.

## Structure

- `apps/web/*`: Umi/React web applications.
- `apps/mobile/*`: Umi/React mobile applications.
- `packages/web/*`: shared web packages.
- `packages/mobile/*`: shared mobile packages.
- `packages/core/*`: cross-platform shared packages.
- `web-shared` and `mobile-shared`: shared app entry packages.
- `scripts`: project build and app-management scripts.

## Baseline Commands

- Install dependencies with `pnpm i`.
- Run lint with `pnpm eslint`.
- Build through existing project scripts when explicitly requested.
- Use `pnpm ai check` for the default AI workflow gate.

## AI Working Rule

Before changing code, identify the active OpenSpec-compatible change under `openspec/changes/<change>` and keep edits inside that change's stated scope.
