# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Defined in `.claude/settings.json`:

- `/verify` — typecheck + relevant tests.
- `/typecheck` — `bun run typecheck`.
- `/test` — `bun test` (focused file or full suite).

## MCP servers

This is a backend service, so it ships no MCP config. Add `mcpServers` to `.claude/settings.json`
and a `.vscode/mcp.json` only if it grows a Nuxt frontend (see
[`shared/config/claude-settings.nuxt.json`](../../shared/config/claude-settings.nuxt.json)).

## Project prefix

Replace `SVC_` in `src/utils/config.ts` and `example.env` with the real project prefix before
writing domain code.
