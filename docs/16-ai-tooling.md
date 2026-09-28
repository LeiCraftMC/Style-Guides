# 16 — AI tooling

## `AGENTS.md` and `CLAUDE.md`

Every repo has an AI operating manual at its root:

- [`AGENTS.md`](../AGENTS.md) — generic instructions for any AI coding agent. Put project-wide rules
  here.
- [`CLAUDE.md`](../CLAUDE.md) — Claude-Code-specific additions. Point at the slash commands and MCP
  setup defined in `.claude/settings.json`.

In this style-guide repo, both files reference [`docs/`](.) and [`shared/`](../shared/) heavily. In
application repos, keep them short: point to this guide, then list repo-specific exceptions.

Every template ships both files, ready to adapt:

- `AGENTS.md` — "Must read" links into this guide for the shape, then the shape's non-negotiables
  (e.g. `useAPI` only, never hand-edit `*.gen.ts`, Biome before finishing, Conventional Commits).
  `static-site-with-docs` adds a **Docs** section (new pages go in `content/docs/`, register them in
  `app/data/docs.ts`).
- `CLAUDE.md` — the slash commands and MCP setup, plus shape notes: backend-service explains the
  `APPPREFIX`/`appprefix` placeholders, cli-tool the tag-triggered release, fullstack-nuxt-app the
  backend in `server/`, the static sites `bun run generate`.
- nuxt-app and fullstack-nuxt-app `CLAUDE.md` carry a **Frontend conventions** section: where the
  route map lives (`app/middleware/auth.global.ts`), auto-import component names, the Biome-in-`.vue`
  gotchas ([02](02-tooling.md#biome-in-vue-files)), and the per-user
  stores in `app/composables/stores/`. Keep that section when you adapt the file.

## `.claude/settings.json`

Claude Code configuration lives in a single `.claude/settings.json` at the repo root. It carries
three things: `commands` (the `/verify`, `/typecheck`, … slash commands), `mcpServers` (Nuxt-based
projects only), and `fileScan.exclude` (what Claude should not index). Every template ships one.

### Slash commands

Define slash commands under the `commands` key. Each command has a `description` and a `prompt`
(from [`claude-settings.backend.json`](../shared/config/claude-settings.backend.json)):

```json
{
	"commands": {
		"verify": {
			"description": "Typecheck and run relevant tests",
			"prompt": "Verify the current work in this repository.\n\n1. Run `bun run typecheck` first.\n2. Then run the smallest relevant `bun test <file>` command if a focused test target is obvious from the current changes.\n3. If no focused target is obvious, run `bun test`.\n\nDo not stop at the first failure. Summarize what passed, what failed, and the next fix to make."
		},
		"typecheck": {
			"description": "Run the TypeScript typecheck",
			"prompt": "Run `bun run typecheck` for this repository and report any failures clearly. If it fails, identify the smallest code change needed to fix it."
		}
	}
}
```

The guide repo ships these commands in [`.claude/settings.json`](../.claude/settings.json):

- `/verify` — `bun run check:ci` + `bun run typecheck`, plus a sanity check of any changed template.
- `/typecheck` — `bun run typecheck`.
- `/format` — `bunx biome format --write` then `bun run check:ci`.
- `/test` — `bun run test`.

One variant per project shape lives in [`shared/config/`](../shared/config) — each template's
`.claude/settings.json` is an exact copy of its variant:

| File | Template(s) | Commands | MCP |
| --- | --- | --- | --- |
| [`claude-settings.backend.json`](../shared/config/claude-settings.backend.json) | backend-service | `verify` (typecheck + focused or full `bun test`), `typecheck`, `test` | — |
| [`claude-settings.cli.json`](../shared/config/claude-settings.cli.json) | cli-tool | the backend three + `compile` (`bun run compile auto` / `all`) | — |
| [`claude-settings.nuxt.json`](../shared/config/claude-settings.nuxt.json) | nuxt-app | `api-client` (backend on 12500 with docs; openapi-ts + patch), `verify` (typecheck + `bun test`), `test`, `typecheck`, `dev` (port 12510) | yes |
| [`claude-settings.fullstack.json`](../shared/config/claude-settings.fullstack.json) | fullstack-nuxt-app | the nuxt set (`api-client` in-process, `dev` on 12520) + `db` (`db:generate` / `db:migrate`) | yes |
| [`claude-settings.static.json`](../shared/config/claude-settings.static.json) | static-site, static-site-with-docs | `verify` (`bun test` + `bun run build`), `test`, `typecheck` | yes |

Copy the matching one into a new project's `.claude/settings.json` and adjust the prompts to the
project's scripts and ports (the Nuxt prompts name the default ports).

### `fileScan.exclude`

List paths Claude should not scan (build output, deps, data dirs). The backend variant:

```json
{
	"fileScan": {
		"exclude": [
			"node_modules/**",
			".git/**",
			"data/**",
			"build/**",
			"drizzle/**",
			"coverage/**",
			"dist/**"
		]
	}
}
```

The Nuxt variants exclude `.nuxt/**`, `.output/**`, `.nitro/**`, `.cache/**` (and `.data/**`)
instead of `data/`, `build/` and `drizzle/`.

### Do not add `permissions.allow` rules

Permission grants are the user's to manage. The guide never ships `permissions.allow` entries in
`.claude/settings.json` — only `commands`, `mcpServers`, and `fileScan`. See
[17 — Decisions](17-decisions.md).

## MCP servers

Nuxt-based projects (nuxt-app, fullstack-nuxt-app, static-site, static-site-with-docs) register the
Nuxt and NuxtUI MCP servers in **two** places (this matches the existing ecosystem repos):

1. `.vscode/mcp.json` — for VS Code / Cursor, `"type": "http"`:

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

Copy [`shared/config/mcp.json`](../shared/config/mcp.json) to `.vscode/mcp.json`; the Claude side is
already in the nuxt, fullstack and static settings variants. Backend / CLI projects carry no MCP
config.

## Verifying `.vue` work

`bun run typecheck` type-checks `.vue` files (vue-tsc) alongside the `.ts` files, so a passing
typecheck does cover an edited page or component. An agent that edited `.vue` files must still:

- Run `bun run check:ci` — Biome errors must be zero; unused-binding **warnings** in `.vue` files
  are expected.
- Exercise the page when the change touches rendering or behaviour rather than types (dev server,
  or at least `bun run build` / `bun run generate`).

## Prompting conventions

When asking an AI to work in a LeiCraftMC repo, include enough context:

1. Reference the relevant `docs/` page.
2. Mention the project shape (backend / Nuxt / full-stack / static / CLI).
3. Point to the shared utility or template file that already solves the problem.

Example prompt:

> Add a POST /v1/servers route for LeiOS following docs/04-backend-hono.md and docs/05-api-contract.md.
> Use APIRouteSpec.authenticated + APIResponse.created. Derive the response schema from DB.Tables.servers
> with drizzle-zod. Add tests with makeAPIRequest from tests/helpers/api.ts.

## Avoiding generic advice

The guide exists so AI tools do not fall back to generic internet patterns. Explicitly forbidden
shortcuts:

- `@hono/zod-validator` — use `hono-openapi`'s validator (`zValidator`).
- Hand-editing `*.gen.ts` — regenerate from OpenAPI.
- Pinia or static `reactive()` for global state — use `AbstractStore` over `useState`.
- ESLint / Prettier — Biome is the formatter/linter.
- `@hono/swagger-ui` — use Scalar via `@scalar/hono-api-reference`.

## Checklist

- [ ] `AGENTS.md` and `CLAUDE.md` in every repo root (Nuxt apps keep the Frontend conventions).
- [ ] `.claude/settings.json` copied from the matching `shared/config/claude-settings.*.json`, with
      `commands` + `fileScan.exclude` adjusted to the project.
- [ ] No `permissions.allow` rules shipped in `.claude/settings.json`.
- [ ] Nuxt-based projects: `.vscode/mcp.json` **and** `.claude/settings.json` `mcpServers` register
      `nuxt` + `nuxt-ui`.
- [ ] `.vue` changes pass `bun run typecheck` and `bun run check:ci`.
- [ ] AI prompts reference the correct `docs/` page and `shared/` utility.
