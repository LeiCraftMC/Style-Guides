# <ProjectName> Static Site

Static site template for LeiCraftMC projects.

## Stack

- Nuxt 4 (`app/` srcDir)
- NuxtUI v4 + Tailwind v4 (CSS-first)
- `nuxt generate` for static output
- Biome formatter/linter
- AGPL-3.0

## Setup

```bash
bun install
# Copy the LeiCraftMC biome.json from the style-guide root into this project.
bun run dev
```

## Generate and deploy

```bash
bun run generate
# deploy .output/public/ via rsync, S3, GitLab Pages, etc.
```

## Scripts

- `bun run dev` — dev server
- `bun run generate` — static generation
- `bun run typecheck` — TypeScript check

## Structure

See the LeiCraftMC style guide:

- [docs/01-project-structure.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/01-project-structure.md)
- [docs/06-frontend-nuxt.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/06-frontend-nuxt.md)

## License

AGPL-3.0
