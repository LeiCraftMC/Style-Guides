# <ProjectName> Full-stack Nuxt App

Full-stack template: Nuxt 4 frontend **and** a Hono backend living in `server/`, mounted at `/api`.

## Stack

- Nuxt 4 (`app/` srcDir) + NuxtUI v4 + Tailwind v4 (CSS-first)
- Hono + Zod + `hono-openapi` (Scalar) in `server/`, mounted at `/api` via a catch-all Nitro route
- Drizzle ORM + `bun-sqlite`
- Bun runtime (Nitro `bun` preset)
- Biome formatter/linter
- AGPL-3.0

## Setup

```bash
bun install
cp example.env .env
# Copy the LeiCraftMC biome.json from the style-guide root into this project.
# Pick a unique port (never 3000) — set it in package.json + example.env; see docs/02 — Ports.
bun run dev
```

The dev server boots Nuxt; the `server/plugins/startup.ts` Nitro plugin initializes the DB and the
Hono `API` on boot. Endpoints are at `/api/v1/**`, `/api/health`, `/api/docs/v1`.

## API client

Generate the typed client from the in-server OpenAPI spec:

```bash
bun run api-client:generate   # reads http://localhost:3000/api/docs/v1/openapi
```

## Scripts

- `bun run dev` — dev server on port 3000 (frontend + API)
- `bun run build` — production build (single `.output/`)
- `bun run start` — run the built server
- `bun run api-client:generate` — regenerate the typed API client
- `bun run db:generate` / `db:migrate` / `db:push` — Drizzle migrations
- `bun run typecheck` — `nuxt typecheck` + `tsc` (includes `server/`)
- `bun test` — run tests

## Structure

See the LeiCraftMC style guide:

- [docs/01-project-structure.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/01-project-structure.md) — the full-stack Nuxt shape
- [docs/04-backend-hono.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/04-backend-hono.md) — Mounting Hono in Nitro
- [docs/06-frontend-nuxt.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/06-frontend-nuxt.md)

## License

AGPL-3.0