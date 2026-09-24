# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Defined in `.claude/settings.json`:

- `/api-client` — regenerate the typed API client.
- `/verify` — typecheck + tests.
- `/typecheck` — `bun run typecheck` (`nuxt typecheck` + `tsc`).
- `/test` — `bun test`.
- `/dev` — start/inspect the dev setup.

## MCP servers

`mcpServers` in `.claude/settings.json` and `.vscode/mcp.json` both register `nuxt` and `nuxt-ui`.
Use them when editing components, composables, or NuxtUI styling.

## API client

Run `bun run api-client:generate` after backend route changes. The generated files live in
`app/api-client/`.

## Frontend conventions

- Route map and access rules: see the header of `app/middleware/auth.global.ts` and the Frontend
  section of `README.md`. The template is deliberately rich; delete unused parts instead of
  working around them.
- Reference components by their Nuxt auto-import names (`LayoutHeader`, `ImgAppLogo`,
  `DashboardDataTable`, `FormDateRangePicker`, …). Don't add explicit imports that only the
  `<template>` uses: Biome can't see template usage, reports them as unused, and an `--unsafe` fix
  would delete them.
- If a `<script>` binding is used as a type there and as a value in the `<template>` (e.g. a Zod
  schema for `UForm :schema`), also reference it as a value in `<script>`
  (`const createSchema = zPostAdminUsersBody`). Otherwise Biome's `useImportType` safe fix turns it
  into `import type` and breaks the page at runtime.
- In `.vue` files, Biome *warnings* about unused variables/imports are expected (template usage).
  Biome *errors* are not.
- `bun run typecheck` does not type-check `.vue` files under Bun: vue-tsc's TypeScript patch is
  bypassed by Bun's module loader. Don't treat a passing typecheck as proof a page is correct.
- Per-user stores live in `app/composables/stores/` (`useUserInfoStore`, `useOnboardingStore`).
  Clear them on logout; the login page refreshes/clears them for the new session.
