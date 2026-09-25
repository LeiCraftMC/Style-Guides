# 17 — Decisions and divergences

This guide was built by auditing 14 repos and resolving their drift. Most rules are already
de-facto somewhere; this page records the explicit opinionated choices made when the repos disagreed
— and, from #15 on, the calls made while fixing up the templates.

## 1. Biome as the org formatter / linter

**Divergence:** Some repos used ESLint + Prettier, others used nothing. As of the latest audit, the
existing application repos ship only `typecheck` + `bun test` — no Biome config yet. The templates
themselves had drifted into several Biome variants.

**Decision:** Adopt Biome everywhere as the target standard. One tool, Bun-native, fast. The
canonical config is [`shared/config/biome.json`](../shared/config/biome.json), shipped identically by
every template (the majority variant won):

- tabs with `indentWidth: 1`, line width 100; double quotes, semicolons, trailing commas,
  `bracketSpacing: true`, `expand: "auto"`;
- excludes generated code — `!**/api-client`, `!**/*.gen.ts`, `!**/drizzle/migrations` — and build
  output;
- rules relaxed to match real code: `suspicious/noExplicitAny: "off"`,
  `correctness/noUndeclaredVariables: "off"`, `complexity/noStaticOnlyClass: "off"`,
  `complexity/noBannedTypes: "off"`.

The one exception is `static-site-with-docs`, which also turns `correctness/noUnusedImports` and
`correctness/noUnusedVariables` off. The guide repo's root `biome.json` is a superset for this repo
only (`"root": true`, excludes `templates/`) — never copy it into a project.

**Rationale:** Reduces config surface, CI time, and "which linter" debates. The relaxations are
pragmatic: `as any` appears in typed builders (`CS` config builder, `DB` inserts) and Nuxt/Bun
globals are invisible to Biome; the house pattern is static-class services.

**Rollout:** the style-guide repo and all six templates pass `bun run check:ci`; the application
repos are being migrated. The guide is the forward-looking rule, not a description of today's
state. See [02 — Biome](02-tooling.md#biome-formatter--linter).

## 2. Conventional Commits

**Divergence:** Mixed commit styles across repos.

**Decision:** Use Conventional Commits in all new work. Existing history is not rewritten.

## 3. AGPL-3.0 as the default license

**Divergence:** Some repos had no license; a few had different licenses.

**Decision:** Default to AGPL-3.0 for services, apps, and templates. **Every template ships an
AGPL-3.0 `LICENSE` file**, so a scaffolded project is licensed from its first commit. A project may
choose another license, but it must be an explicit decision and documented here.

## 4. `shared/` as a mirrored copy of the templates' core

**Divergence:** `Logger`, `APIResponse`, `useAPI`, `AbstractStore`, and compile scripts existed in
multiple repos with small differences. Later, `shared/` itself drifted from the templates (flat file
names such as `api-response.ts` or `spec-helpers.ts`, example files that no template used).

**Decision:** The **templates are canonical**. [`shared/`](../shared/) holds **verbatim copies** of
their core files in a **mirrored layout** — the path inside `shared/<area>/` is the path in your
project (`shared/backend/src/utils/config.ts` → `src/utils/config.ts`). Feature modules (email,
tasks, cron, crypto, preferences, metadata, the DB schema, routes, pages, Docker files,
`.htaccess`) stay **template-only**; the docs link to them in the templates. Files that no template
used were deleted from `shared/`. `shared/` is not a published package (yet) because the ecosystem
still experiments; see [`shared/README.md`](../shared/README.md) for the layout and the package
roadmap.

## 5. Static-class services, no DI

**Divergence:** A few repos used functional modules or small DI-ish helpers.

**Decision:** Standardize on static classes (`API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`).
No dependency-injection container. This matches the majority of the audited code and keeps imports
simple.

## 6. OpenAPI as the contract bridge

**Divergence:** Some frontends hand-wrote client types; others used different validators.

**Decision:** Backend serves OpenAPI JSON via `hono-openapi` + Scalar. Frontend generates the SDK
with `@hey-api/openapi-ts` (plugin set and generation flows: #15). The `validator` from
`hono-openapi` (imported as `zValidator`) is the single validator (not `@hono/zod-validator`).

## 7. Tailwind v4 CSS-first, no `tailwind.config.js`

**Divergence:** Tailwind v3 configs existed in older sites.

**Decision:** New Nuxt apps use Tailwind v4 with `@import "tailwindcss"; @import "@nuxt/ui";` in
`app/assets/css/main.css`. No `tailwind.config.js`.

## 8. NuxtUI v4 + Lucide icons

**Divergence:** Some apps used custom components or mixed icon sets.

**Decision:** Standardize on NuxtUI v4 components and Lucide icons (`i-lucide-*`). Custom icons live
in `components/img/` only when Lucide lacks them.

## 9. SQLite by default

**Divergence:** Delivr already supports PostgreSQL and MySQL; other repos use SQLite.

**Decision:** New single-dialect services default to `bun-sqlite` + Drizzle. Multi-dialect support is
allowed when the domain needs it, with per-dialect schema files.

## 10. No `.claude/settings.json` permission grants

**Divergence:** During guide creation, an attempt was made to create `.claude/settings.json` with
permission rules.

**Decision:** Reject this. Permission grants are the user's to manage. `.claude/settings.json`
ships only `commands` (slash commands), `mcpServers`, and `fileScan` — never `permissions.allow`.
MCP config also lives in `.vscode/mcp.json` for Nuxt projects (matching the existing ecosystem).
Each template's `.claude/settings.json` is a copy of one of the
`shared/config/claude-settings.{backend,cli,nuxt,fullstack,static}.json` variants; see
[16](16-ai-tooling.md).

## 11. `model.ts` namespace: nested or dotted, by depth

**Divergence:** Delivr-API uses a dotted top-level namespace name (`namespace AuthModel.Login`);
API-Server, Status-Page, and MindCode use a top-level `<Resource>Model` namespace with a nested
per-operation namespace (`UsersPublicModel.Search`).

**Decision:** Both are valid; pick by depth. **Nested** for small, tightly-grouped schemas (one
level of nesting). **Dotted** when nesting would go two or more levels deep, or when operations are
read independently — the flat dotted name reads better. Don't mix the two inside one `model.ts`.
The templates use the dotted form throughout. See
[03 — Naming & TypeScript style](03-naming-and-typescript.md#zod-schemas-with-paired-zinfer-types).

## 12. Opaque bearer tokens, not JWT

**Divergence:** Every audited backend declared `bearerFormat: "JWT"` in its OpenAPI securityScheme,
but the actual tokens are opaque random hex strings (`<prefix>_<kind>_<id>:<base>`) with the secret
half hashed via `Bun.password.hash`. The JWT label is a copy-paste artifact.

**Decision:** Tokens are opaque; the server re-resolves against the DB on every request. **Do not
set `bearerFormat: "JWT"`**. The templates comply: their `bearerAuth` scheme is
`{ type: "http", scheme: "bearer" }` with no `bearerFormat`. Document the real scheme (prefix
dispatch, hashed base, 7-day sessions, timing-safe login, rate limiting, RBAC tiers) in
[10 — Authentication](10-auth.md).

**Rationale:** Opaque + hashed + revocable is safer for this ecosystem than stateless JWTs (no
revocation, no rotation without a denylist). The misleading OpenAPI label is removed.

## 13. Split-repo and full-stack Nuxt are both first-class

**Divergence:** Delivr and LeiOS split backend (Hono) and frontend (Nuxt) into separate repos;
Status-Page and MindCode ship one full-stack Nuxt app with Hono embedded via a Nitro catch-all.

**Decision:** Both shapes are supported. The split shape's contract is the backend's OpenAPI spec
(the nuxt-app's `openapi-ts` input is the live backend at
`http://localhost:12500/docs/v1/openapi`); the full-stack shape mounts Hono at `/api` via
`server/routes/api/[...].ts`. A full-stack app may add WebSocket
(`nitro.experimental.websocket`) or a Cloudflare target, but neither is part of the template — see
#16. See [01 — Project structure](01-project-structure.md) and
[04 — Mounting Hono in Nitro](04-backend-hono.md#mounting-hono-in-nitro).

## 14. Compatibility-proxy backends are a noted exception

**Divergence:** LeiAI API-Gateway speaks OpenAI/Anthropic-native protocols — its real endpoints
return vendor shapes (`{ object: "list", data }`, `{ type: "error", error }`), not the
`{ success, code, message, data }` envelope; it has no DB, no `hono-openapi`, and uses API-key model
scoping.

**Decision:** The envelope, `hono-openapi`, and Drizzle conventions apply to **control-plane**
endpoints (`/health`, `/`) and to normal CRUD services. A service whose job is to be
protocol-compatible with an upstream vendor is a documented exception — vendor-native responses,
manual validation, gateway API keys with `allowedModels`/`denyModels`. See the compatibility-proxy
note in [04 — Backend architecture](04-backend-hono.md#compatibility-proxy-backend).

## 15. One API-client plugin set, two generation flows

**Context:** The guide previously allowed several ways to obtain the spec (a live URL, a committed
snapshot, or a throwaway API instance on "port + 1") and did not pin the plugin list. The generator
(`@hey-api/openapi-ts` 0.99) also has typing bugs in its Nuxt output.

**Decision:** Every Nuxt app generates `app/api-client/` with exactly
`["@hey-api/client-nuxt", "@hey-api/typescript", "@hey-api/sdk", "zod"]`. The spec source depends
on the shape:

- **nuxt-app** (split repo) reads the running backend's spec at
  `http://localhost:12500/docs/v1/openapi`, then runs the automated `scripts/patch-api-client.ts`
  for known generator typing bugs — the only sanctioned edit of `*.gen.ts`.
- **fullstack-nuxt-app** generates the spec **in-process** (`scripts/api-client-generate.ts`:
  `API.init([], false)` → `API.getApp().request("/docs/v1/openapi")` → temp JSON → `openapi-ts`) —
  no server, no port. Its output is deliberately **unpatched**: the remaining `sdk.gen.ts` type
  errors are left for upstream to fix rather than growing a second patch script.

See [05 — API contract](05-api-contract.md).

## 16. Bun-only toolchain

**Context:** Status-Page ships to both Bun and Cloudflare Pages/D1, and #13 originally listed a
"dual Bun/Cloudflare deploy" as a full-stack option. The templates had to pick one runtime.

**Decision:** The templates are Bun-only: CLIs run as `bunx --bun …`, types come from `bun-types`,
the database is `bun-sqlite`, server Nuxt apps build with `nuxt build --preset bun` (the full-stack
app also marks `bun:sqlite` as a Rollup external), and tests run on `bun test`. A Cloudflare target
is an **optional** extension for the rare app that needs it — the helper for it,
[`shared/backend/src/utils/runtime.ts`](../shared/backend/src/utils/runtime.ts), is unused by every
template. Don't add dual-runtime branches to a project unless it actually deploys to Cloudflare.

## 17. Fixed default ports per template

**Context:** The guide already required a unique 12xxx port per app with dev = prod; the templates
needed concrete defaults that don't collide with each other.

**Decision:** Each template has a fixed default in the 12xxx range: backend-service 12500, nuxt-app
12510, fullstack-nuxt-app 12520, static-site 12530, static-site-with-docs 12531 (the CLI has none).
Dev and prod use the same port; never `3000`. The split-repo defaults line up (the nuxt-app points
at 12500, the backend's `APP_URL` at 12510). A real project picks its own unused port and updates
every place listed in [02 — Ports](02-tooling.md#ports--one-unique-port-per-app-dev--prod).

## 18. Both CI providers ship in the templates

**Context:** Repos live on both `git.leicraftmc.de` (GitLab) and `github.com/LeiCraftMC`; the
templates used to carry one provider or the other.

**Decision:** Ship both, so the project works wherever it is pushed. GitHub:
`.github/workflows/ci.yml` (`check:ci`, `typecheck`, `test`) in every template except
backend-service, plus `release.yml` in the CLI. GitLab: `.gitlab-ci.yml` + `.gitlab/ci/testing.yml`
in every template, with a shape-specific `.gitlab/ci/build.yml` (Docker image for the Nuxt apps,
compiled-binary image for the backend, rsync deploy for the static sites; the CLI's build include is
commented out). backend-service ships GitLab CI only. Delete the provider you don't use. See
[13](13-git-and-ci.md).

## 19. Minimal Renovate config

**Context:** The guide previously prescribed a per-repo config extending `config:recommended` with
a weekly schedule.

**Decision:** Templates ship `.gitlab/renovate.json` containing only the `$schema` line
([`shared/config/renovate.json`](../shared/config/renovate.json) is the same). This is deliberate:
the org-level Renovate config applies. Add per-repo rules only for a real need.

## 20. Config booleans via `z.coerce.boolean()`

**Context:** `z.coerce.boolean()` uses JavaScript truthiness, so the string `"false"` becomes
`true` — surprising the first time you meet it.

**Decision:** Keep `CS.boolean()` = `z.coerce.boolean()` — deliberately, no custom parser. Any
**non-empty** value, including the string `"false"`, is `true`; an **empty** value (`KEY=`) is
`false`; an **unset** variable takes the schema default (so `API_DISABLE_DOCS` is off when unset,
while `DB_AUTO_MIGRATE`, default `true`, needs `APPPREFIX_DB_AUTO_MIGRATE=` to turn it off).
`example.env` ships `APPPREFIX_API_DISABLE_DOCS=` (empty) with a comment explaining the rule. See
[09](09-config-and-logging.md).

## 21. vue-tsc under Bun: accepted limitation

**Context:** A tooling gap, not a repo divergence. vue-tsc patches TypeScript through a
`fs.readFileSync` hook that Bun's module loader bypasses, so `bun run typecheck`
(`nuxt typecheck`) checks only `.ts` files in Nuxt apps, not `.vue`.

**Decision:** Document it, don't work around it. The templates keep the Bun-only toolchain (#16);
the limitation is stated in [02](02-tooling.md#known-limitations), in the Nuxt templates'
`CLAUDE.md`, and in [16](16-ai-tooling.md#verifying-vue-work) for agents. Revisit when vue-tsc or
Bun fixes it.

## 22. Compiled binaries: bytecode off for services, on for the CLI

**Context:** The compile scripts differed per repo, and with Bun 1.4.0 a `--bytecode` build of a
service binary aborts at startup on Linux (JSC `UnlinkedArrayProfile` assertion).

**Decision:** One compile script (`scripts/compile/`, from
[`shared/cli/scripts/compile/`](../shared/cli/scripts/compile/)). The CLI keeps
`bytecode = true` (`--bytecode --format=esm`); services set `bytecode = false` and add
`--asset ./drizzle/migrations` so the binary carries its migrations. Re-enable bytecode for services
once Bun fixes the crash. The full-stack app is **not** compiled: its `scripts/compile/` +
`scripts/entrypoint.ts` do not produce a working binary, so it deploys as `.output/` +
`drizzle/migrations` on `oven/bun` (see [14](14-deployment.md)).

## Known future work (not yet decided)

These gaps surfaced during the audit but are out of scope for this pass; record a decision here when
taken: accessibility/contrast standards, i18n/localization, observability/metrics, pagination
envelope extension, backup/restore for SQLite beyond the Vault CLI, and a `shared/` package
publishing roadmap.

If a project needs to diverge from this guide (different license, a new library, a genuine reason for
ESLint, etc.):

1. Discuss it and record the decision in this repo or the project's `CLAUDE.md`.
2. Update the relevant `docs/` page with the exception and why.
3. Do not let local drift silently spread to new repos without revisiting the decision.

The principle is: **codify reality, then decide the divergences.** When reality changes, update
the guide first.
