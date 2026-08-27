# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Defined in `.claude/settings.json`:

- `/api-client` — regenerate the typed API client (reads `/api/docs/v1/openapi`).
- `/db` — run Drizzle migrations.
- `/verify` — typecheck + tests.
- `/typecheck` — `bun run typecheck` (`nuxt typecheck` + `tsc`, includes `server/`).
- `/test` — `bun test`.
- `/dev` — start/inspect the dev setup.

## MCP servers

`mcpServers` in `.claude/settings.json` and `.vscode/mcp.json` both register `nuxt` and `nuxt-ui`.

## Backend in `server/`

This is the full-stack shape: Hono lives in `server/lib/api`, mounted at `/api` by
`server/routes/api/[...].ts`, and initialized by `server/plugins/startup.ts`. After changing a
backend route, regenerate the client with `bun run api-client:generate`. Never hand-edit
`app/api-client/*.gen.ts`.