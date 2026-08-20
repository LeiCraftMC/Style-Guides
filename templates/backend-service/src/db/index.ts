import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { Logger } from "../utils/logger";

export class DB {
	private static instance: ReturnType<typeof drizzle> | null = null;
	private static client: Database | null = null;

	static init(path: string, autoMigrate: boolean) {
		this.client = new Database(path);
		this.instance = drizzle({ client: this.client, schema });
		Logger.log("Database initialized.");
		if (autoMigrate) {
			this.migrate();
		}
	}

	static instance() {
		if (!this.instance) throw new Error("DB not initialised");
		return this.instance;
	}

	static migrate() {
		if (!this.instance) throw new Error("DB not initialised");
		migrate(this.instance, { migrationsFolder: "./drizzle" });
		Logger.log("Database migrations applied.");
	}

	static close() {
		this.client?.close();
		this.client = null;
		this.instance = null;
	}
}

export namespace DB {
	export namespace Schema {
		export const users = schema.users;
	}
	export namespace Models {
		export type User = typeof DB.Schema.users.$inferSelect;
		export type NewUser = typeof DB.Schema.users.$inferInsert;
	}
}
