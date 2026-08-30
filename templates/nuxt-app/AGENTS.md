# AGENTS.md — operating manual for AI coding agents

You are working in a LeiCraftMC Nuxt app (frontend only — the backend is a separate service, the
"split-repo" shape; see docs/01-project-structure.md). Follow the LeiCraftMC Style Guides:
https://github.com/LeiCraftMC/Style-Guides.

## Must read

- [docs/00-overview.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/00-overview.md)
- [docs/01-project-structure.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/01-project-structure.md) — split-repo shape
- [docs/06-frontend-nuxt.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/06-frontend-nuxt.md)
- [docs/07-state-and-data.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/07-state-and-data.md)
- [docs/10-auth.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/10-auth.md) — frontend session handling

## Non-negotiable

- Nuxt 4 `app/` srcDir. Tailwind v4 CSS-first; no `tailwind.config.js`. Dark-only (no toggle).
- All API access through `useAPI` (wraps the generated SDK); no raw `$fetch`/`useFetch`.
- Global state via `AbstractStore` over `useState`; component-local form/UI state with
  `reactive()`/`ref()` is fine.
- Session cookie via `useAppCookies()` (`secure; sameSite=lax; httpOnly:false`); `useAPI`
  redirects on any `code === 401`. See docs/10-auth.md.
- Lucide icons only (`i-lucide-*`). Never hand-edit `*.gen.ts` under `app/api-client/` (an
  automated `scripts/patch-api-client.ts` is the only exception).
- `openapi-ts.config.ts` `input` points at the separate backend's `/docs/v1/openapi`.
- Format with Biome before finishing. Conventional Commits.

Replace `<ProjectName>` and the `<PREFIX>` cookie/env prefix with the real project values.
