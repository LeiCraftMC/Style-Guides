# 03 — Naming & TypeScript style

## Naming

| Thing | Convention | Examples |
| --- | --- | --- |
| Utility `.ts` files | camelCase | `api-res.ts`, `authHandler.ts`, `specHelpers.ts` |
| Multi-word dirs / route folders | kebab-case | `mail-accounts/`, `reset-password/`, `dns-server/` |
| Route folders | `index.ts` + `model.ts` | `routes/auth/{index.ts, model.ts}` |
| Vue components | PascalCase, domain-subdir | `dashboard/DataTable.vue`, `img/LeiOSLogo.vue` |
| Composables | `useXxx.ts` | `useAPI.ts`, `useAppCookies.ts`, `useGravatarURL.ts` |
| Route middleware | `*.global.ts` | `auth.global.ts`, `rewrites.global.ts` |
| Tests | `*.test.ts` | `api-routes-v1.test.ts`, `schemas.test.ts` |
| Config examples | `*.example.json` | `gateway.example.json` (real `config/` is gitignored) |
| Classes (services) | PascalCase static singletons | `API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`, `Main` |
| Namespaces | PascalCase grouping | `DB.Tables`, `APIResponse.Schema`, `AuthHandler.AuthContext`, `Logger.LogLevel` |
| Types | PascalCase, paired with `z.infer` | `export type Body = z.infer<typeof Body>` |
| Functions / variables | camelCase | `findFreePort`, `sessionToken` |
| Constants | SCREAMING_SNAKE | `DOCS_TAGS`, `LOGIN_MAX_ATTEMPTS`, `DUMMY_PASSWORD_HASH` |
| Env vars | `<PREFIX>_` + UPPER_SNAKE | `DLA_API_PORT`, `NOWIP_DNS_DOMAIN`, `MINDCODE_DB_PATH` |
| DB tables | exported const camelCase → snake_case table | `export const users = sqliteTable("users", …)` |
| DB columns | snake_case | `owner_user_id`, `created_at`, `password_hash` |
| Route path params | camelCase | `:publisherName`, `:mailAccountID` |

Env prefixes are **per-project** (`DLA_`, `LRA_`, `NOWIP_`, `MINDCODE_`, `LCMC_VAULT_BACKUP_`,
`LCCFWSP_`) — there is no org-wide prefix. Pick one short prefix when you start a project and use
it for env vars and the session cookie (`<prefix>_session_token`).

## TypeScript idioms

### Static-class services, no DI

A logical service is a class with `static` methods and `protected static` state — not a free
function, not an injected instance. `API`, `DB`, `Logger`, `ConfigHandler`, `AuthHandler`,
`ProviderManager`, `DNSServer` all follow this. There is no dependency-injection container.

```ts
export class DB {
	private static instance: DrizzleDatabase | null = null;
	static init(path: string, autoMigrate: boolean) { /* … */ this.instance = drizzle(path); }
	static instance(): DrizzleDatabase { if (!this.instance) throw new Error("DB not initialised"); return this.instance; }
}
```

### Namespace-for-types

Group a service's types and Zod schemas under a `namespace` named after the class (or the model).
This co-locates related exports instead of scattering them across `types.ts` files:

```ts
export namespace DB {
	export namespace Tables { export const users = TableSchema.users; export const domains = TableSchema.domains; }
	export namespace Models { export type User = typeof DB.Tables.users.$inferSelect; }
}
export namespace AuthHandler { export type AuthContext = { type: "session" … } | { type: "unauthenticated" }; }
export namespace Logger { export type LogLevel = "debug" | "info" | "warn" | "error" | "critical"; }
```

> `DB.Tables` / `DB.Models` is the current convention (older repos used `DB.Schema`); see
> [08 — Database](08-database.md).

### `satisfies` for return shapes

Use `satisfies` to narrow an object literal to its expected type without widening it — it's the
preferred way to type response bodies, config objects, and navigation items:

```ts
return { success: false, code: 500, message, data: null } as const satisfies APIResponse;
const items = [{ label: "Home", icon: "i-lucide-home", to: "/" }] satisfies NavigationMenuItem[];
```

### Zod schemas with paired `z.infer` types

Every Zod schema has a co-exported type. Models live in a namespace with `Body` / `Response` /
`Query` / `Params` exports. Two shapes are used in the ecosystem — **pick by depth**:

- **Nested** — one top-level `<Resource>Model` namespace with a nested namespace per operation. Use
  this for small, tightly-grouped schemas (one level of nesting):
  ```ts
  export namespace UsersPublicModel {
  	export namespace Search {
  		export const Query = z.object({ q: z.string().min(2), limit: z.coerce.number().int().default(10) });
  		export type Query = z.infer<typeof Query>;
  		export const Response = z.array(SafeUser);
  		export type Response = z.infer<typeof Response>;
  	}
  }
  ```
- **Dotted** — a top-level namespace *name* with a dot per operation: `namespace AuthModel.Login`.
  Use this when nesting would go **two or more levels deep**, or when operations are read
  independently — the flat dotted name reads better than `AuthModel.Operation.Sub`:
  ```ts
  export namespace AuthModel.Login {
  	export const Body = z.object({ username: z.string(), password: z.string() });
  	export type Body = z.infer<typeof Body>;
  	export const Response = createSelectSchema(DB.Tables.sessions).omit({ id: true, hashed_token: true }).extend({ token: z.string() });
  	export type Response = z.infer<typeof Response>;
  }
  ```

Both pair every schema with `export type X = z.infer<typeof X>`. Don't mix the two inside one
`model.ts`.

### Discriminated unions

Model state with a `type` discriminator rather than optional booleans — `AuthContext`
(`"session" | "apiKey" | "unauthenticated"`), `HealthStatus` (`healthy: true | false` with
disjoint fields). Narrow with `if (ctx.type === "session")`.

### `import type` and extensionless imports

`verbatimModuleSyntax: true` means types must come in via `import type`:

```ts
import { type Context } from "hono";          // value + type
import type { GenerateSpecOptions } from "hono-openapi";   // type only
```

With `moduleResolution: "bundler"`, write **extensionless** imports (`from "./api-res"`, not
`from "./api-res.js"`). (Some CLI repos use `.js` extensions — the guide standard is extensionless
for applications; reserve `.js` for publishable packages.)

### Hono context typing

The codebase reads middleware-stashed values with `// @ts-ignore` + `c.get("authContext") as …`
because the app doesn't declare typed `Variables`. **For new code, prefer a typed app** so the
context is statically known and the `@ts-ignore` goes away:

```ts
type AppVariables = { authContext: AuthHandler.AuthContext; publisher: Publisher };
const app = new Hono<{ Variables: AppVariables }>();
// then c.get("authContext") is typed — no @ts-ignore.
```

Existing repos keep the `@ts-ignore` form; don't churn them, but don't add new ignores if a typed
generic is cheap. See [17](17-decisions.md).