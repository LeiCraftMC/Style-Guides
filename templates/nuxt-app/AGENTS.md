# AGENTS.md — operating manual for AI coding agents

You are working in a LeiCraftMC Nuxt app. Follow the LeiCraftMC Style Guides:
https://github.com/LeiCraftMC/Style-Guides.

## Must read

- [docs/00-overview.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/00-overview.md)
- [docs/06-frontend-nuxt.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/06-frontend-nuxt.md)
- [docs/07-state-and-data.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/07-state-and-data.md)

## Non-negotiable

- Nuxt 4 `app/` srcDir.
- Tailwind v4 CSS-first; no `tailwind.config.js`.
- All API access through `useAPI` (wraps the generated SDK).
- Global state via `AbstractStore` over `useState`.
- Lucide icons only (`i-lucide-*`).
- Never hand-edit `*.gen.ts` under `app/api-client/`.
- Format with Biome before finishing.
- Conventional Commits.

Replace `<ProjectName>` and the cookie prefix with the real project values.
