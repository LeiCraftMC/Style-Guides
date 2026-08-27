# CLAUDE.md

This is the Claude-Code-specific layer for the LeiCraftMC Style Guides repo. The full operating
manual for AI agents (which applies to every tool, Claude Code included) is in
[`AGENTS.md`](AGENTS.md) — read that first. This file adds only what is specific to Claude Code.

## What this repo is

A style guide + shared utilities + brand assets + project templates for the LeiCraftMC ecosystem.
There is no application to run here; the "code" is [`shared/`](shared/) (canonical, copy-paste
utilities) and [`templates/`](templates/) (project scaffolds). Both must stay Biome-clean and
type-correct.

## When working *in this* repo

- The guide itself follows its own rules: format with Biome, type-check with `tsc`.
- Slash commands, MCP servers, and `fileScan.exclude` are defined in
  [`.claude/settings.json`](.claude/settings.json):
  - `/verify` — run Biome + typecheck and report pass/fail.
  - `/typecheck` — `bun run typecheck`.
  - `/format` — `bunx biome format --write` then `biome check`.
  - `/test` — `bun run test`.
  - `mcpServers` registers `nuxt` and `nuxt-ui` — useful when editing
    [`templates/nuxt-app/`](templates/nuxt-app/) or [`shared/frontend/`](shared/frontend/).
- Do **not** add `permissions.allow` rules to `.claude/settings.json` on your own initiative; the
  user manages permission grants. Ship only `commands`, `mcpServers`, and `fileScan`.

## When working *in a LeiCraftMC project* (not this repo)

Follow [`AGENTS.md`](AGENTS.md) exactly. In particular: never hand-edit `*.gen.ts`; always use the
`{ success, code, message, data }` envelope; validate with `hono-openapi`'s `zValidator`; copy
shared utilities from [`shared/`](shared/) rather than re-implementing; format with Biome; write
Conventional Commits.

## Where to look

- The spec: [`docs/`](docs/) (00 → 17).
- Reusable code: [`shared/`](shared/) (`backend/`, `frontend/`, `cli/`, `config/`, `tsconfig/`).
- Scaffolds: [`templates/`](templates/) (`backend-service/`, `nuxt-app/`, `fullstack-nuxt-app/`, `static-site/`, `cli-tool/`).
- Brand: [`assets/`](assets/).
- Opinionated calls and why: [`docs/17-decisions.md`](docs/17-decisions.md).