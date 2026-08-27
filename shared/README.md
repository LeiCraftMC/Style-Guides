# shared/ — canonical, copy-paste utilities & config

This directory holds the **canonical versions** of the utilities that LeiCraftMC projects
currently copy-paste (with drift) between repos. When you start a new project, copy what you need
from here instead of re-implementing it.

> **These are snippets, not a published package — yet.** See the
> [package roadmap](#package-roadmap) below for the planned evolution into a real
> `@leicraftmc/*` workspace package.

## Layout

```
shared/
├── tsconfig/        # the byte-identical tsconfig.base.json + tsconfig.typecheck.json
├── config/          # gitignore, renovate.json, mcp.json, GitLab CI, GitHub Actions (copy the root biome.json)
├── backend/         # Hono service utilities (logger, config, APIResponse, spec helpers, …)
├── frontend/        # Nuxt app utilities (useAPI, abstractStore, cookies, main.css, …)
└── cli/             # @cleverjs/cli utilities (logger with history, VersionCMD, compile scripts)
```

## How to use

1. Copy the file(s) you need into the matching location in your project.
2. Replace the `<PREFIX>` placeholder (env var + cookie name prefix, e.g. `DLA_`, `NOWIP_`,
   `MINDCODE_`) and any `<PORT>` / `<ProjectName>` placeholders.
3. Adjust the project-specific bits (the `ConfigHandler` schema, `DOCS_TAGS`, the `useAppCookies`
   cookie name, the `app.config.ts` primary color, the `biome.json` if you need overrides).
4. `bun install`, then `bunx biome check` and `bun run typecheck` to confirm.

### What's type-checked here

The guide repo itself type-checks `shared/backend/**` and `shared/cli/**` (both depend only on
packages installed as devDeps here). `shared/frontend/**` relies on Nuxt auto-imports (`useCookie`,
`useState`, `ref`, `navigateTo`, …) and is type-checked inside a real Nuxt app after copying, not
in this repo.

## backend/

| File | What it is |
| --- | --- |
| `logger.ts` | `Logger` static class — leveled logging (`debug/info/warn/error/critical`), ISO timestamps, `LogLevel` namespace. |
| `config-schema.ts` | `ConfigSchema` typed env builder + `ConfigHandler` pattern — `.add(KEY, required, enumOrBoolean?)` → `.parse()`, exits on missing required. |
| `api-response.ts` | The `{ success, code, message, data }` envelope: `APIResponse.*` helpers + `APIResponse.Schema.*` / `APIResponse.Utils.*` Zod factories. |
| `spec-helpers.ts` | `APIRouteSpec` (`authenticated`/`unauthenticated`/`custom`) + `APIResponseSpec` (`success`/`created`/`badRequest`/…) — hono-openapi `describeRoute` wrappers. |
| `api-version-router.ts` | `APIVersionRouter` abstract base for mounting `/v{n}` routers. |
| `main-shutdown.ts` | `registerShutdownHandlers()` — SIGINT/SIGTERM/uncaughtException/unhandledRejection with graceful + forced shutdown. |
| `sql-utils.ts` | `SQLUtils.getCreatedAtColumn`/`primaryKeyIntAutoIncrement` (SQLite/PostgreSQL/MySQL) + `DrizzleDB`/`DrizzleTx` types. |
| `make-api-request.ts` | Test helper: drives a Hono app in-process, asserts status, validates the envelope with Zod. |

## frontend/

| File | What it is |
| --- | --- |
| `useAPI.ts` | The single gateway to the generated API SDK — SSR `useAsyncData` + client auth + 401→login, normalizes errors into the envelope. |
| `updateAPIClient.ts` | Sets `baseURL` + `Authorization: Bearer` on the generated `client` (`ignoreResponseError: true`). |
| `useAppCookies.ts` | `AppCookie` wrapper around `useCookie` + `useAppCookies()` factory. |
| `abstractStore.ts` | `BasicAbstractStore` / `*WithMetadata` / `ModifiableAbstractStore` over `useState` (SSR-safe) + `useXxxStore()` factory pattern. |
| `useAwaitedComputed.ts` | Async `computed()` — resolves a `Promise<T>` getter into a `ComputedRef<T>`. |
| `routeMatcher.ts` | `SimpleRouteMatcher` — Nuxt-style `[param]` route matching for allowlists. |
| `rewrites.global.ts` | Trailing-slash stripper route middleware. |
| `main.css` | Tailwind v4 CSS-first entry: `@import "tailwindcss"; @import "@nuxt/ui";` + `@theme` font + dark `:root` + `.main-bg-color`. |
| `app.config.ts` | NuxtUI `defineAppConfig` shape — `ui.colors` + `theme`. |

## cli/

| File | What it is |
| --- | --- |
| `logger.ts` | `Logger` with a `logHistory` buffer + `getLogHistory()` for crash dumps (the superset of `backend/logger.ts`). |
| `version-cmd.ts` | `VersionCMD` (`@cleverjs/cli`) — prints `process.env.APP_VERSION`. |
| `compile/` | The `bun build --compile` trio (`index`/`compiler`/`compileCMD`) — produces standalone binaries per target. |
| `cli-app.example.ts` | A `CLIApp` skeleton: global `--log-level` flag, command registration, `.handle(process.argv.slice(2), "shell")`. |

## config/

Drop-in config files: `gitignore`, `renovate.json`, `mcp.json` (`.vscode/mcp.json`), GitLab CI
(`testing.yml` + `build.yml` + the top-level `.gitlab-ci.yml`), and GitHub Actions (`ci.yml` +
`release.yml`). Claude Code config: `claude-settings.backend.json` /
`claude-settings.nuxt.json` / `claude-settings.fullstack.json` (copy to `.claude/settings.json` — see
[`docs/16-ai-tooling.md`](../docs/16-ai-tooling.md)). The
canonical `biome.json` lives at the repository root so the guide repo has a single formatter/linter
config; copy the root `biome.json` into new projects.

## Package roadmap

Today every repo copy-pastes these utilities, which drifts. The plan is to evolve this directory
into a published **`@leicraftmc/*`** workspace (e.g. `@leicraftmc/api`, `@leicraftmc/nuxt`,
`@leicraftmc/cli`, `@leicraftmc/config`) on the org's Gitea/GitHub registry, so repos `import`
one version instead of copying. That migration is **out of scope** for this guide; the snippets
here are the interim source of truth and are deliberately written so the package split is a
mechanical move later (each file already groups its exports under namespaced `class`/`namespace`
boundaries). See [`docs/17-decisions.md`](../docs/17-decisions.md).