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
bun run dev
```

Dev server runs on port **12531** (set in `package.json`; see docs/02 — Ports).

## Generate and deploy

```bash
bun run generate   # → .output/public/
```

On the default branch, GitLab CI (`.gitlab/ci/build.yml`) generates the site and rsyncs
`.output/public/` to your web host via `.gitlab/ci/deploy.sh`. Set the CI variables
`DEPLOY_REMOTE_USER`, `DEPLOY_REMOTE_PASSWORD`, `DEPLOY_REMOTE_HOST` and `DEPLOY_REMOTE_DIR`.
`public/.htaccess` configures Apache (clean URLs, trailing slashes, 404 page).

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
