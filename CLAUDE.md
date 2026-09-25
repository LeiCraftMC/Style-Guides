# CLAUDE.md

This is the Claude-Code-specific layer for the LeiCraftMC Style Guides repo. The full operating
manual for AI agents (which applies to every tool, Claude Code included) is in
[`AGENTS.md`](AGENTS.md) — read that first. This file adds only what is specific to Claude Code.

## What this repo is

A style guide + shared utilities + brand assets + project templates for the LeiCraftMC ecosystem.
There is no application to run here; the "code" is [`templates/`](templates/) (project scaffolds —
the source of truth) and [`shared/`](shared/) (verbatim copies of the templates' core files, at the
same relative paths). Both must stay Biome-clean and type-correct, and `shared/` must match the
templates.

## When working *in this* repo

- The guide itself follows its own rules: format with Biome, type-check with `tsc`.
- Slash commands, MCP servers, and `fileScan.exclude` are defined in
  [`.claude/settings.json`](.claude/settings.json):
  - `/verify` — run Biome + typecheck and report pass/fail.
  - `/typecheck` — `bun run typecheck`.
  - `/format` — `bun run format` then `bun run check:ci`.
  - `/test` — `bun run test`.
  - `mcpServers` registers `nuxt` and `nuxt-ui` — useful when editing the Nuxt templates
    (`nuxt-app`, `fullstack-nuxt-app`, `static-site*`) or [`shared/frontend/`](shared/frontend/).
- The root Biome config excludes `templates/` and `shared/config/`. After changing a template, run
  its own `bun run check:ci`, `bun run typecheck` and `bun test` inside the template, then update the
  matching `shared/` copy. Under Bun, `nuxt typecheck` does not type-check `.vue` files (see
  [docs/02](docs/02-tooling.md)), so review `.vue` changes carefully.
- Do **not** add `permissions.allow` rules to `.claude/settings.json` on your own initiative; the
  user manages permission grants. Ship only `commands`, `mcpServers`, and `fileScan`.

## When working *in a LeiCraftMC project* (not this repo)

Follow [`AGENTS.md`](AGENTS.md) exactly. In particular: never hand-edit `*.gen.ts`; always use the
`{ success, code, message, data }` envelope; validate with `hono-openapi`'s `validator` (imported as
`zValidator`); copy core files from [`shared/`](shared/) rather than re-implementing; format with
Biome; write Conventional Commits.

## Where to look

- The spec: [`docs/`](docs/) (00 → 17).
- Reusable code: [`shared/`](shared/) (`backend/`, `frontend/`, `cli/`, `config/`, `tsconfig/`).
- Scaffolds: [`templates/`](templates/) (`backend-service/`, `nuxt-app/`, `fullstack-nuxt-app/`, `static-site/`, `static-site-with-docs/`, `cli-tool/`).
- Brand: [`assets/`](assets/).
- Opinionated calls and why: [`docs/17-decisions.md`](docs/17-decisions.md).