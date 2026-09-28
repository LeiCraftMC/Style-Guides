---
title: "About"
description: "What <ProjectName> is and how it is structured."
navigation:
  title: About
---

# About

<ProjectName> is a static marketing + documentation site generated with `nuxt generate` and
deployed as plain HTML.

## Stack

- **Nuxt 4** with the `app/` srcDir
- **NuxtUI v4** + **Tailwind v4** (CSS-first, no `tailwind.config.js`)
- **@nuxt/content** for markdown docs
- **Biome** for formatting and linting
- **AGPL-3.0**

## Project structure

- `app/pages/` — marketing pages (home, about, contact, projects).
- `app/pages/docs/[...slug].vue` — the docs renderer.
- `content/docs/` — markdown docs.
- `app/data/docs.ts` — docs sidebar navigation.
- `public/` — static assets served at the root.

Replace `<ProjectName>` and the placeholder content, then run `bun run generate`.
