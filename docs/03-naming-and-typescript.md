# 03 — Naming & TypeScript style

## Naming

File names follow what the templates actually do — which is not one single rule. Source modules
are **camelCase**; a few established modules, CLI commands, scripts and tests are **kebab-case**.
Match the neighbouring files, never rename an established file just to make it fit, and use
camelCase for a new source module when in doubt.

| Thing | Convention | Examples |
| --- | --- | --- |
| Source modules (classes, utilities) | camelCase | `apiVersionRouter.ts`, `authHandler.ts`, `specHelpers.ts`, `cryptoKeys.ts`, `sampleTask.ts`, `abstractStore.ts`, `routeMatcher.ts` |
| Established kebab-case modules (keep) | kebab-case | `api-res.ts`, `shared-models/api-helper-models.ts` |
| CLI commands | kebab-case, `-cmd` suffix | `commands/version-cmd.ts`, `commands/hello-cmd.ts` |
| Scripts | kebab-case (the compile folder is camelCase inside) | `scripts/db-utils.ts`, `api-client-generate.ts`, `compile/compileCMD.ts` |
| Directories / route folders | kebab-case (single words lowercase) | `reset-password/`, `shared-models/`, `apikeys/`, `preferences/` |
| Route folder files | `index.ts` (router) + `model.ts` (schemas) | `routes/auth/{index.ts, model.ts}`, `routes/auth/reset-password/{index.ts, model.ts}` |
| Vue components | PascalCase in a domain subdir, used by auto-import name | `dashboard/DataTable.vue` → `<DashboardDataTable>`, `img/AppLogo.vue` → `<ImgAppLogo>` |
| Pages | kebab-case, `[param]` for dynamic segments | `auth/forgot-password.vue`, `apikeys/[api_key_id].vue` |
| Composables | `useXxx.ts`; stores in `composables/stores/` | `useAPI.ts`, `useAppCookies.ts`, `useGravatarURL.ts`, `stores/useUserStore.ts` |
| Route middleware | `*.global.ts` | `auth.global.ts`, `rewrites.global.ts` |
| Tests | `*.test.ts`, kebab-case | `api-routes-v1.test.ts`, `email.test.ts`, `basic.test.ts` |
| Classes (services) | PascalCase static singletons | `API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`, `TaskScheduler`, `CronJobHandler`, `Main` |
| Namespaces | PascalCase grouping | `DB.Tables`, `DB.Models`, `APIResponse.Schema`, `AuthHandler.AuthContext`, `Logger.LogLevel`, `AppConstants` |
| Types | PascalCase, paired with `z.infer` | `export type Body = z.infer<typeof Body>` |
| Functions / variables | camelCase | `makeAPIRequest`, `seedUser`, `sessionToken` |
| Constants | SCREAMING_SNAKE | `DOCS_TAGS`, `LOGIN_MAX_ATTEMPTS`, `DUMMY_PASSWORD_HASH`, `HOME_ROUTE`, `AppConstants.BINARY_NAME` |
| Env vars | `<PREFIX>_` + UPPER_SNAKE | `APPPREFIX_API_PORT` (template), `DLA_API_PORT`, `MINDCODE_DB_PATH` |
| DB tables | exported camelCase const → snake_case SQL table | `export const passwordResets = sqliteTable("password_resets", …)` |
| DB columns | snake_case | `user_id`, `created_at`, `password_hash`, `hashed_token` |
| Route path params | camelCase | `:apiKeyID`, `:userId` |

> The template schema still has two snake_case table consts (`scheduled_tasks`,
> `scheduled_tasks_paused_state`). Leave them; give new tables camelCase consts.

Env prefixes are **per-project** (`DLA_`, `LRA_`, `NOWIP_`, `MINDCODE_`, `LCMC_VAULT_BACKUP_`,
`LCCFWSP_`) — there is no org-wide prefix. Pick one short prefix when you start a project and use
it for env vars, token prefixes and the session cookie.

### Template placeholders

The templates ship placeholders you replace when you create a project:

| Placeholder | Meaning | Where |
| --- | --- | --- |
| `<ProjectName>` / `ProjectName` | Project name | `AppConstants.APP_NAME`, READMEs, SEO titles, logo/footer texts |
| `APPPREFIX` | Env-var prefix (upper case) | `AppConstants.APP_ENV_PREFIX`, `example.env`, `tests/helpers/preload.ts`, `scripts/entrypoint.ts`, `drizzle/configs/drizzle.config.ts`, `docker/`, both Nuxt `nuxt.config.ts` |
| `appprefix` | Token/key prefix (lower case) — session tokens and API keys start with it | `AppConstants.APP_KEYS_PREFIX` |
| `<PREFIX>` | Nuxt session-cookie prefix → `<PREFIX>_session_token` | `app/composables/useAppCookies.ts` |
| `my-project` | Docker WORKDIR base (`/opt/leicraftmc/my-project`) | every `docker/Dockerfile` + `docker/docker-compose.yml` |
| `gcr.leicraftmc.de/leicraftmc/my-project` | Registry image reference | every `docker/docker-compose.yml` `image:` — adjust to the project's registry (`$CI_REGISTRY_IMAGE`) |
| `my-project-api` | Compiled binary name | `AppConstants.BINARY_NAME`, backend `docker/Dockerfile` |

Also replace the default port if it collides with another app (see
[02 — Ports](02-tooling.md#ports--one-unique-port-per-app-dev--prod)). The templates ship no
`*.example.json` config files; runtime configuration comes from env vars (see
[09](09-config-and-logging.md)).

## TypeScript idioms

### Static-class services, no DI

A logical service is a class with `static` methods and `protected static` state — not a free
function, not an injected instance. `API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`,
`TaskScheduler`, `CronJobHandler` all follow this. There is no dependency-injection container.

```ts
export class DB {
	protected static db: DrizzleDB.BunSQLite;

	static async init(path: string, autoMigrate: boolean, configBaseDir: string) {
		// mkdir, `this.db = drizzle(path)`, optional migrate, initial admin …
	}

	static instance() {
		if (!this.db) {
			throw new Error("Database not initialized. Call DB.init() first.");
		}
		return DB.db;
	}
}
```

### Namespace-for-types

Group a service's types and Zod schemas under a `namespace` named after the class (or the model).
This co-locates related exports instead of scattering them across `types.ts` files:

```ts
export namespace DB.Tables {
	export const users = TableSchema.users;
	export const sessions = TableSchema.sessions;
}
export namespace DB.Models {
	export type User = typeof DB.Tables.users.$inferSelect;
}
export namespace AuthHandler {
	export type AuthContext = AuthenticatedAuthContext | UnauthenticatedAuthContext;
}
export namespace Logger {
	export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
}
```

> `DB.Tables` / `DB.Models` is the current convention (older repos used `DB.Schema`); see
> [08 — Database](08-database.md).

### `satisfies` for return shapes

Use `satisfies` to check an object literal against its expected type without widening it — it's
the preferred way to type token parts, auth contexts and response bodies:

```ts
return {
	prefix: SessionHandler.SESSION_TOKEN_PREFIX,
	id: parts[0].substring(SessionHandler.SESSION_TOKEN_PREFIX.length),
	base: parts[1],
} satisfies AuthHandler.TokenParts;

return APIResponse.success(c, "API key retrieved successfully",
	apiKeyWithoutSensitive satisfies AccountAPIKeysModel.GetById.Response);
```

### Zod schemas with paired `z.infer` types

Every Zod schema has a co-exported type. Models live in a namespace with `Body` / `Response` /
`Query` / `Params` exports. Two shapes are used in the ecosystem — **pick by depth**:

- **Dotted** — a top-level namespace *name* with a dot per operation: `namespace AuthModel.Login`.
  The templates use this form in every `model.ts`. Use it when nesting would go **two or more
  levels deep**, or when operations are read independently — the flat dotted name reads better
  than `AuthModel.Operation.Sub`:
  ```ts
  export namespace AuthModel.Login {
  	export const Body = z.object({ username: z.string(), password: z.string() });
  	export type Body = z.infer<typeof Body>;
  	export const Response = createSelectSchema(DB.Tables.sessions)
  		.omit({ id: true, hashed_token: true })
  		.extend({ token: z.string() });
  	export type Response = z.infer<typeof Response>;
  }
  ```
  Schemas shared by several operations go in a plain `namespace <Resource>Model { … }` block in
  the same file (e.g. `AdminUsersModel.SafeUser`, reused by `AdminUsersModel.GetAll`).
- **Nested** — one top-level `<Resource>Model` namespace with a nested namespace per operation
  (API-Server, Status-Page, MindCode). Fine for small, tightly-grouped schemas (one level of
  nesting):
  ```ts
  export namespace AdminUsersModel {
  	export namespace GetAll {
  		export const Query = z.object({ search: z.string().min(1).max(64).optional() });
  		export type Query = z.infer<typeof Query>;
  	}
  }
  ```

Both pair every schema with `export type X = z.infer<typeof X>`. Don't mix nested and dotted
operation namespaces inside one `model.ts`.

### Discriminated unions

Model state with a `type` discriminator rather than optional booleans — `AuthContext`
(`"session" | "apiKey" | "unauthenticated"`), `HealthStatus` (`healthy: true | false` with
disjoint fields). Narrow with `if (ctx.type === "session")`.

### `import type` and extensionless imports

`verbatimModuleSyntax: true` means types must come in via `import type` (or an inline `type`
modifier):

```ts
import { type GenerateSpecOptions } from "hono-openapi";          // inline type modifier
import type { APIVersionRouter } from "./utils/apiVersionRouter";  // type-only import
```

With `moduleResolution: "bundler"`, write **extensionless** imports (`from "./api-res"`, not
`from "./api-res.js"`). (Some older CLI repos use `.js` extensions — the guide standard is
extensionless for applications; reserve `.js` for publishable packages.)

### Hono context typing

The templates create routers with an **untyped** `new Hono()` and do not declare `Variables`. What
they do instead — and what new code should do:

- **Auth context:** always go through the `AuthHandler.AuthContext` helpers —
  `AuthHandler.AuthContext.get(c)`, `.getAsSession(c)`, `.getAsApiKey(c)`, `.set(c, ctx)`. The one
  `@ts-ignore` needed for the untyped context lives inside `AuthContext.get`; never call
  `c.get("authContext")` directly.
- **Other middleware-stashed values** (e.g. the `apiKey` loaded by `/:apiKeyID/*` in the API-keys
  router): the templates use `// @ts-ignore` + a cast at `c.set`/`c.get`. In new code prefer a
  typed router so the ignore goes away:
  ```ts
  type Variables = { apiKey: DB.Models.ApiKey };
  export const router = new Hono<{ Variables: Variables }>().basePath("/apikeys");
  // c.set("apiKey", apiKey) and c.get("apiKey") are now typed — no @ts-ignore.
  ```
  A typed sub-router mounts into the untyped parent with `router.route("/", …)` unchanged.
- **Unavoidable ignores** (e.g. `c.req.valid("param")`, which hono-openapi's validator doesn't
  type yet, or Scalar's `x-displayName` tag field): keep them on the single line that needs them
  and add the reason (`// @ts-ignore - hono-openapi does not type "param" yet`).

Don't churn existing `@ts-ignore`s in the templates or older repos; just don't add new ones where
a typed generic or an existing helper is cheap. See [17](17-decisions.md).
