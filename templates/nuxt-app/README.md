# <ProjectName> Nuxt App

Frontend template for LeiCraftMC projects.

## Stack

- Nuxt 4 (`app/` srcDir)
- NuxtUI v4 + Tailwind v4 (CSS-first)
- Bun runtime
- Biome formatter/linter
- AGPL-3.0

## Setup

```bash
bun install
cp example.env .env
# Copy the LeiCraftMC biome.json from the style-guide root into this project.
bun run dev
```

## API client

Generate the typed client from the backend OpenAPI spec:

```bash
bun run api-client:generate
```

## Scripts

- `bun run dev` — dev server on port 3000
- `bun run build` — production build
- `bun run generate` — static generation
- `bun run typecheck` — TypeScript check
- `bun test` — run tests

## Structure

See the LeiCraftMC style guide:

- [docs/06-frontend-nuxt.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/06-frontend-nuxt.md)
- [docs/07-state-and-data.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/07-state-and-data.md)

## License

AGPL-3.0
