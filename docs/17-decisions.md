# 17 — Decisions and divergences

This guide was built by auditing 14 repos and resolving their drift. Most rules are already
de-facto somewhere; this page records the explicit opinionated choices made when the repos disagreed.

## 1. Biome as the org formatter / linter

**Divergence:** Some repos used ESLint + Prettier, others used nothing. As of the latest audit, the
existing application repos ship only `typecheck` + `bun test` — no Biome config yet.

**Decision:** Adopt Biome everywhere as the target standard. One tool, Bun-native, fast. Tabs,
double quotes, semicolons, line width 100. Rules relaxed to match real code:
`suspicious/noExplicitAny: "off"`, `correctness/noUndeclaredVariables: "off"`,
`complexity/noStaticOnlyClass: "off"`, `complexity/noBannedTypes: "off"`.

**Rationale:** Reduces config surface, CI time, and "which linter" debates. The relaxations are
pragmatic: `as any` appears in typed builders (`ConfigSchema`, `DB` inserts) and Nuxt/Bun globals
are invisible to Biome; the house pattern is static-class services.

**Rollout:** the style-guide repo and the templates here are Biome-clean; the application repos are
being migrated. The guide is the forward-looking rule, not a description of today's state.

## 2. Conventional Commits

**Divergence:** Mixed commit styles across repos.

**Decision:** Use Conventional Commits in all new work. Existing history is not rewritten.

## 3. AGPL-3.0 as the default license

**Divergence:** Some repos had no license; a few had different licenses.

**Decision:** Default to AGPL-3.0 for services, apps, and templates. A project may choose another
license, but it must be an explicit decision and documented here.

## 4. `shared/` utilities as canonical copy-paste code

**Divergence:** `Logger`, `APIResponse`, `useAPI`, `AbstractStore`, and compile scripts existed in
multiple repos with small differences.

**Decision:** Canonicalize them in this repo under `shared/` with clear copy-paste instructions. They
are not a published package (yet) because the ecosystem still experiments; see
[`shared/README.md`](../shared/README.md) for the package roadmap.

## 5. Static-class services, no DI

**Divergence:** A few repos used functional modules or small DI-ish helpers.

**Decision:** Standardize on static classes (`API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`).
No dependency-injection container. This matches the majority of the audited code and keeps imports
simple.

## 6. OpenAPI as the contract bridge

**Divergence:** Some frontends hand-wrote client types; others used different validators.

**Decision:** Backend serves OpenAPI JSON via `hono-openapi` + Scalar. Frontend generates the SDK
with `@hey-api/openapi-ts`. `zValidator` from `hono-openapi` is the single validator (not
`@hono/zod-validator`).

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

## 11. `model.ts` namespace: nested or dotted, by depth

**Divergence:** Delivr-API uses a dotted top-level namespace name (`namespace AuthModel.Login`);
API-Server, Status-Page, and MindCode use a top-level `<Resource>Model` namespace with a nested
per-operation namespace (`UsersPublicModel.Search`).

**Decision:** Both are valid; pick by depth. **Nested** for small, tightly-grouped schemas (one
level of nesting). **Dotted** when nesting would go two or more levels deep, or when operations are
read independently — the flat dotted name reads better. Don't mix the two inside one `model.ts`. See
[03 — Naming & TypeScript style](03-naming-and-typescript.md#zod-schemas-with-paired-zinfer-types).

## 12. Opaque bearer tokens, not JWT

**Divergence:** Every audited backend declares `bearerFormat: "JWT"` in its OpenAPI securityScheme,
but the actual tokens are opaque random hex strings (`<prefix>_<kind>_<id>:<base>`) with the secret
half hashed via `Bun.password.hash`. The JWT label is a copy-paste artifact.

**Decision:** Tokens are opaque; the server re-resolves against the DB on every request. **Do not
set `bearerFormat: "JWT"`**. Document the real scheme (prefix dispatch, hashed base, 7-day sessions,
timing-safe login, rate limiting, RBAC tiers) in [10 — Authentication](10-auth.md).

**Rationale:** Opaque + hashed + revocable is safer for this ecosystem than stateless JWTs (no
revocation, no rotation without a denylist). The misleading OpenAPI label is removed.

## 13. Split-repo and full-stack Nuxt are both first-class

**Divergence:** Delivr and LeiOS split backend (Hono) and frontend (Nuxt) into separate repos;
Status-Page and MindCode ship one full-stack Nuxt app with Hono embedded via a Nitro catch-all.

**Decision:** Both shapes are supported. The split shape's contract is the backend's OpenAPI spec
(the frontend `openapi-ts` input points at the backend's `/docs/v1/openapi`); the full-stack shape
mounts Hono at `/api` via `server/routes/api/[...].ts`. Full-stack may add WebSocket
(`nitro.experimental.websocket`) and dual Bun/Cloudflare deploy. See
[01 — Project structure](01-project-structure.md) and
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
