# 00 — Overview

This is the LeiCraftMC engineering style guide. It describes how code is written, designed, and
structured across every repo in the `git.leicraftmc.de/LeiCraftMC` & `github.com/LeiCraftMC`
namespace — LeiOS, Delivr, NowIP, NetIgnite, Vault, MindCode, the LeiCraftMC sites, and whatever
comes next.

## Who this is for

- **Contributors** — read these pages before writing code so your work matches the house style and
  slots into the existing patterns without re-invention.
- **AI coding tools** — start at [`AGENTS.md`](../AGENTS.md) (or [`CLAUDE.md`](../CLAUDE.md)),
  then read the page(s) relevant to your task. Copy utilities from [`shared/`](../shared/) and
  scaffold from [`templates/`](../templates/) instead of inventing patterns.

## Tech stack at a glance

| Layer | Choice |
| --- | --- |
| Runtime & package manager | **Bun** — also the test runner (`bun test`) and the Nuxt Nitro preset |
| Language | **TypeScript**, ESM (`"type": "module"`), `"private": true`, strict |
| Formatter & linter | **Biome** — single tool, the org standard (see [02](02-tooling.md)) |
| Backend | **Hono** + **Zod** + **hono-openapi** (Scalar UI) + **Drizzle** (SQLite by default) |
| Frontend | **Nuxt 4** (`app/` dir) + **NuxtUI v4** + **Tailwind v4** (CSS-first, no config file) |
| CLI tooling | **`@cleverjs/cli`** + `bun build --compile` (single-binary output) |
| API contract | OpenAPI generated at runtime → `@hey-api/openapi-ts` typed client (never hand-edit) |
| Response shape | `{ success, code, message, data }` envelope, end-to-end |
| CI | GitLab CI (`oven/bun`) and/or GitHub Actions; **Renovate** everywhere |
| License | **AGPL-3.0** (templates & services) |
| Commits | **Conventional Commits** |

## The guiding principle

> **Codify reality, then decide the divergences.**

Almost everything in this guide is already the de-facto standard somewhere in the ecosystem —
the patterns were extracted by auditing 14 real repos. Where the repos agreed, the guide records
the agreement. Where they drifted (formatter, commit style, license, the `useAPI`/`abstractStore`
duplicates), the guide makes one opinionated call and documents it in
[17 — Decisions & divergences](17-decisions.md).

This means: **the existing codebase plus this guide are the authority.** Generic internet advice
(Pinia, ESLint, `@hono/zod-validator`, "REST best practices") is not a substitute — if a pattern
isn't here and isn't in the repo you're working in, ask before introducing it.

## How to read this

Read top to bottom on a first pass; jump to a page on demand. The pages are grouped:

- **Foundations** — [01 structure](01-project-structure.md), [02 tooling](02-tooling.md),
  [03 naming & TS](03-naming-and-typescript.md).
- **Backend** — [04 Hono](04-backend-hono.md), [05 API contract](05-api-contract.md),
  [08 database](08-database.md), [09 config & logging](09-config-and-logging.md),
  [10 auth](10-auth.md).
- **Frontend** — [06 Nuxt](06-frontend-nuxt.md), [07 state & data](07-state-and-data.md).
- **Tooling beyond the app** — [11 CLI & infra](11-cli-and-infra.md), [12 testing](12-testing.md),
  [13 git & CI](13-git-and-ci.md), [14 deployment](14-deployment.md).
- **Look & AI** — [15 design system](15-design-system.md), [16 AI tooling](16-ai-tooling.md).
- **Why** — [17 decisions](17-decisions.md).

Reusable code lives in [`shared/`](../shared/) (canonical, copy-paste) and ready-made projects in
[`templates/`](../templates/). Brand assets in [`assets/`](../assets/).