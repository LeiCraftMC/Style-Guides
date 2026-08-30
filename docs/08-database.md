# 08 — Database (Drizzle + SQLite)

## Default stack

- **ORM:** Drizzle ORM.
- **Driver:** `bun-sqlite` for new services.
- **Schema definition:** `drizzle-orm/sqlite-core`.
- **Validation schema factory:** `drizzle-zod`.

The ecosystem has some multi-dialect services (Delivr supports SQLite, PostgreSQL, and MySQL). When
you need that, keep per-dialect schema files (e.g. `src/db/schema/{sqlite,postgresql,mysql}.ts`) and
switch on the config at runtime. New single-dialect services default to SQLite.

## `DB` static class

The `DB` class is a static singleton holding the Drizzle instance. It exposes the tables through the
**`DB.Tables`** namespace and the row types through **`DB.Models`** — *not* `DB.Schema`. The raw
`export const users = sqliteTable(...)` consts in `schema.ts` are kept for Drizzle's relation
definitions but marked `@deprecated Use DB.Tables.users` so callers go through the namespace.

The `db` field is typed `DrizzleDB` (from [`shared/backend/sql-utils.ts`](../shared/backend/sql-utils.ts)),
a unified declare-class type so the `DB` class doesn't commit to a single dialect at the type level.

```ts
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import * as TableSchema from "./schema";
import { type DrizzleDB } from "./utils";
import { Logger } from "../utils/logger";
import { ConfigHandler } from "../utils/config";

export class DB {
	protected static db: DrizzleDB;

	static async init(path: string, autoMigrate = false, configBaseDir: string) {
		await mkdir(dirname(path), { recursive: true });
		this.db = drizzle(path);
		if (autoMigrate) {
			Logger.info("Running database migrations...");
			await migrate(this.db, { migrationsFolder: "drizzle" });
			Logger.info("Database migrations completed.");
		}
		await this.createInitialAdminUserIfNeeded(configBaseDir); // see "Initial admin user" below
		Logger.info(`Database initialized at ${path}`);
	}

	static instance() {
		if (!this.db) throw new Error("DB not initialised. Call DB.init() first.");
		return DB.db;
	}

	static async close() {
		if (!this.db) return;
		Logger.info("Database connection closed.");
		this.db.$client.close();
		await Bun.sleep(500); // let the file handle flush on Windows
	}

	// createInitialAdminUserIfNeeded() lives here — see below.
}

export namespace DB.Tables {
	export const users = TableSchema.users;
	export const sessions = TableSchema.sessions;
	export const passwordResets = TableSchema.passwordResets;
	export const metadata = TableSchema.metadata;
}

export namespace DB.Models {
	export type User = typeof DB.Tables.users.$inferSelect;
	export type Session = typeof DB.Tables.sessions.$inferSelect;
	export type PasswordReset = typeof DB.Tables.passwordResets.$inferSelect;
	export type Metadata = typeof DB.Tables.metadata.$inferSelect;
}
```

> **`DB.Schema` vs `DB.Tables`:** older repos used `DB.Schema`. The current convention is
> `DB.Tables` for table objects and `DB.Models` for row types. Use `DB.Tables` in queries
> (`DB.instance().select().from(DB.Tables.users)`) and `DB.Models.User` for typing rows.

## Schema conventions

Tables are exported as camelCase constants mapped to snake_case table names. Columns are snake_case.
Each `export const` is marked `@deprecated Use DB.Tables.<name>` — it exists for Drizzle's relation
wiring and as the source for `DB.Tables`, but callers use `DB.Tables`.

The ecosystem's standard tables are `users`, `sessions`, `password_resets`, and a schemaless
`metadata` (JSON key/value) table. Roles are a string enum co-located with the user Zod policy in a
shared-models file (`UserAccountSettings.Roles`), not a boolean `is_admin` column.

```ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { SQLUtils } from "./utils";
import { UserAccountSettings } from "../lib/api/utils/shared-models/accountData";

/** @deprecated Use DB.Tables.users */
export const users = sqliteTable("users", {
	id: SQLUtils.primaryKeyIntAutoIncrement("id"),
	username: text().notNull().unique(),
	display_name: text().notNull(),
	email: text().notNull().unique(),
	password_hash: text().notNull(),
	role: text({ enum: UserAccountSettings.Roles }).default("user").notNull(),
	created_at: SQLUtils.getCreatedAtColumn(),
});

/** @deprecated Use DB.Tables.sessions */
export const sessions = sqliteTable("sessions", {
	id: text().primaryKey(),
	hashed_token: text().notNull(),
	user_id: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
	user_role: text({ enum: UserAccountSettings.Roles }).notNull(), // cached for fast permission checks
	created_at: SQLUtils.getCreatedAtColumn(),
	expires_at: integer().notNull(),
});

/** @deprecated Use DB.Tables.metadata — schemaless JSON key/value store. */
export const metadata = sqliteTable("metadata", {
	key: text().primaryKey(),
	data: text({ mode: "json" }).$type<Record<string, any> | Array<any>>().notNull(),
});
```

`UserAccountSettings.Roles` is `['admin', 'member'] as const` with a paired `z.enum` — define it
once in `server/lib/api/utils/shared-models/accountData.ts` (full-stack) or
`src/api/utils/shared-models/accountData.ts` (backend service) and reuse it in both the schema and
the auth/permission code so they can't drift.

Shared column helpers from [`shared/backend/sql-utils.ts`](../shared/backend/sql-utils.ts):

- `SQLUtils.getCreatedAtColumn(name = "created_at")` — `int(name, { mode: "number" }).notNull().default(sql\`(unixepoch() * 1000)\`)`
- `SQLUtils.primaryKeyIntAutoIncrement(name = "id")` — `int(name).primaryKey({ autoIncrement: true })`

## Relations

Define relations in `schema.ts` so `drizzle-zod` select schemas expose nested objects:

```ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
	posts: many(posts),
}));
```

## Migrations

Commit generated migrations in `drizzle/` and run them at startup when `<PREFIX>_DB_AUTO_MIGRATE=true`.
The `db:*` scripts prefix `bun scripts/db-utils.ts &&` (a tiny setup script that ensures `./data/`
exists) then call `drizzle-kit` with the config file:

```json
{
	"db:generate": "bun scripts/db-utils.ts && bunx --bun drizzle-kit generate --config=drizzle.config.ts",
	"db:migrate": "bun scripts/db-utils.ts && bunx --bun drizzle-kit migrate --config=drizzle.config.ts",
	"db:push": "bun scripts/db-utils.ts && bunx --bun drizzle-kit push --config=drizzle.config.ts"
}
```

`drizzle.config.ts` points at `server/db/schema.ts` (full-stack) or `src/db/schema.ts` (backend),
`out: "./drizzle"`, `dialect: "sqlite"`, and `dbCredentials.url` from `<PREFIX>_DB_PATH`. For simple
services, `db:push` at dev time is fine; production uses committed migrations + `db:migrate`.

## Initial admin user

On first boot (empty `users` table), `DB.init` seeds an `admin` user with a random password and
writes a one-time password-reset token to `<configBaseDir>/initial_admin_password_reset_token.txt`.
The reset URL is also logged. This is the canonical pattern (Status-Page, MindCode):

```ts
private static async createInitialAdminUserIfNeeded(configBaseDir: string) {
	const usersTableEmpty = (await this.db.select().from(DB.Tables.users).limit(1)).length === 0;
	if (!usersTableEmpty) return;

	const username = "admin";
	const admin_user_id = await this.db.insert(DB.Tables.users).values({
		username,
		email: "admin@appname.local",
		password_hash: await Bun.password.hash(randomBytes(32).toString("hex")),
		display_name: "Default Administrator",
		role: "admin",
	}).returning().get().id;

	const resetToken = randomBytes(64).toString("hex");
	await this.db.insert(DB.Tables.passwordResets).values({
		token: createHash("sha256").update(resetToken).digest("hex"),
		user_id: admin_user_id,
		expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
	});

	const APP_URL = ConfigHandler.getConfig()?.APPNAME_APP_URL || "https://{APP_URL}";
	await Bun.write(`${configBaseDir}/initial_admin_password_reset_token.txt`,
		`${APP_URL}/auth/reset-password?token=${resetToken}`, { mode: 0o600, createPath: true });
	Logger.info(`Initial admin user created. Set the password at ${APP_URL}/auth/reset-password?token=${resetToken}`);
}
```

Notes:
- Hash passwords with `Bun.password.hash` (argon2id); store only the hash.
- Store the **hashed** reset token in `password_resets` (the plaintext only appears in the written
  file + log, never in the DB).
- `configBaseDir` is the `<PREFIX>_CONFIG_BASE_DIR` env var — a writable dir for runtime artifacts.

## Query style

Use Drizzle's type-safe query builder against `DB.Tables`. Avoid raw SQL except for
performance-critical paths or SQLite-specific features.

```ts
const user = await DB.instance().query.users.findFirst({
	where: eq(DB.Tables.users.id, userId),
});
```

For inserts/updates, build the object with the schema shape:

```ts
await DB.instance().insert(DB.Tables.users).values({
	username: body.username,
	email: body.email,
	password_hash: hashed,
	display_name: body.displayName,
	role: "user",
}).returning();
```

## Zod schemas from tables

Use `createSelectSchema` / `createInsertSchema` from `drizzle-zod`, deriving from `DB.Tables`:

```ts
import { createSelectSchema, createInsertSchema } from "drizzle-zod";

export namespace UserModel {
	export const Response = createSelectSchema(DB.Tables.users).omit({ password_hash: true });
	export type Response = z.infer<typeof Response>;

	export const Body = createInsertSchema(DB.Tables.users).omit({ id: true, created_at: true, password_hash: true });
	export type Body = z.infer<typeof Body>;
}
```

## Transaction boundaries

Run multi-step operations inside a transaction when consistency matters:

```ts
await DB.instance().transaction(async (tx) => {
	const [user] = await tx.insert(users).values({ email }).returning();
	await tx.insert(profiles).values({ userId: user.id });
	return user;
});
```

## Testing

Integration tests boot the real `DB` with an in-memory SQLite database or a temp file, run
migrations, and seed fixtures. See [12 — Testing](12-testing.md).

## Checklist

- [ ] `DB` is a static class with `init` / `instance` / `close`; `db` typed `DrizzleDB`.
- [ ] Tables exported under `DB.Tables`; row types under `DB.Models`; raw consts `@deprecated`.
- [ ] Standard tables: `users`, `sessions`, `password_resets`, `metadata` (JSON).
- [ ] Roles via `UserAccountSettings.Roles` enum (not a boolean `is_admin`).
- [ ] Column helpers `SQLUtils.getCreatedAtColumn(name)` / `primaryKeyIntAutoIncrement(name)` used.
- [ ] `createInitialAdminUserIfNeeded` seeds the first admin + writes a reset token file.
- [ ] `drizzle-zod` generates Zod schemas for API responses/bodies from `DB.Tables`.
- [ ] Migrations committed to `drizzle/`; `db:generate`/`db:migrate`/`db:push` scripts use `--config=drizzle.config.ts`.
- [ ] `<PREFIX>_DB_AUTO_MIGRATE` controls migration at startup.
- [ ] Multi-dialect projects keep dialect files isolated if needed.
