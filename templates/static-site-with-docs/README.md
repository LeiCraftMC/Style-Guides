# <ProjectName> Static Site + Docs

Static site with documentation template for LeiCraftMC projects.

## Stack

- Nuxt 4 (`app/` srcDir)
- NuxtUI v4 + Tailwind v4 (CSS-first)
- `@nuxt/content` for markdown-based docs
- `nuxt generate` for static output
- Biome formatter/linter
- AGPL-3.0

## Setup

```bash
bun install
# Pick a unique port (never 3000) — set it in package.json; see docs/02 — Ports.
bun run dev
```

Dev server runs on port **12531**.

## Generate and deploy

```bash
bun run generate
# deploy .output/public/ via rsync, S3, GitLab Pages, etc.
```

## Scripts

- `bun run dev` — dev server
- `bun run generate` — static generation
- `bun run typecheck` — TypeScript check
- `bun run check` — Biome check
- `bun run format` — format with Biome

## Docs

Docs live in `content/docs/` as markdown files. Navigation is declared in `app/data/docs.ts`. Add a
new page by creating a `.md` file and adding it to the sidebar data.

## Structure

See the LeiCraftMC style guide:

- [docs/01-project-structure.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/01-project-structure.md)
- [docs/06-frontend-nuxt.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/06-frontend-nuxt.md)

## License

AGPL-3.0
