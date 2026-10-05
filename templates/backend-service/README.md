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
# Default port 12500 (APPPREFIX_API_PORT). Give each app its own port — see docs/02-tooling.md.
bun run dev
```

## Scripts

- `bun run dev` — watch mode
- `bun run check` / `bun run format` — Biome check / format
- `bun run typecheck` — TypeScript check
- `bun test` — run tests
- `bun run db:generate` — generate migrations
- `bun run db:migrate` — run migrations
- `bun run compile linux-x64-baseline` — single binary in `build/bin/` (see `docker/` for the image + compose)
- `bun run start` — run via `scripts/entrypoint.ts` (auto-migrates the DB)

## Structure

See the LeiCraftMC style guide:

- [docs/04-backend-hono.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/04-backend-hono.md)
- [docs/05-api-contract.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/05-api-contract.md)
- [docs/08-database.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/08-database.md)

## License

AGPL-3.0
