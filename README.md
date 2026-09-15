# LeiCraftMC Style Guides

The single source of truth for how code is written, designed, and structured across the
**LeiCraftMC** ecosystem — `git.leicraftmc.de/LeiCraftMC` & `github.com/LeiCraftMC` — and all of
its subprojects: **LeiOS**, **Delivr**, **NowIP**, **NetIgnite**, **Vault**, **MindCode**, the
LeiCraftMC sites, and everything that comes after.

This repo is for **two audiences**:

- **Humans** — read [`docs/`](docs/) in order to learn the house style before contributing.
- **AI coding tools** — read [`AGENTS.md`](AGENTS.md) (or [`CLAUDE.md`](CLAUDE.md) for Claude Code)
  first, then the relevant `docs/` pages. Copy from [`shared/`](shared/) and scaffold from
  [`templates/`](templates/) instead of inventing patterns.

Everything here is derived from how the ecosystem **already** writes code (14 reference repos were
audited), then makes opinionated calls to close the gaps where practice diverged.

## Tech stack at a glance

| Layer | Choice |
| --- | --- |
| Runtime & package manager | **Bun** (also the test runner and Nitro preset) |
| Language | **TypeScript**, ESM, `"private": true`, strict |
| Formatter & linter | **Biome** (org standard — see [`docs/02-tooling.md`](docs/02-tooling.md)) |
| Backend | **Hono** + **Zod** + **hono-openapi** (Scalar UI) + **Drizzle** (SQLite) |
| Frontend | **Nuxt 4** (`app/` dir) + **NuxtUI v4** + **Tailwind v4** (CSS-first) |
| CLI tooling | **`@cleverjs/cli`** + `bun build --compile` |
| API contract | OpenAPI generated at runtime → `@hey-api/openapi-ts` typed client |
| Response shape | `{ success, code, message, data }` envelope, end-to-end |
| CI | GitLab CI (`oven/bun`) and/or GitHub Actions; **Renovate** everywhere |
| License | **AGPL-3.0** (templates) |
| Commits | **Conventional Commits** |

## Repo layout

```
Style-Guides/
├── README.md            ← you are here
├── AGENTS.md            ← read this first if you are an AI coding agent
├── CLAUDE.md            ← Claude-Code-specific layer on top of AGENTS.md
├── docs/                ← the spec, one focused page per topic (00 → 17)
├── shared/              ← canonical, copy-paste utilities + config (logger, config, APIResponse, useAPI, …)
├── assets/              ← brand logos, icons, and design-system guidance
└── templates/           ← ready-to-use scaffolds (backend-service, nuxt-app, fullstack-nuxt-app, static-site, cli-tool)
```

## How to use this

**Starting a new project** — copy a template from [`templates/`](templates/), then follow its
`README.md` (replace the `<PREFIX>`, `<ProjectName>`, and **port** placeholders — each app gets a
unique port, never `3000`; see [docs/02 — Ports](docs/02-tooling.md#ports--one-unique-port-per-app-dev--prod)).
Pull shared utilities from [`shared/`](shared/) rather than re-implementing them.

**Contributing to an existing project** — read the relevant [`docs/`](docs/) pages first. When in
doubt, the existing codebase + this guide are the authority; generic internet advice is not.

**As an AI agent** — start at [`AGENTS.md`](AGENTS.md).

## The spec — `docs/`

Read top to bottom on first pass; jump to a page on demand.

1. [00 — Overview](docs/00-overview.md) — purpose, audience, the guiding principle
2. [01 — Project structure](docs/01-project-structure.md) — repo layout per project type
3. [02 — Tooling](docs/02-tooling.md) — Bun, TypeScript, Biome, scripts, Renovate, MCP
4. [03 — Naming & TypeScript style](docs/03-naming-and-typescript.md)
5. [04 — Backend (Hono)](docs/04-backend-hono.md) — app lifecycle, routes, OpenAPI, the envelope
6. [05 — API contract](docs/05-api-contract.md) — OpenAPI as the bridge, generated client
7. [06 — Frontend (Nuxt)](docs/06-frontend-nuxt.md) — Nuxt 4, NuxtUI v4, Tailwind v4
8. [07 — State & data](docs/07-state-and-data.md) — `useAPI`, `AbstractStore`, cookies
9. [08 — Database](docs/08-database.md) — Drizzle, the `DB` class, migrations
10. [09 — Config & logging](docs/09-config-and-logging.md) — `ConfigSchema`, `Logger`
11. [10 — Auth](docs/10-auth.md) — opaque tokens, `AuthContext`, middleware
12. [11 — CLI & infra](docs/11-cli-and-infra.md) — `@cleverjs/cli`, compile, graceful shutdown
13. [12 — Testing](docs/12-testing.md) — `bun:test`, the preload harness, integration tests
14. [13 — Git & CI](docs/13-git-and-ci.md) — Conventional Commits, GitLab/GitHub pipelines
15. [14 — Deployment](docs/14-deployment.md) — compiled-binary Docker, Nuxt Bun preset, registries
16. [15 — Design system](docs/15-design-system.md) — dark-first, palette, fonts, logos, status semantics
17. [16 — AI tooling](docs/16-ai-tooling.md) — `CLAUDE.md`/`AGENTS.md`, `.claude/settings.json` commands, MCP
18. [17 — Decisions & divergences](docs/17-decisions.md) — the opinionated calls and why

## Locked decisions

Four foundational standards were set for the org (rationale in
[`docs/17-decisions.md`](docs/17-decisions.md)):

- **Biome** for formatting + linting (the ecosystem had no enforced formatter before).
- **AGPL-3.0** as the default license for templates and services.
- **Copy-paste snippets now, published `@leicraftmc/*` package later** for shared utilities.
- **Conventional Commits** (`feat:` / `fix:` / `chore:` …).

## Contributing

This guide is itself a LeiCraftMC project: it is formatted with Biome and type-checked with `tsc`.
Before committing, run `bun install && bun run check:ci && bun run typecheck`. The
`/verify`, `/typecheck`, `/format`, and `/test` helper slash commands are defined in
[`.claude/settings.json`](.claude/settings.json) (see [docs/16](docs/16-ai-tooling.md)).

## License

[AGPL-3.0](LICENSE). The shared utilities and templates inherit it by default; permissive licensing
for standalone libraries/tools is a case-by-case decision (see
[`docs/17-decisions.md`](docs/17-decisions.md)).