/**
 * SQLUtils + DrizzleDB — dialect-aware Drizzle helpers and the shared DB type.
 *
 * The ecosystem defaults to SQLite (bun-sqlite). `DrizzleDB` is the type used by the `DB` class
 * for its `db` field; `DrizzleDB.BunSQLite` is the concrete bun-sqlite instance type.
 * `SQLUtils.getCreatedAtColumn(name)` and `primaryKeyIntAutoIncrement(name)` keep schema files
 * consistent across projects. For PostgreSQL/MySQL, mirror these with that dialect's column
 * builders (see Delivr-API's `src/db/schema/{sqlite,postgresql,mysql}.ts`). See docs/08-database.md.
 */
import { type entityKind, sql } from "drizzle-orm";
import type { drizzle as drizzle_bun } from "drizzle-orm/bun-sqlite";
import { BaseSQLiteDatabase, integer } from "drizzle-orm/sqlite-core";

/**
 * A unified Drizzle database type. A `declare class` is used so the `DB` class can type its static
 * `db` field without committing to a single dialect at the type level.
 */
export declare class DrizzleDB extends BaseSQLiteDatabase<"async" | "sync", void, Record<string, never>> {
    static readonly [entityKind]: string;
    $client?: any;
    batch?: any;
}

export namespace DrizzleDB {
	/** Concrete `drizzle-orm/bun-sqlite` instance type. */
	export type BunSQLite = ReturnType<typeof drizzle_bun>;
}

export namespace SQLUtils {
	
	/** `created_at` column: unix-epoch milliseconds, non-null, defaulted to now. */
	export function getCreatedAtColumn(name: string = "created_at") {
		return integer(name, { mode: 'number' }).notNull().default(sql`(unixepoch() * 1000)`);
	}

	/** Auto-incrementing integer primary key named `name` (default `"id"`). */
	export function primaryKeyIntAutoIncrement(name: string = "id") {
		return integer(name).primaryKey({ autoIncrement: true });
	}
}
