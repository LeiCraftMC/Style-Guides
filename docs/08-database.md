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

Copy the pattern from [`shared/backend/sql-utils.ts`](../shared/backend/sql-utils.ts) and build a
local `DB` class:

```ts
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

export class DB {
	private static instance: ReturnType<typeof drizzle> | null = null;

	static init(path: string, autoMigrate: boolean) {
		const client = new Database(path);
		this.instance = drizzle({ client, schema });
		if (autoMigrate) {
			this.migrate();
		}
	}

	static instance() {
		if (!this.instance) throw new Error("DB not initialised");
		return this.instance;
	}

	static migrate() {
		// run drizzle migrations or push schema
	}

	static close() {
		// close the underlying sqlite client
	}
}

export namespace DB {
	export namespace Schema {
		export const users = schema.users;
		export const domains = schema.domains;
	}
	export namespace Models {
		export type User = typeof DB.Schema.users.$inferSelect;
		export type NewUser = typeof DB.Schema.users.$inferInsert;
	}
}
```

## Schema conventions

Tables are exported as camelCase constants mapped to snake_case table names. Columns are snake_case.

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { SQLUtils } from "./utils/sql-utils";

export const users = sqliteTable("users", {
	id: SQLUtils.primaryKeyIntAutoIncrement(),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
	createdAt: SQLUtils.getCreatedAtColumn(),
});
```

Shared column helpers from [`shared/backend/sql-utils.ts`](../shared/backend/sql-utils.ts):

- `SQLUtils.getCreatedAtColumn()` — `integer("created_at", { mode: "number" }).notNull().default(sql\`(unixepoch() * 1000)\`)`
- `SQLUtils.primaryKeyIntAutoIncrement()` — `integer("id").primaryKey({ autoIncrement: true })`

## Relations

Define relations in `schema.ts` so `drizzle-zod` select schemas expose nested objects:

```ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
	posts: many(posts),
}));
```

## Migrations

Commit generated migrations in `drizzle/` and run them at startup when `DB_AUTO_MIGRATE=true`.
Typical scripts:

```json
{
	"db:generate": "bun scripts/db-utils generate",
	"db:migrate": "bun scripts/db-utils migrate",
	"db:push": "bun scripts/db-utils push"
}
```

`scripts/db-utils.ts` wraps `drizzle-kit` commands with project config. For simple services,
`drizzle-kit push` at dev time is fine; production uses committed migrations + `drizzle-kit migrate`.

## Query style

Use Drizzle's type-safe query builder. Avoid raw SQL except for performance-critical paths or
SQLite-specific features.

```ts
const user = await DB.instance().query.users.findFirst({
	where: eq(users.id, userId),
	with: { posts: true },
});
```

For inserts/updates, build the object with the schema shape:

```ts
await DB.instance().insert(users).values({
	email: body.email,
	name: body.name,
}).returning();
```

## Zod schemas from tables

Use `createSelectSchema` / `createInsertSchema` from `drizzle-zod`:

```ts
import { createSelectSchema, createInsertSchema } from "drizzle-zod";

export namespace UserModel {
	export const Response = createSelectSchema(DB.Schema.users).omit({ passwordHash: true });
	export type Response = z.infer<typeof Response>;

	export const Body = createInsertSchema(DB.Schema.users).omit({ id: true, createdAt: true });
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

- [ ] `DB` is a static class with `init` / `instance` / `close`.
- [ ] Schema is in one place; tables exported under `DB.Schema`.
- [ ] Column helpers from `SQLUtils` used for `created_at` and `id`.
- [ ] `drizzle-zod` generates Zod schemas for API responses/bodies.
- [ ] Migrations committed to `drizzle/`.
- [ ] `DB_AUTO_MIGRATE` controls migration at startup.
- [ ] Multi-dialect projects keep dialect files isolated if needed.
