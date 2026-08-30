# <ProjectName> Backend Service

Backend service template for LeiCraftMC projects.

## Stack

- Bun runtime + package manager + test runner
- Hono + Zod + `hono-openapi` + Scalar
- Drizzle ORM + `bun-sqlite`
- Biome formatter/linter
- AGPL-3.0

## Setup

```bash
bun install
cp example.env .env
# Copy the LeiCraftMC biome.json from the style-guide root into this project.
# Pick a unique port (never 3000) and set SVC_API_PORT — see docs/02 — Ports.
bun run dev
```

## Scripts

- `bun run dev` — watch mode
- `bun run typecheck` — TypeScript check
- `bun test` — run tests
- `bun run db:generate` — generate migrations
- `bun run db:migrate` — run migrations

## Structure

See the LeiCraftMC style guide:

- [docs/04-backend-hono.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/04-backend-hono.md)
- [docs/05-api-contract.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/05-api-contract.md)
- [docs/08-database.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/08-database.md)

## License

AGPL-3.0
