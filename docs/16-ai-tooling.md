# 16 — AI tooling

## `AGENTS.md` and `CLAUDE.md`

Every repo has an AI operating manual at its root:

- [`AGENTS.md`](../AGENTS.md) — generic instructions for any AI coding agent. Put project-wide rules
  here.
- [`CLAUDE.md`](../CLAUDE.md) — Claude-Code-specific additions. Put slash commands and MCP setup
  here.

In this style-guide repo, both files reference [`docs/`](.) and [`shared/`](../shared/) heavily. In
application repos, keep them short: point to this guide, then list repo-specific exceptions.

## Slash commands

Place Claude slash commands in `.claude/commands/` as Markdown files. Each file's first heading
becomes the command name.

Example `.claude/commands/verify.md`:

```markdown
# verify

Run the project verification suite and report pass/fail.

1. Run `bunx biome check`.
2. Run `bun run typecheck`.
3. Run `bun test`.
4. Report the result for each step and a final verdict.
```

The guide repo ships three commands in [`.claude/commands/`](../.claude/commands/):

- `/verify` — Biome + typecheck + tests.
- `/typecheck` — `bun run typecheck`.
- `/format` — `bunx biome format --write` then `bunx biome check`.

Copy the whole `.claude/commands/` directory into new projects.

## MCP servers

Register the Nuxt and NuxtUI MCP servers in `.vscode/mcp.json`:

```json
{
  "servers": {
    "nuxt": { "url": "https://nuxt.com/mcp" },
    "nuxt-ui": { "url": "https://ui.nuxt.com/mcp" }
  }
}
```

Copy [`shared/config/mcp.json`](../shared/config/mcp.json) to `.vscode/mcp.json` in frontend/Nuxt
projects. These servers help answer questions about NuxtUI components, Tailwind v4 configuration,
and Nuxt APIs.

## Prompting conventions

When asking an AI to work in a LeiCraftMC repo, include enough context:

1. Reference the relevant `docs/` page.
2. Mention the project shape (backend / Nuxt / static / CLI).
3. Point to the shared utility that already solves the problem.

Example prompt:

> Add a POST /v1/servers route for LeiOS following docs/04-backend-hono.md and docs/05-api-contract.md.
> Use APIRouteSpec.authenticated + APIResponse.created. Derive the response schema from DB.Schema.servers
> with drizzle-zod. Add tests with make-api-request.ts.

## Avoiding generic advice

The guide exists so AI tools do not fall back to generic internet patterns. Explicitly forbidden
shortcuts:

- `@hono/zod-validator` — use `hono-openapi`'s `zValidator`.
- Hand-editing `*.gen.ts` — regenerate from OpenAPI.
- Pinia or static `reactive()` for global state — use `AbstractStore` over `useState`.
- ESLint / Prettier — Biome is the formatter/linter.
- `@hono/swagger-ui` — use Scalar via `@scalar/hono-api-reference`.

## Checklist

- [ ] `AGENTS.md` and `CLAUDE.md` in every repo root.
- [ ] `.claude/commands/` copied with `verify`, `typecheck`, `format`.
- [ ] `.vscode/mcp.json` registers `nuxt` + `nuxt-ui` MCP servers.
- [ ] AI prompts reference the correct `docs/` page and `shared/` utility.
