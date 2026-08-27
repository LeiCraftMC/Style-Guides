# 16 — AI tooling

## `AGENTS.md` and `CLAUDE.md`

Every repo has an AI operating manual at its root:

- [`AGENTS.md`](../AGENTS.md) — generic instructions for any AI coding agent. Put project-wide rules
  here.
- [`CLAUDE.md`](../CLAUDE.md) — Claude-Code-specific additions. Point at the slash commands and MCP
  setup defined in `.claude/settings.json`.

In this style-guide repo, both files reference [`docs/`](.) and [`shared/`](../shared/) heavily. In
application repos, keep them short: point to this guide, then list repo-specific exceptions.

## `.claude/settings.json`

Claude Code configuration lives in a single `.claude/settings.json` at the repo root. It carries
three things: `commands` (the `/verify`, `/typecheck`, … slash commands), `mcpServers` (for Nuxt
projects), and `fileScan.exclude` (what Claude should not index).

### Slash commands

Define slash commands under the `commands` key. Each command has a `description` and a `prompt`:

```json
{
  "commands": {
    "verify": {
      "description": "Typecheck and run relevant tests",
      "prompt": "Verify the current work in this repository.\n\n1. Run `bun run typecheck` first.\n2. Then run the smallest relevant `bun test <file>` if a focused target is obvious; otherwise `bun test`.\n\nDo not stop at the first failure. Summarize what passed, what failed, and the next fix to make."
    },
    "typecheck": {
      "description": "Run the TypeScript typecheck",
      "prompt": "Run `bun run typecheck` and report any failures clearly. If it fails, identify the smallest code change needed to fix it."
    }
  }
}
```

The guide repo ships these commands in [`.claude/settings.json`](../.claude/settings.json):

- `/verify` — Biome + typecheck + tests.
- `/typecheck` — `bun run typecheck`.
- `/format` — `bunx biome format --write` then `bunx biome check`.
- `/test` — `bun run test`.

Canonical templates live in [`shared/config/`](../shared/config):

- [`claude-settings.backend.json`](../shared/config/claude-settings.backend.json) — backend service
  / CLI shape: `commands` + `fileScan` (no MCP).
- [`claude-settings.nuxt.json`](../shared/config/claude-settings.nuxt.json) — Nuxt app shape:
  `mcpServers` + `commands` (incl. `api-client`, `dev`) + `fileScan`.

Copy the matching one into a new project's `.claude/settings.json` and adjust the commands to the
project's scripts and ports.

### `fileScan.exclude`

List paths Claude should not scan (build output, deps, data dirs):

```json
{
  "fileScan": {
    "exclude": ["node_modules/**", ".git/**", "build/**", "dist/**", ".nuxt/**", ".output/**"]
  }
}
```

### Do not add `permissions.allow` rules

Permission grants are the user's to manage. The guide never ships `permissions.allow` entries in
`.claude/settings.json` — only `commands`, `mcpServers`, and `fileScan`. See
[17 — Decisions](17-decisions.md).

## MCP servers

Nuxt / frontend projects register the Nuxt and NuxtUI MCP servers in **two** places (this matches
the existing ecosystem repos):

1. `.vscode/mcp.json` — for VS Code / Cursor:

   ```json
   {
     "servers": {
       "nuxt": { "type": "http", "url": "https://nuxt.com/mcp" },
       "nuxt-ui": { "type": "http", "url": "https://ui.nuxt.com/mcp" }
     }
   }
   ```

2. `.claude/settings.json` — `mcpServers` with `"type": "url"`:

   ```json
   {
     "mcpServers": {
       "nuxt": { "type": "url", "url": "https://nuxt.com/mcp" },
       "nuxt-ui": { "type": "url", "url": "https://ui.nuxt.com/mcp" }
     }
   }
   ```

Copy [`shared/config/mcp.json`](../shared/config/mcp.json) to `.vscode/mcp.json` and use
[`shared/config/claude-settings.nuxt.json`](../shared/config/claude-settings.nuxt.json) for the
Claude side. Backend / CLI projects carry no MCP config.

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
- [ ] `.claude/settings.json` with `commands` (`verify`, `typecheck`, …) + `fileScan.exclude`.
- [ ] No `permissions.allow` rules shipped in `.claude/settings.json`.
- [ ] Nuxt projects: `.vscode/mcp.json` **and** `.claude/settings.json` `mcpServers` register
      `nuxt` + `nuxt-ui`.
- [ ] AI prompts reference the correct `docs/` page and `shared/` utility.