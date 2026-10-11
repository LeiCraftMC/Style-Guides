---
title: "Getting Started"
description: "Install dependencies, run the dev server, and generate the static site for <ProjectName>."
navigation:
  title: Getting Started
---

# Getting Started

## Setup

```bash
bun install
bun run dev
```

The dev server runs on port **12531**.

## Generate and deploy

```bash
bun run generate
# deploy .output/public/ via rsync, S3, GitLab Pages, etc.
```

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run generate` | Generate the static site |
| `bun run typecheck` | Run TypeScript checks |
| `bun run check` | Run Biome check |
| `bun run format` | Format with Biome |

## Adding docs

1. Create a new `.md` file under `content/docs/`.
2. Add frontmatter with `title`, `description`, and `navigation.title`.
3. Add the page to `app/data/docs.ts` so it appears in the sidebar.

See the [LeiCraftMC Style Guides](https://github.com/LeiCraftMC/Style-Guides) for the full rules.
