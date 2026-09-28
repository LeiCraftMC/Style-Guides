# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Defined in `.claude/settings.json`:

- `/verify` — `bun test` + `bun run build`.
- `/typecheck` — `bun run typecheck`.
- `/test` — `bun test`.

## MCP servers

`mcpServers` in `.claude/settings.json` and `.vscode/mcp.json` both register `nuxt` and `nuxt-ui`
for component/styling help.

## Static generation

Run `bun run generate` before deploying. The output is in `.output/public/`.

## Docs

Docs are markdown files in `content/docs/`. The sidebar and prev/next links are driven by
`app/data/docs.ts`. The docs renderer is `app/pages/docs/[...slug].vue` and uses
`app/components/docs/DocsPage.vue` for layout.
