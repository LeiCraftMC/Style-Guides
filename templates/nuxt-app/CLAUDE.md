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
