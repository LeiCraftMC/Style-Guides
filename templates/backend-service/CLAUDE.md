# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Use the commands in `.claude/commands/`:

- `/verify` — run Biome + typecheck + tests.
- `/typecheck` — `bun run typecheck`.
- `/format` — format and lint with Biome.

## MCP servers

`.vscode/mcp.json` registers `nuxt` and `nuxt-ui` MCP servers for when this service grows a frontend.

## Project prefix

Replace `SVC_` in `src/utils/config.ts` and `example.env` with the real project prefix before
writing domain code.
