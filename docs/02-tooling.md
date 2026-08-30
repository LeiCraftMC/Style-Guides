# 02 — Tooling

## Bun

Bun is the runtime, package manager, test runner, dev server, and (for Nuxt) the Nitro preset.

- `bun install` (CI: `bun install --frozen-lockfile`); lockfile is `bun.lock`.
- `bun run dev` → `bun run --watch src/index.ts` (backend/CLI) or `nuxt dev --port <PORT>` (Nuxt).
- `bun test` — the test runner (see [12](12-testing.md)).
- `bun build --compile` — produces a standalone binary (see [11](11-cli-and-infra.md)).
- Nuxt: `nitro: { preset: "bun" }` and `bun run .output/server/index.mjs --port <PORT>` in prod.

Bun auto-loads `.env` — there is no need for a `dotenv` call in web services (CLI tools that need
an explicit env-file path use `dotenv`'s non-overwriting load; see [09](09-config-and-logging.md)).

## Ports — one unique port per app, dev = prod

**Never default to `3000`.** Every LeiCraftMC app gets its own unique port in the **12xxx** range,
and the dev and prod ports are the **same** number (no separate dev/prod ports). Pick a port that
isn't already used by another app in the ecosystem.

The port shows up in up to four places — keep them in sync when you change it:

- `package.json` scripts: `nuxt dev --port <PORT>` / `start: "PORT=<PORT> bun run .output/server/index.mjs"` (Nuxt), or `<PREFIX>_API_PORT` read by the backend's `ConfigHandler` (backend service).
- `nuxt.config.ts` `runtimeConfig.public.appUrl` (and `apiUrl` for the frontend-only Nuxt shape).
- `example.env` / `.env`: `NUXT_PUBLIC_APP_URL`, `NUXT_PUBLIC_API_URL`, `<PREFIX>_API_PORT`.
- `openapi-ts.config.ts` `input` (the URL the client is generated from).

The `api-client:generate` script (where a project boots a temporary API to fetch the spec) uses
**port + 1** for that throwaway instance (e.g. an app on 12336 generates its client on 12337).

## TypeScript

Every project extends a shared base config. Copy it from
[`shared/tsconfig/tsconfig.base.json`](../shared/tsconfig/tsconfig.base.json):

```jsonc
{
  "compilerOptions": {
    "lib": ["ESNext"], "target": "ESNext", "module": "ESNext",
    "moduleDetection": "auto", "moduleResolution": "bundler",
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
and `moduleResolution: "bundler"` (allows extensionless imports). `noUnusedLocals`/`noUnusedParameters`
are deliberately off — Biome handles unused-variable linting.

The root `tsconfig.json` is just `{ "extends": "./tsconfig/tsconfig.base.json" }`. A second file,
`tsconfig/tsconfig.typecheck.json`, adds `noEmit` and includes `../src`, `../tests`, `../scripts`:

```jsonc
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["../src/**/*.ts", "../tests/**/*.ts", "../scripts/**/*.ts"]
}
```

Nuxt apps are different: the root `tsconfig.json` is Nuxt's generated project-references stub
(`{ "files": [], "references": [".nuxt/tsconfig.{app,server,shared,node}.json"] }`), and
`tsconfig/tsconfig.typecheck.json` **extends `../.nuxt/tsconfig.json`** with `"types": ["bun-types"]`
and includes only `../tests/**` (and `../server/**` for full-stack apps). `app/**` is **not** in this
pass — it is type-checked by `nuxt typecheck` (vue-tsc), which provides the Nuxt auto-import
declarations (`ref`, `computed`, `useState`, …) that plain `tsc` cannot resolve. The `typecheck`
script runs `nuxt typecheck && tsc -p ./tsconfig/tsconfig.typecheck.json`.

## Biome (formatter + linter)

Biome is the org formatter and linter — one tool, Bun-native, fast. The ecosystem had **no**
enforced formatter before; this is the new standard (see [17](17-decisions.md)). Copy the root
[`biome.json`](../biome.json) into every project.

Defaults the guide adopts (Biome's defaults, with pragmatic relaxations):

- **Indentation:** tabs. **Line width:** 100.
- **Quotes:** double. **Semicolons:** always. **Trailing commas:** all.
- **CSS:** `css.parser.tailwindDirectives: true` so `main.css`'s `@import "tailwindcss"; @theme {}`
  parses (Tailwind v4 CSS-first).
- **Rules relaxed** because they fight the ecosystem's real code:
  - `suspicious/noExplicitAny: "off"` — the codebase uses `as any` for type-juggling (the
    `ConfigSchema` builder, DB inserts) and `// @ts-ignore` for Hono context. Tighten per-project
    if you want.
  - `correctness/noUndeclaredVariables: "off"` — Nuxt auto-imports (`useCookie`, `useState`,
    `navigateTo`, `defineAppConfig`, …) and Bun/Node globals (`process`, `Bun`) aren't visible to
    Biome. (Backend files have proper imports and are unaffected.)
  - `complexity/noStaticOnlyClass: "off"` — the house pattern is static-class services (`API`,
    `DB`, `Logger`, `APIResponse`); the rule would flag every one.
  - `complexity/noBannedTypes: "off"` — the `ConfigSchema` builder uses `{}` as a default type
    parameter (`ConfigSchema<T = {}>`).

`@biomejs/biome` is a devDependency in every project, and CI runs `bunx biome check` (the
`test:lint` GitLab job / the `bunx biome check` GitHub Actions step) alongside `typecheck` and
`test`. Run `bunx biome check` to lint, `bunx biome format --write` to format. Generated files
(`*.gen.ts`, `api-client/`) and build outputs are excluded in the config.

## Standard scripts

**Backend service / CLI:**

```json
{
  "typecheck": "tsc -p ./tsconfig/tsconfig.typecheck.json && echo 'Typecheck passed!'",
  "test": "bun test",
  "dev": "bun run --watch src/index.ts",
  "compile": "bun run ./scripts/compile/index.ts",
  "start": "bun run scripts/entrypoint.ts"
}
```

DB services add `db:generate` / `db:migrate` / `db:push`, each prefixed with
`bun scripts/db-utils.ts && bunx --bun drizzle-kit <cmd> --config=drizzle.config.ts` (the
`db-utils` script ensures `./data/` exists first). CLI tools add `clean: "rm -rf node_modules"`.

**Nuxt app:**

```json
{
  "build": "nuxt build",
  "start": "bun run .output/server/index.mjs --port <PORT>",
  "dev": "nuxt dev --port <PORT>",
  "generate": "nuxt generate",
  "preview": "nuxt preview",
  "postinstall": "nuxt prepare",
  "api-client:generate": "openapi-ts",
  "typecheck": "nuxt typecheck && tsc -p ./tsconfig/tsconfig.typecheck.json && echo 'Typecheck passed!'",
  "test": "bun test"
}
```

`typecheck` and `test` are mandatory on every project. The `echo 'Typecheck passed!'` suffix is a
house tic — keep it.

## Renovate

Every repo has a `renovate.json` (or `.gitlab/renovate.json`) extending `config:recommended` with
a weekly schedule. Copy [`shared/config/renovate.json`](../shared/config/renovate.json). See
[13](13-git-and-ci.md).

## MCP servers

`.vscode/mcp.json` registers the `nuxt` and `nuxt-ui` MCP servers — useful when editing Nuxt apps
or the frontend shared utilities. Copy [`shared/config/mcp.json`](../shared/config/mcp.json).