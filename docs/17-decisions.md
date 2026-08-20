# 17 — Decisions and divergences

This guide was built by auditing 14 repos and resolving their drift. Most rules are already
de-facto somewhere; this page records the explicit opinionated choices made when the repos disagreed.

## 1. Biome as the org formatter / linter

**Divergence:** Some repos used ESLint + Prettier, others used nothing.

**Decision:** Adopt Biome everywhere. One tool, Bun-native, fast. Tabs, double quotes, semicolons,
line width 100. Two rules relaxed to match real code: `suspicious/noExplicitAny: "off"` and
`correctness/noUndeclaredVariables: "off"`.

**Rationale:** Reduces config surface, CI time, and "which linter" debates. The relaxations are
pragmatic: `as any` appears in typed builders (`ConfigSchema`, `DB` inserts) and Nuxt/Bun globals are
invisible to Biome.

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

**Decision:** Reject this. Permission grants are the user's to manage. The guide only ships slash
commands (`.claude/commands/`) and MCP config (`.vscode/mcp.json`).

## Handling future drift

If a project needs to diverge from this guide (different license, a new library, a genuine reason for
ESLint, etc.):

1. Discuss it and record the decision in this repo or the project's `CLAUDE.md`.
2. Update the relevant `docs/` page with the exception and why.
3. Do not let local drift silently spread to new repos without revisiting the decision.

The principle is: **codify reality, then decide the divergences.** When reality changes, update
the guide first.
