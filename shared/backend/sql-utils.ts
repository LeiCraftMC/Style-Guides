/**
 * SQLUtils — dialect-aware Drizzle column helpers.
 *
 * The ecosystem defaults to SQLite (bun-sqlite). For PostgreSQL or MySQL, mirror these with
 * that dialect's column builders and keep the per-dialect schema files in sync
 * (see Delivr-API's `src/db/schema/{sqlite,postgresql,mysql}.ts`). See docs/08-database.md.
 */
import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

export class SQLUtils {
	/** `created_at` column: unix-epoch milliseconds, non-null, defaulted to now. */
	static getCreatedAtColumn() {
		return integer("created_at", { mode: "number" }).notNull().default(sql`(unixepoch() * 1000)`);
	}

	/** Auto-incrementing integer primary key. */
	static primaryKeyIntAutoIncrement() {
		return integer("id").primaryKey({ autoIncrement: true });
	}
}
