# shared/ — the core files every LeiCraftMC project copies

This directory holds **verbatim copies of the core files from [`templates/`](../templates/)** — the
utilities and config that almost every project needs, so you can pull them into an existing repo
without scaffolding a whole template. The templates are the source of truth; `shared/` mirrors them.

> **These are snippets, not a published package — yet.** See the
> [package roadmap](#package-roadmap) below.

## Layout: mirrored paths

Each area mirrors the folder layout of the template it comes from, so **the path inside `shared/`
is the path in your project**: copy `shared/backend/src/utils/config.ts` to `src/utils/config.ts`,
`shared/frontend/app/composables/useAPI.ts` to `app/composables/useAPI.ts`, and so on. Relative
imports between the copied files keep working.

```
shared/
├── backend/    # from templates/backend-service   (src/…, tests/helpers/…)
├── cli/        # from templates/cli-tool          (src/…, scripts/…)
├── frontend/   # from templates/nuxt-app          (app/…, scripts/…) + fullstack variants
├── config/     # CI, Claude Code, Biome, Renovate, gitignore, bunfig — flat, copy to the named location
└── tsconfig/   # tsconfig.base.json + typecheck configs
```

**Feature modules stay template-only**: email, background tasks, cron jobs, crypto, user preferences,
runtime metadata, the DB schema, routes, pages/layouts, Docker files, `.htaccess`. Copy those from
the template directly (see the links in [`docs/`](../docs/)).

## How to use

1. Copy the file(s) you need to the same relative path in your project.
2. Replace the placeholders: `<ProjectName>`, the `APPPREFIX` env prefix and `appprefix` token prefix
   (`src/utils/constants.ts`), the `<PREFIX>` session-cookie name (`useAppCookies.ts`), the default
   port, and `AppConstants.BINARY_NAME`.
3. Adjust the project-specific bits (the config schema in `config.ts`, `DOCS_TAGS`, the guard
   constants in `auth.global.ts`, the `app.config.ts` primary color).
4. `bun install`, then `bun run check:ci`, `bun run typecheck` and `bun test`.

### What's type-checked here

The guide repo type-checks `shared/backend/**` and `shared/cli/**` with `bun run typecheck`, except
the files that import template modules `shared/` deliberately doesn't carry (DB schema, crypto, the
API class): `backend/src/api/utils/authHandler.ts`, `backend/src/api/versions/v1/middleware/auth.ts`
and `backend/tests/**` — they are type-checked in the templates. `shared/frontend/**` relies on Nuxt
auto-imports and is checked inside the Nuxt templates.

## backend/ (from `templates/backend-service`)

| File | What it is |
| --- | --- |
| `src/api/utils/api-res.ts` | The `{ success, code, message, data }` envelope: `APIResponse.*` helpers + `APIResponse.Schema/Utils/Types` Zod factories. |
| `src/api/utils/specHelpers.ts` | `APIRouteSpec` (`authenticated`/`unauthenticated`/…) + `APIResponseSpec` — hono-openapi `describeRoute` wrappers. |
| `src/api/utils/apiVersionRouter.ts` | `APIVersionRouter` base for mounting `/v{n}` routers with their OpenAPI config. |
| `src/api/utils/authHandler.ts` | Opaque bearer-token auth: `AuthUtils`, `SessionHandler`, `APIKeyHandler`, `AuthHandler` (+ `AuthContext` helpers). Needs the template's DB schema + `LCrypt`. |
| `src/api/versions/v1/middleware/auth.ts` | `authMiddlewareV1` — resolves the `AuthContext`; public auth paths stay reachable with a stale token. |
| `src/utils/config.ts` | `ConfigHandler` + the Zod `CS` builder (`CS.string()/number()/boolean()/enum()/array()`). Booleans: any non-empty value is true. |
| `src/utils/constants.ts` | `AppConstants` — app name, `APPPREFIX`/`appprefix`, default port, `BINARY_NAME`. |
| `src/utils/logger.ts` | `Logger` — leveled logging with ISO timestamps. |
| `src/utils/index.ts` | `Utils` — small helpers (`getRandomU32`, `splitNTimes`, `sleep`, `ensureDirectoryExists`, `mergeObjects`, …). |
| `src/db/utils.ts` | `SQLUtils` column helpers + `DrizzleDB` types. |
| `src/utils/runtime.ts` | **Optional, unused by the templates** — `Runtime` for Bun + Cloudflare dual-target apps. |
| `tests/helpers/{api,preload,seed}.ts` | Test harness: `makeAPIRequest`, the bunfig preload (temp DB + API), `seedUser`/`seedSession`. |

## frontend/ (from `templates/nuxt-app`)

| File | What it is |
| --- | --- |
| `app/composables/useAPI.ts` | The single gateway to the generated SDK — applies the session token, redirects to login on a missing cookie or any 401, never throws. |
| `app/composables/updateAPIClient.ts` | Standalone frontend (talks to backend-service): `baseURL = <apiUrl>/v1`. |
| `app/composables/updateAPIClient.fullstack.ts` | Full-stack variant: `baseURL = <appUrl>/api/v1` — copy it as `updateAPIClient.ts`. |
| `app/composables/{useRuntimeAppConfigs,useAppCookies,useAwaitedComputed,usePageSeo}.ts` | Runtime config, session cookie, async `computed`, per-page SEO (+ JSON-LD). |
| `app/composables/{useSubrouterInjectedData,useSubrouterPathDynamics}.ts` | Parent→child data + breadcrumbs/SEO/tabs for nested dashboard routes. |
| `app/composables/stores/{useUserStore,useOnboardingStore}.ts` | `useUserInfoStore` (account) and the `/welcome` onboarding flag. |
| `app/middleware/auth.global.ts` | The route guard — tune `HOME_ROUTE`, `PROTECTED_PREFIXES`, `ADMIN_PREFIXES`, `PUBLIC_ROUTES`, `REQUIRE_ONBOARDING`. |
| `app/middleware/rewrites.global.ts` | Trailing-slash stripper. |
| `app/utils/{abstractStore,routeMatcher}.ts` | SSR-safe stores over `useState`; `SimpleRouteMatcher`. |
| `app/components/dashboard/*.vue` | `DashboardPageHeader`, `DashboardPageBody`, `DashboardModal`, `DashboardDeleteModal`, `DataTable` (see docs/15). |
| `app/components/form/DateRangePicker.vue` | Date-range filter used by `DataTable`. |
| `app/app.config.ts`, `app/assets/css/main.css` | NuxtUI theme + Tailwind v4 entry (dark-only). |
| `scripts/patch-api-client.ts` | nuxt-app's automated post-`openapi-ts` patch for known generator typing bugs. |
| `scripts/api-client-generate.ts` | Full-stack: generates the client from the in-process API spec. |

> Generated `*.gen.ts` files are never edited by hand — the automated `patch-api-client.ts` is the
> only exception. See [docs/05](../docs/05-api-contract.md).

## cli/ (from `templates/cli-tool`)

| File | What it is |
| --- | --- |
| `src/index.ts` | The `CLIApp` entry: global `--log-level`, command registration, `.handle(…, "shell")`. |
| `src/commands/{version-cmd,hello-cmd}.ts` | `VersionCMD` (prints `APP_VERSION`) and an example command. |
| `src/utils/{logger,constants}.ts` | CLI `Logger` with `logHistory` for crash dumps; `AppConstants` (`BINARY_NAME`). |
| `scripts/compile/{index,compileCMD,compiler}.ts` | `bun build --compile` per target (`auto`, `all`, `linux-x64`, `linux-x64-baseline`, `linux-arm64`). Services add `--asset ./drizzle/migrations` and turn bytecode off (see docs/11). |
| `scripts/entrypoint.ts` | The binary's entrypoint. |

## config/

| File | Copy to |
| --- | --- |
| `github-actions/ci.yml`, `github-actions/release.yml` | `.github/workflows/` (release: CLI binaries on `v*` tags) |
| `gitlab-ci/gitlab-ci.yml` | `.gitlab-ci.yml` |
| `gitlab-ci/testing.yml` | `.gitlab/ci/testing.yml` |
| `gitlab-ci/build.{docker,service,static}.yml` | `.gitlab/ci/build.yml` — Nuxt image / compiled service image / static rsync deploy |
| `gitlab-ci/deploy.sh` | `.gitlab/ci/deploy.sh` (static sites) |
| `claude-settings.{backend,cli,nuxt,fullstack,static}.json` | `.claude/settings.json` (see [docs/16](../docs/16-ai-tooling.md)) |
| `mcp.json` | `.vscode/mcp.json` |
| `biome.json` | `biome.json` — the template Biome config (not the guide repo's root one) |
| `bunfig.toml` | `bunfig.toml` (services: test preload) |
| `gitignore` | `.gitignore` |
| `renovate.json` | `.gitlab/renovate.json` (minimal on purpose; the org-level Renovate config applies) |

## tsconfig/

`tsconfig.base.json` (extended by backend/CLI `tsconfig.json`), `tsconfig.typecheck.json`
(backend/CLI typecheck) and `tsconfig.typecheck.nuxt.json` (Nuxt apps: type-checks `tests/`; `app/`
is covered by `nuxt typecheck`).

## Package roadmap

Today every repo copy-pastes these utilities, which drifts. The plan is to evolve this directory
into a published **`@leicraftmc/*`** workspace (e.g. `@leicraftmc/api`, `@leicraftmc/nuxt`,
`@leicraftmc/cli`, `@leicraftmc/config`) on the org's registry, so repos `import` one version
instead of copying. That migration is **out of scope** for this guide; the files here are the
interim source of truth. See [`docs/17-decisions.md`](../docs/17-decisions.md).
