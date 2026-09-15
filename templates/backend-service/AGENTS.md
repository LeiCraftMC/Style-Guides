# AGENTS.md — operating manual for AI coding agents

You are working in a LeiCraftMC backend service. Follow the LeiCraftMC Style Guides:
https://github.com/LeiCraftMC/Style-Guides.

## Must read

- [docs/00-overview.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/00-overview.md)
- [docs/04-backend-hono.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/04-backend-hono.md)
- [docs/05-api-contract.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/05-api-contract.md)
- [docs/08-database.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/08-database.md)
- [docs/12-testing.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/12-testing.md)

## Non-negotiable

- Every route uses the `{ success, code, message, data }` envelope via `APIResponse.*` helpers
  (errors omit `data`).
- Validate with `zValidator` from `hono-openapi`.
- Auth uses opaque bearer tokens (`<prefix>_<kind>_<id>:<base>`, `Bun.password`-hashed).
  See docs/10-auth.md.
- Never hand-edit `*.gen.ts` (an automated `patch-api-client.ts` script is the only exception).
- Static classes for services (`API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`).
- Format with Biome before finishing (`bun run check:ci`).
- Conventional Commits.

Replace `<ProjectName>` and the `APPPREFIX` env prefix / `appprefix` token prefix
(see `src/utils/constants.ts`) with the real project values.
