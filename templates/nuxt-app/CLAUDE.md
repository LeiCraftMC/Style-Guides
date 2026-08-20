# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Use the commands in `.claude/commands/`:

- `/verify` — run Biome + typecheck + tests.
- `/typecheck` — `bun run typecheck`.
- `/format` — format and lint with Biome.

## MCP servers

`.vscode/mcp.json` registers `nuxt` and `nuxt-ui` MCP servers. Use them when editing components,
composables, or NuxtUI styling.

## API client

Run `bun run api-client:generate` after backend route changes. The generated files live in
`app/api-client/`.
