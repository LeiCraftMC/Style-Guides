# AGENTS.md — operating manual for AI coding agents

You are an AI coding agent working in a **LeiCraftMC** repository
(`git.leicraftmc.de/LeiCraftMC` / `github.com/LeiCraftMC` namespace — LeiOS, Delivr, NowIP,
NetIgnite, Vault, MindCode, the LeiCraftMC sites, …). This file tells you how to work here. The
authoritative detail lives in [`docs/`](docs/); this is the short version.

## Before you write any code

1. Read [`docs/00-overview.md`](docs/00-overview.md), then the page(s) relevant to your task:
   backend → [`04`](docs/04-backend-hono.md) + [`05`](docs/05-api-contract.md) + [`08`](docs/08-database.md);
   frontend → [`06`](docs/06-frontend-nuxt.md) + [`07`](docs/07-state-and-data.md);
   CLI/infra → [`11`](docs/11-cli-and-infra.md); tests → [`12`](docs/12-testing.md);
   git/CI/deploy → [`13`](docs/13-git-and-ci.md) + [`14`](docs/14-deployment.md).
2. Match the **existing** code in the repo you're in. This guide codifies that style; when the repo
   and the guide disagree on a minor point, follow the repo and flag it. Do not import generic
   internet patterns (Pinia, ESLint, `@hono/zod-validator`, REST "best practices", etc.) that the
   ecosystem does not use.

## Non-negotiable rules

- **Never hand-edit `*.gen.ts`** or anything under `app/api-client/`. These are generated from the
  backend's OpenAPI spec by `bun run api-client:generate`. If the contract is wrong, fix the
  backend route + Zod schema and regenerate.
- **Every API response uses the `{ success, code, message, data }` envelope** via the `APIResponse`
  helper — never raw `c.json(...)`. See [`docs/05-api-contract.md`](docs/05-api-contract.md).
- **Validate with Zod** through `hono-openapi`'s `zValidator` (not `@hono/zod-validator`) so the
  schema is reflected in the OpenAPI spec. See [`docs/04-backend-hono.md`](docs/04-backend-hono.md).
- **New utilities already exist in [`shared/`](shared/)** — `Logger`, `ConfigSchema`, `APIResponse`,
  `useAPI`, `abstractStore`, the compile scripts, the tsconfig base. Copy them in; do not re-invent.
- **Format with Biome** before finishing. The repo has a `biome.json`; run `bunx biome check`.
- **Conventional Commits** only: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, with an
  optional scope (`feat(api): …`). No casual messages.

## Backend (Hono + Zod + OpenAPI + Drizzle)

- Static `API` class with `init`/`start`/`stop`; `Bun.serve`; `prettyJSON` → `cors` → `onError`
  (never leak Zod details) → versioned routers → `/health`.
- Routes live in `routes/<resource>/{index.ts, model.ts}`. `model.ts` groups Zod schemas in a
  `namespace <ResourceModel>.<Operation>` with paired `export type X = z.infer<typeof X>`.
- Derive request/response schemas from Drizzle with `drizzle-zod` (`createSelectSchema` / `createInsertSchema`
  + `.omit()/.extend()/.partial()/.refine()`).
- Document with `APIRouteSpec.authenticated/unauthenticated` + `APIResponseSpec.*`; centralize tags
  in `DOCS_TAGS`.

## Frontend (Nuxt 4 + NuxtUI v4 + Tailwind v4)

- Nuxt 4 `app/` srcDir. `app.vue` = `<UApp><NuxtLayout><NuxtPage/></NuxtLayout></UApp>`.
- Tailwind v4 CSS-first in `app/assets/css/main.css` (`@import "tailwindcss"; @import "@nuxt/ui";`)
  — **no `tailwind.config.js`**. Dark-first.
- All API access through the `useAPI` composable (wraps the generated SDK); state through
  `AbstractStore` over `useState` (SSR-safe). Do **not** use raw `$fetch`/`useFetch` for the API,
  and do **not** use static `reactive()` stores (they are not SSR-safe).

## Tooling & finishing

- Bun runtime; `bun test`; `bun run typecheck` (`tsc --noEmit` against the typecheck tsconfig).
- Before declaring done: `bunx biome check` clean, `bun run typecheck` passes, `bun test` passes.
- If you created a new project from a template, replace every `<PREFIX>`, `<PORT>`, and
  `<ProjectName>` placeholder.

When unsure about a convention, search [`docs/`](docs/) and [`shared/`](shared/) first.