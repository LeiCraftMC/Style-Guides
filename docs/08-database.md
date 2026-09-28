# 08 — Database (Drizzle + SQLite)

The reference is [`templates/backend-service/src/db/`](../templates/backend-service/src/db/)
(`server/lib/db/` in the full-stack template — same files). `index.ts` and `schema.ts` are
template-only; the column helpers and `DrizzleDB` types are core
([`shared/backend/src/db/utils.ts`](../shared/backend/src/db/utils.ts)).

## Default stack

- **ORM:** Drizzle ORM (`drizzle-orm`), migrations with `drizzle-kit`.
- **Driver:** `drizzle-orm/bun-sqlite` (Bun's built-in `bun:sqlite`).
- **Schema definition:** `drizzle-orm/sqlite-core`.
- **Validation schema factory:** `drizzle-zod` (Zod 4).

The ecosystem has some multi-dialect services (Delivr supports SQLite, PostgreSQL, and MySQL). When
you need that, keep per-dialect schema files (e.g. `src/db/schema/{sqlite,postgresql,mysql}.ts`) and
switch on the config at runtime. New single-dialect services default to SQLite.

### Dual-target runtime (Bun + Cloudflare/D1)

*Optional, non-template pattern.* The templates are Bun-only. A full-stack Nuxt app that must ship
to **both** Bun and Cloudflare Pages (Status-Page) can copy the optional
[`shared/backend/src/utils/runtime.ts`](../shared/backend/src/utils/runtime.ts) (`Runtime.isBun`,
`Runtime.isCloudflare`, `Runtime.Password.hash/verify`) and branch `DB.init` on it. Sketch:

```ts
import { Runtime } from "../utils/runtime";

// inside DB.init(); `db` typed DrizzleDB (covers DrizzleDB.BunSQLite and DrizzleDB.D1)
if (Runtime.isBun) {
	const { drizzle } = await import("drizzle-orm/bun-sqlite");
	this.db = drizzle(path);
} else {
	const { drizzle } = await import("drizzle-orm/d1");
	this.db = drizzle(d1Binding); // the D1 binding from the Cloudflare request context
}
```

- Separate drizzle-kit configs per target (e.g. `drizzle/configs/{base,bun-sqlite,d1}.config.ts`;
  `base` is schema-only).
- `nuxt.config.ts`: `nitro.rollupConfig.external: ["bun:sqlite", "cloudflare:sockets"]` and two
  build scripts — `build:bun` (`--preset bun`) and `build:cf` (`--preset cloudflare_pages`).
- `Bun.password` is Bun-only. Hash through `Runtime.Password.hash(secret)` /
  `Runtime.Password.verify(hash, secret)` (PBKDF2 via Web Crypto on Cloudflare) — note the
  argument order is the reverse of `Bun.password.verify(secret, hash)`.

## `DB` static class

The `DB` class is a static singleton holding the Drizzle instance. It exposes the tables through
**`DB.Tables`** and the row types through **`DB.Models`**. From
[`src/db/index.ts`](../templates/backend-service/src/db/index.ts) (imports trimmed):

```ts
export class DB {
	protected static db: DrizzleDB.BunSQLite;

	static async init(path: string, autoMigrate: boolean, configBaseDir: string) {
		await fs_mkdir(path_dirname(path), { recursive: true });
		await fs_mkdir(configBaseDir, { recursive: true });

		this.db = drizzle(path);
		if (autoMigrate) {
			Logger.info("Running database migrations...");

			let migrationsFolder = "drizzle/migrations";
			//@ts-ignore
			if (Bun?.isStandaloneExecutable) {
				// `bun build --compile --asset ./drizzle/migrations` embeds the files as `migrations/...`
				// next to the entry (`/$bunfs/root/migrations` on Linux) — without the `drizzle/` segment.
				migrationsFolder = path_join(import.meta.dir, "migrations");
			}

			await migrate(this.db, { migrationsFolder });

			Logger.info("Database migrations completed.");
		}

		await this.createInitialAdminUserIfNeeded(configBaseDir);

		Logger.info(`Database initialized at ${path}`);
	}

	// createInitialAdminUserIfNeeded() — see "Initial admin user" below

	static instance() {
		if (!this.db) {
			throw new Error("Database not initialized. Call DB.init() first.");
		}
		return DB.db;
	}

	static async close() {
		if (!this.db) return;

		Logger.info("Database connection closed.");
		await this.db.$client.close();

		// Release the OS file handle now (unfinalized statements hold it until GC), e.g. for
		// tests that delete the DB directory right after closing.
		Bun.gc(true);
		await Bun.sleep(500);
	}
}

export namespace DB.Tables {
	export const users = TableSchema.users;
	export const sessions = TableSchema.sessions;
	export const passwordResets = TableSchema.passwordResets;
	export const apiKeys = TableSchema.apiKeys;

	export const userPreferences = TableSchema.userPreferences;

	export const scheduled_tasks = TableSchema.scheduled_tasks;
	export const scheduled_tasks_paused_state = TableSchema.scheduled_tasks_paused_state;

	export const metadata = TableSchema.metadata;
}

export namespace DB.Models {
	export type User = typeof DB.Tables.users.$inferSelect;
	export type Session = typeof DB.Tables.sessions.$inferSelect;
	export type PasswordReset = typeof DB.Tables.passwordResets.$inferSelect;
	export type ApiKey = typeof DB.Tables.apiKeys.$inferSelect;

	export type UserPreference = typeof DB.Tables.userPreferences.$inferSelect;

	export type ScheduledTask = typeof DB.Tables.scheduled_tasks.$inferSelect;
	export type ScheduledTaskPausedState = typeof DB.Tables.scheduled_tasks_paused_state.$inferSelect;

	export type Metadata = typeof DB.Tables.metadata.$inferSelect;
}
```

- `DB.init(path, autoMigrate, configBaseDir)` — all three come from config (`DB_PATH`,
  `DB_AUTO_MIGRATE`, `CONFIG_BASE_DIR`); it creates both directories.
- The instance is typed `DrizzleDB.BunSQLite`. The dialect-neutral declare-class **`DrizzleDB`**
  (from `db/utils.ts`) is the type for transaction handles and `tx` parameters.
- Use `DB.Tables` in queries and `DB.Models.<Row>` for typing rows — not `DB.Schema` (the older
  name) and not the raw schema consts.

## Schema conventions

Tables are exported from `schema.ts` as camelCase constants (`apiKeys`, `userPreferences`) mapped to
snake_case table names (`api_keys`, `user_preferences`); columns are snake_case. Each export is
marked `@deprecated Use DB.Tables.<name>` so callers go through the namespace.

The template's tables:

| Table | `DB.Tables.*` | Purpose |
| --- | --- | --- |
| `users` | `users` | Accounts: `username`, `display_name`, `email` (unique), `password_hash`, `role`. |
| `sessions` | `sessions` | Session tokens: `id` (token id), `hashed_token`, `user_id`, cached `user_role`, `expires_at`. |
| `api_keys` | `apiKeys` | API keys: like sessions plus `description`; `expires_at` nullable. |
| `password_resets` | `passwordResets` | `token` (SHA3-256 hash, primary key), `user_id`, `expires_at`. |
| `user_preferences` | `userPreferences` | Per-user JSON values, unique on `(user_id, key)` — used by `UserPreferencesHandler`. |
| `scheduled_tasks` (+ `scheduled_tasks_paused_state`) | `scheduled_tasks`, `scheduled_tasks_paused_state` | `TaskScheduler` persistence. |
| `metadata` | `metadata` | Global schemaless JSON key/value — used by `RuntimeMetadata`. |

From [`src/db/schema.ts`](../templates/backend-service/src/db/schema.ts) (trimmed):

```ts
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { UserAccountSettings } from "../api/utils/shared-models/accountData";
import { SQLUtils } from "./utils";

/**
 * @deprecated Use DB.Tables.users to access this table.
 */
export const users = sqliteTable("users", {
	id: SQLUtils.primaryKeyIntAutoIncrement("id"),

	username: text().notNull().unique(),
	display_name: text().notNull(),
	email: text().notNull().unique(),
	password_hash: text().notNull(),

	role: text({
		enum: UserAccountSettings.Roles,
	})
		.default("user")
		.notNull(),

	created_at: SQLUtils.getCreatedAtColumn(),
});

/**
 * @deprecated Use DB.Tables.apiKeys to access this table.
 */
export const apiKeys = sqliteTable("api_keys", {
	id: text().primaryKey(),
	hashed_token: text().notNull(),
	user_id: integer()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// cached for permission checks without joining users; updated when the user's role changes
	user_role: text({
		enum: UserAccountSettings.Roles,
	}).notNull(),
	description: text().notNull(),
	created_at: SQLUtils.getCreatedAtColumn(),
	expires_at: integer(),
});

/**
 * @deprecated Use DB.Tables.userPreferences to access this table.
 */
export const userPreferences = sqliteTable(
	"user_preferences",
	{
		id: SQLUtils.primaryKeyIntAutoIncrement("id"),
		user_id: integer()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		created_at: SQLUtils.getCreatedAtColumn(),

		key: text().notNull(),
		data: text({ mode: "json" }).$type<Record<string, any> | Array<any>>().notNull(),
	},
	(table) => [uniqueIndex("user_preferences_user_id_key_unique").on(table.user_id, table.key)],
);

/**
 * @deprecated Use DB.Tables.metadata to access this table.
 */
export const metadata = sqliteTable("metadata", {
	key: text().primaryKey(),
	data: text({ mode: "json" }).$type<Record<string, any> | Array<any>>().notNull(),
});
```

- Timestamps are Unix-epoch **milliseconds** in `integer` columns (`created_at` defaulted by
  `SQLUtils.getCreatedAtColumn()`, `expires_at` set in code with `Date.now() + …`).
- User-owned rows reference `users.id` with `onDelete: "cascade"`; the delete-account and
  delete-user routes still clean up explicitly inside a transaction.
- The task tables follow the `TaskHandler` field names (`function`, `autoDelete`, `storeLogs`, a
  plain `created_at` integer) — leave them as they are.

Roles are a string enum co-located with the user policies in the shared-models file, not a
boolean `is_admin` column
([`src/api/utils/shared-models/accountData.ts`](../templates/backend-service/src/api/utils/shared-models/accountData.ts);
`server/lib/api/utils/shared-models/accountData.ts` in the full-stack template):

```ts
export namespace UserAccountSettings {
	export const Roles = ["admin", "user"] as const;
	export const Role = z.enum(Roles);
	export type Role = z.infer<typeof Role>;
}
```

Use the same enum in the schema, the route models (`UserAccountSettings.Role.optional()`), and the
auth code (`newRole: UserAccountSettings.Role`) so they can't drift.

Shared column helpers from [`shared/backend/src/db/utils.ts`](../shared/backend/src/db/utils.ts):

- `SQLUtils.getCreatedAtColumn(name = "created_at")` —
  `integer(name, { mode: "number" }).notNull().default(sql\`(unixepoch() * 1000)\`)`
- `SQLUtils.primaryKeyIntAutoIncrement(name = "id")` — `integer(name).primaryKey({ autoIncrement: true })`

## Relations

The templates define no `relations()` — they query with explicit `where` clauses and don't pass a
schema to `drizzle(path)`. If a project wants Drizzle's relational query API
(`DB.instance().query.*`), define the relations in `schema.ts` next to the tables and pass the
schema module to `drizzle(path, { schema: TableSchema })`:

```ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	apiKeys: many(apiKeys),
}));
```

## Migrations

Migrations live in **`drizzle/migrations/`** and are committed. (In this style-guide repo the
templates' `drizzle/migrations/` are gitignored; real projects commit them.) The drizzle-kit config
is [`drizzle/configs/drizzle.config.ts`](../templates/backend-service/drizzle/configs/drizzle.config.ts):

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle/migrations",
	schema: "./src/db/schema.ts", // "./server/lib/db/schema.ts" in the full-stack template
	dialect: "sqlite",
	dbCredentials: {
		//@ts-ignore
		url: process.env.APPPREFIX_DB_PATH || "./data/db.sqlite",
	},
	verbose: true,
	strict: true,
});
```

Scripts (backend-service and fullstack-nuxt-app) — there is **no `db:push`**:

```json
{
	"db:generate": "bun scripts/db-utils && bunx --bun drizzle-kit generate --config=drizzle/configs/drizzle.config.ts",
	"db:migrate": "bun scripts/db-utils && bunx --bun drizzle-kit migrate --config=drizzle/configs/drizzle.config.ts"
}
```

`scripts/db-utils.ts` only makes sure `./data/` exists before drizzle-kit touches the DB.

Workflow: change `schema.ts` → `bun run db:generate` → commit the new files in
`drizzle/migrations/`. At startup, `DB.init` applies pending migrations when
`APPPREFIX_DB_AUTO_MIGRATE` is true (the default); otherwise run `bun run db:migrate`. The
migrations folder is resolved as:

- `drizzle/migrations` relative to the working directory (dev, tests, the full-stack Docker image,
  which ships `.output/` + `drizzle/migrations`);
- the files embedded in a compiled binary (`bun build --compile --asset ./drizzle/migrations`, see
  [11 — CLI & infra](11-cli-and-infra.md)), found at `migrations/` next to the entry
  (`/$bunfs/root/migrations`) when `Bun.isStandaloneExecutable` is true.

## Initial admin user

On first boot (empty `users` table), `DB.init` seeds an `admin` user with a random, unusable
password and a one-time password-reset link. From `src/db/index.ts`:

```ts
private static async createInitialAdminUserIfNeeded(configBaseDir: string) {
	const usersTableEmpty = (await this.db.select().from(DB.Tables.users).limit(1)).length === 0;
	if (!usersTableEmpty) return;

	const username = "admin";

	const admin_user_id = await this.db
		.insert(DB.Tables.users)
		.values({
			username,
			email: `${username}@${AppConstants.DEFAULT_EMAIL_FROM_HOST}`,
			password_hash: await Bun.password.hash(LCrypt.randomBytes(32).toString("hex")),
			display_name: "Default Administrator",
			role: "admin",
		})
		.returning()
		.get().id;

	const passwordResetToken = LCrypt.randomBytes(64).toString("hex");

	await this.db.insert(DB.Tables.passwordResets).values({
		token: LCrypt.sha256(passwordResetToken).toHex(),
		user_id: admin_user_id,
		expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 Days
	});

	const APP_URL = ConfigHandler.getConfig()?.APP_URL || "https://<app-url>";

	await Bun.write(
		`${configBaseDir}/initial_admin_password_reset_token.txt`,
		`${APP_URL}/auth/reset-password?token=${passwordResetToken}`,
		{
			mode: 0o600,
			createPath: true,
		},
	);

	// … Logger.info(...) with the username, the reset URL, and the file path

	return admin_user_id;
}
```

Notes:

- The reset token is stored as its **SHA3-256** hash (`LCrypt.sha256(...).toHex()` — the same
  function as `hashResetToken` in the reset-password route), so the normal
  `/auth/reset-password?token=…` page consumes it. It is valid for 7 days (reset links from the
  request endpoint: 1 hour).
- The plaintext token appears only in the written file (mode `0600`) and the log — never in the DB.
  The file contains the full reset **URL**: `<CONFIG_BASE_DIR>/initial_admin_password_reset_token.txt`.
- Passwords are hashed with `Bun.password.hash` (Bun's default, argon2id). See
  [10 — Authentication](10-auth.md) for which secrets use which hash.

## Query style

Use Drizzle's query builder against `DB.Tables`. Avoid raw SQL except for performance-critical
paths or SQLite-specific features.

```ts
const user = await DB.instance()
	.select()
	.from(DB.Tables.users)
	.where(eq(DB.Tables.users.id, authContext.user_id))
	.get();

const apiKeys = await DB.instance()
	.select()
	.from(DB.Tables.apiKeys)
	.where(eq(DB.Tables.apiKeys.user_id, authContext.user_id))
	.all();
```

Inserts and updates build the object with the schema shape; `.returning().get()` gives back the row:

```ts
const createdUser = await DB.instance()
	.insert(DB.Tables.users)
	.values({
		...userData,
		password_hash: await Bun.password.hash(password),
	})
	.returning()
	.get();

await DB.instance().update(DB.Tables.users).set(updates).where(eq(DB.Tables.users.id, user.id)).run();
```

- `bun-sqlite` is synchronous, so the template sometimes calls `.get()` / `.all()` without `await`.
  Prefer `await` — code written against `DrizzleDB` (transactions, helpers) must work with async
  drivers too.
- Optional filters: build a predicate and use `.$dynamic()` (see `GET /v1/admin/users`).
- Upserts: `.onConflictDoUpdate({ target: [...], set: {...} })` (see `UserPreferencesHandler.set`).

## Zod schemas from tables

Use `createSelectSchema` / `createInsertSchema` / `createUpdateSchema` from `drizzle-zod`, deriving
from `DB.Tables` and omitting secrets and server-managed columns:

```ts
export namespace AccountModel.GetInfo {
	export const Response = createSelectSchema(DB.Tables.users).omit({
		password_hash: true,
	});
	export type Response = z.infer<typeof Response>;
}

export namespace AccountModel.UpdateInfo {
	export const Body = createUpdateSchema(DB.Tables.users, {
		username: UserDataPolicies.Username,
		email: z.email("Invalid email"),
	})
		.omit({
			id: true,
			password_hash: true,
			role: true,
			created_at: true,
		})
		.partial();
	// the template additionally .refine()s "at least one field" and requires current_password
	export type Body = z.infer<typeof Body>;
}
```

See [05 — API contract](05-api-contract.md#route-models) for the model conventions.

## Transaction boundaries

Run multi-step writes inside a transaction. Type the handle as `DrizzleDB`, and pass it to helpers —
every DB-touching helper (`AuthHandler`, `SessionHandler`, `APIKeyHandler`,
`UserPreferencesHandler`, …) takes an optional trailing `tx: DrizzleDB = DB.instance()`. From the
reset-password route:

```ts
await DB.instance().transaction(async (tx: DrizzleDB) => {
	await tx
		.update(DB.Tables.users)
		.set({
			password_hash: newPasswordHash,
		})
		.where(eq(DB.Tables.users.id, user.id))
		.run();

	await AuthHandler.invalidateAllAuthContextsForUser(user.id, tx);

	await tx
		.delete(DB.Tables.passwordResets)
		.where(eq(DB.Tables.passwordResets.user_id, user.id))
		.run();
});
```

Write your own helpers the same way:

```ts
static async deleteAllForUser(userID: number, tx: DrizzleDB = DB.instance()): Promise<void> {
	await tx.delete(DB.Tables.userPreferences).where(eq(DB.Tables.userPreferences.user_id, userID));
}
```

## Testing

The test preload creates a temp directory (`tmp-data-*` in the project root), points the config at
it, and runs `DB.init(<tmp>/db.sqlite, true, <tmp>)` — the real migrations and the initial-admin
seed run against a fresh file for every test run; `afterAll` closes the DB and deletes the
directory. Seed rows with `seedUser(...)` / `seedSession(...)`. See [12 — Testing](12-testing.md).

## Checklist

- [ ] `DB` is a static class with `init(path, autoMigrate, configBaseDir)` / `instance()` /
  `close()`; `tx` parameters typed `DrizzleDB`.
- [ ] Tables exported under `DB.Tables`; row types under `DB.Models`; raw consts `@deprecated`.
- [ ] Standard tables: `users`, `sessions`, `api_keys`, `password_resets`, `user_preferences`,
  `metadata` (+ `scheduled_tasks*` when using `TaskScheduler`).
- [ ] Roles via `UserAccountSettings.Roles` (`["admin", "user"]`) / `Role`, not a boolean `is_admin`.
- [ ] Column helpers `SQLUtils.getCreatedAtColumn()` / `primaryKeyIntAutoIncrement()`; timestamps in
  epoch milliseconds.
- [ ] `createInitialAdminUserIfNeeded` seeds the first admin and writes the reset URL file.
- [ ] `drizzle-zod` derives API schemas from `DB.Tables`, omitting `password_hash` / `hashed_token`.
- [ ] Migrations committed in `drizzle/migrations/`; `db:generate` / `db:migrate` use
  `--config=drizzle/configs/drizzle.config.ts`; compiled binaries embed them with `--asset`.
- [ ] `APPPREFIX_DB_AUTO_MIGRATE` controls migration at startup.
- [ ] Multi-dialect projects keep dialect files isolated; the Bun + D1 `Runtime` is opt-in.
