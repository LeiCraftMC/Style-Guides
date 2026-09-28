# 02 — Tooling

## Bun

Bun is the runtime, package manager, test runner, dev server, and (for server Nuxt apps) the
Nitro preset. The toolchain is Bun-only: CLIs run through `bunx --bun …`, types come from
`bun-types`.

- `bun install` (CI: `bun install --frozen-lockfile`); lockfile is `bun.lock`.
- `bun run dev` → `bun run --watch src/index.ts` (backend/CLI) or `bunx --bun nuxt dev --port <PORT>`
  (Nuxt).
- `bun test` — the test runner (see [12](12-testing.md)).
- `bun run compile` — `bun build --compile` to a standalone binary (see
  [11](11-cli-and-infra.md)).
- Server Nuxt apps (nuxt-app, fullstack-nuxt-app): `build` is `nuxt build --preset bun` (the preset
  is passed on the command line, not set in `nuxt.config.ts`), and `start` is
  `PORT=<PORT> bun run .output/server/index.mjs`.
- Static sites: `nitro: { preset: "static" }` in `nuxt.config.ts` (and `build` is
  `nuxt build --preset static`); deploy the output of `bun run generate`. There is no `start`.

Bun auto-loads `.env` — there is no need for a `dotenv` call in web services (CLI tools that need
an explicit env-file path use `dotenv`'s non-overwriting load; see [09](09-config-and-logging.md)).

## Ports — one unique port per app, dev = prod

**Never default to `3000`.** Every LeiCraftMC app gets its own unique port in the **12xxx** range,
and the dev and prod ports are the **same** number (no separate dev/prod ports). Pick a port that
isn't already used by another app in the ecosystem. The templates' defaults:

| Template | Port | Where the port lives |
| --- | --- | --- |
| backend-service | 12500 | `APPPREFIX_API_PORT` (config default `API_PORT: CS.number().default(12500)`, `AppConstants.APP_API_DEFAULT_PORT`), `example.env`, `docker/Dockerfile` `EXPOSE`, `docker/docker-compose.yml` |
| nuxt-app | 12510 | `package.json` `dev`/`start`, `NUXT_PUBLIC_APP_URL` (`example.env` + `nuxt.config.ts` fallback), `docker/Dockerfile` `PORT`/`EXPOSE`, the `/dev` prompt in `.claude/settings.json` |
| fullstack-nuxt-app | 12520 | `package.json` `dev`/`start`, `APPPREFIX_APP_URL` (`example.env` + `nuxt.config.ts` fallback), `docker/Dockerfile` `PORT`/`EXPOSE`, the `/dev` prompt |
| static-site | 12530 | `package.json` `dev` only |
| static-site-with-docs | 12531 | `package.json` `dev` only |
| cli-tool | — | — |

Cross-references to keep in sync when you change a port:

- The nuxt-app reaches the backend through `NUXT_PUBLIC_API_URL` (`http://localhost:12500`) and
  generates its client from the `openapi-ts.config.ts` input
  `http://localhost:12500/docs/v1/openapi` (the `/api-client` prompt names 12500 too).
- The backend's `APPPREFIX_APP_URL` is the frontend origin (`http://localhost:12510` in its
  `example.env`) — CORS allowlist and password-reset links.

### API client generation

Two flows exist, one per shape — details in
[05 — Generating the frontend client](05-api-contract.md#generating-the-frontend-client):

- **nuxt-app** (split repo): `openapi-ts` reads the **running** backend's spec at
  `http://localhost:12500/docs/v1/openapi` (docs must be enabled).
- **fullstack-nuxt-app**: `bun scripts/api-client-generate.ts` boots the API **in-process**
  (`API.init([], false)`), fetches `/docs/v1/openapi` via `API.getApp().request(…)`, writes
  `./data/temp-api-openapi.json` and runs `bunx openapi-ts`. No server, no port.

## TypeScript

Backend services and CLI tools extend a shared base config. Copy it from
[`shared/tsconfig/tsconfig.base.json`](../shared/tsconfig/tsconfig.base.json) to
`tsconfig/tsconfig.base.json`:

```jsonc
{
	"compilerOptions": {
		"lib": ["ESNext"], "target": "ESNext", "module": "ESNext",
		"moduleDetection": "auto",
		"types": ["bun-types", "node"],
		"moduleResolution": "bundler",
		"incremental": true,
		"verbatimModuleSyntax": true, "esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"strict": true, "skipLibCheck": true,
		"noFallthroughCasesInSwitch": true, "noUncheckedIndexedAccess": true,
		"noUnusedLocals": false, "noUnusedParameters": false,
		"noPropertyAccessFromIndexSignature": false,
		"experimentalDecorators": true, "emitDecoratorMetadata": true
	}
}
```

The notable flags: `strict` + `noUncheckedIndexedAccess` (array/object access is `T | undefined`),
`verbatimModuleSyntax` (forces `import type` for types — see [03](03-naming-and-typescript.md)),
`moduleResolution: "bundler"` (allows extensionless imports) and `types: ["bun-types", "node"]`
(Bun and Node globals without per-file references). `noUnusedLocals`/`noUnusedParameters` are
deliberately off — Biome handles unused-variable linting.

The root `tsconfig.json` is just `{ "extends": "./tsconfig/tsconfig.base.json" }`. A second file,
[`tsconfig/tsconfig.typecheck.json`](../shared/tsconfig/tsconfig.typecheck.json), adds `noEmit` and
includes `../src`, `../tests`, `../scripts`:

```jsonc
{
	"extends": "./tsconfig.base.json",
	"compilerOptions": { "noEmit": true },
	"include": ["../src/**/*.ts", "../tests/**/*.ts", "../scripts/**/*.ts"]
}
```

Nuxt apps are different: the root `tsconfig.json` is Nuxt's generated project-references stub
(`{ "files": [], "references": [{ "path": "./.nuxt/tsconfig.app.json" }, …server, shared, node] }`),
and `tsconfig/tsconfig.typecheck.json` — copied from
[`shared/tsconfig/tsconfig.typecheck.nuxt.json`](../shared/tsconfig/tsconfig.typecheck.nuxt.json) —
**extends `../.nuxt/tsconfig.json`** with `noEmit`, `allowImportingTsExtensions` and
`"types": ["bun-types"]`, and includes only `../tests/**/*` (plus `../server/**/*` in the full-stack
app). `app/**` is left to `nuxt typecheck` (vue-tsc), which provides the Nuxt auto-import
declarations (`ref`, `computed`, `useState`, …) that plain `tsc` cannot resolve. The `typecheck`
script runs `bunx --bun nuxt typecheck && bunx --bun tsc -p ./tsconfig/tsconfig.typecheck.json`.

## Biome (formatter + linter)

Biome is the org formatter and linter — one tool, Bun-native, fast. The ecosystem had **no**
enforced formatter before; this is the new standard (see [17](17-decisions.md)). Copy
[`shared/config/biome.json`](../shared/config/biome.json) — the config every template ships — into
every project. Do **not** copy this repo's root `biome.json`: it adds `"root": true` and excludes
`templates/`, `shared/config` and lockfiles, which only make sense here.

> **Adoption status:** the style-guide repo and all six templates pass `bun run check:ci`. The
> existing application repos are mid-adoption — most currently ship only `typecheck` + `bun test`.
> The guide is the forward-looking rule: new projects and repos being touched should carry
> `biome.json` + a `test:lint`/`bun run check:ci` CI step. Don't remove Biome from a repo that has
> it; do add it when you modernize one that doesn't.

What the config sets:

- **Formatter:** tabs with `indentWidth: 1`, `lineWidth: 100`. **JS/TS:** double quotes,
  semicolons always, trailing commas all, `bracketSpacing: true` (`{ a }`), `expand: "auto"` (an
  object literal stays multi-line if you put a line break after its `{`). JSON and CSS are
  tab-indented too.
- **CSS:** `css.parser.tailwindDirectives: true` so `main.css`'s `@import "tailwindcss"; @theme {}`
  parses (Tailwind v4 CSS-first).
- **Files:** `vcs.useIgnoreFile: true` (respects `.gitignore`), plus explicit excludes for build
  output (`.nuxt`, `.output`, `.nitro`, `dist`, `build`, …) and for generated code —
  `!**/api-client`, `!**/*.gen.ts`, `!**/drizzle/migrations`.
- **Linter:** `"preset": "recommended"` with rules relaxed because they fight the ecosystem's
  real code:
  - `suspicious/noExplicitAny: "off"` — the codebase uses `as any` for type-juggling (the
    `CS` config builder, DB inserts, generated-client workarounds). Tighten per-project if you want.
  - `correctness/noUndeclaredVariables: "off"` — Nuxt auto-imports (`useCookie`, `useState`,
    `navigateTo`, `defineAppConfig`, …) and Bun/Node globals (`process`, `Bun`) aren't visible to
    Biome. (Backend files have proper imports and are unaffected.)
  - `complexity/noStaticOnlyClass: "off"` — the house pattern is static-class services (`API`,
    `DB`, `Logger`, `APIResponse`); the rule would flag every one.
  - `complexity/noBannedTypes: "off"` — allows `{}` in type positions (e.g. the base case of
    `Utils.MergeArray`).
- **static-site-with-docs** additionally turns `correctness/noUnusedImports` and
  `correctness/noUnusedVariables` off.

`@biomejs/biome` is a devDependency in every project. The scripts (all `bunx --bun biome …`):

| Script | Runs | Use |
| --- | --- | --- |
| `bun run format` | `biome format --write` | format everything |
| `bun run check` | `biome check` | format + lint + import sorting, report only |
| `bun run check:ci` | `biome ci` | the CI gate (GitLab `test:lint` job / GitHub step) |
| `bun run lint` | `biome lint` | lint only |

### Biome in `.vue` files

Biome lints the `<script>` block but cannot see `<template>` usage. In the Nuxt templates this
means:

- Imports and variables used only in the template show up as **unused warnings**. They are
  expected; Biome **errors** are not. Never apply `--unsafe` fixes to `.vue` files — they would
  delete those bindings.
- Don't import components explicitly; reference them by their Nuxt auto-import names
  (`LayoutHeader`, `ImgAppLogo`, `DashboardDataTable`, `FormDateRangePicker`, …) so there is no
  import to flag.
- If a binding is used as a **type** in `<script>` and as a **value** only in `<template>` (e.g. a
  Zod schema passed to `UForm :schema`), also reference it as a value in `<script>`
  (`const createSchema = zPostAdminUsersBody;`). Otherwise the `useImportType` safe fix rewrites
  the import to `import type` and the page breaks at runtime.
- In CSS, `@import` rules must come first: `@import "tailwindcss"; @import "@nuxt/ui";` and only
  then `@plugin "@tailwindcss/typography";`.

## Standard scripts

Every project has the four Biome scripts above plus `typecheck` and `test` — those six are
mandatory. The `echo 'Typecheck passed!'` suffix is a house tic — keep it.

**Backend service** (the CLI template is the same without `db:*`):

```json
{
	"typecheck": "bunx --bun tsc -p ./tsconfig/tsconfig.typecheck.json && echo 'Typecheck passed!'",
	"test": "bun test",
	"db:generate": "bun scripts/db-utils && bunx --bun drizzle-kit generate --config=drizzle/configs/drizzle.config.ts",
	"db:migrate": "bun scripts/db-utils && bunx --bun drizzle-kit migrate --config=drizzle/configs/drizzle.config.ts",
	"dev": "bun run --watch src/index.ts",
	"start": "bun run scripts/entrypoint.ts",
	"compile": "bun run ./scripts/compile"
}
```

`scripts/db-utils.ts` only ensures `./data/` exists. There is no `db:push` — schema changes always
go through generated migrations (see [08](08-database.md)). Keep a real `"version"` in
`package.json` (the templates start at `0.1.0`; the static sites have none): the compile script
reads it for `--no-version-tag` builds, so release binaries report it.

**Nuxt app** (nuxt-app, port 12510):

```json
{
	"build": "nuxt build --preset bun",
	"start": "PORT=12510 bun run .output/server/index.mjs",
	"dev": "bunx --bun nuxt dev --port 12510",
	"generate": "bunx --bun nuxt generate",
	"preview": "bunx --bun nuxt preview",
	"postinstall": "bunx --bun nuxt prepare",
	"api-client:generate": "openapi-ts",
	"typecheck": "bunx --bun nuxt typecheck && bunx --bun tsc -p ./tsconfig/tsconfig.typecheck.json && echo 'Typecheck passed!'",
	"test": "bun test"
}
```

**Full-stack Nuxt app** (port 12520): the same shape with `"api-client:generate": "bun
scripts/api-client-generate.ts"` plus the backend's `db:generate` / `db:migrate` (config path
`drizzle/configs/drizzle.config.ts`). It has no `compile` script — it deploys as `.output/` (see
[14](14-deployment.md)).

**Static sites** (ports 12530 / 12531): `dev`, `generate`, `preview`, `postinstall`, `typecheck` and
`test` as above, `"build": "nuxt build --preset static"`, and no `start` or `api-client:generate`.

## Renovate

Every template ships a minimal `.gitlab/renovate.json` — deliberately just the schema, so the
org-level Renovate config applies:

```json
{
	"$schema": "https://docs.renovatebot.com/renovate-schema.json"
}
```

Copy [`shared/config/renovate.json`](../shared/config/renovate.json). Add per-repo rules only when a
repo genuinely needs them. See [13](13-git-and-ci.md).

## MCP servers

`.vscode/mcp.json` registers the `nuxt` and `nuxt-ui` MCP servers on every Nuxt-based template
(nuxt-app, fullstack-nuxt-app, both static sites) — useful when editing components, composables or
NuxtUI styling. Copy [`shared/config/mcp.json`](../shared/config/mcp.json). The Claude Code side
lives in `.claude/settings.json` — see [16](16-ai-tooling.md).
