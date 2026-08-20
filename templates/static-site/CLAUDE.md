# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Use the commands in `.claude/commands/`:

- `/verify` — run Biome + typecheck.
- `/typecheck` — `bun run typecheck`.
- `/format` — format and lint with Biome.

## MCP servers

`.vscode/mcp.json` registers `nuxt` and `nuxt-ui` MCP servers for component/styling help.

## Static generation

Run `bun run generate` before deploying. The output is in `.output/public/`.
