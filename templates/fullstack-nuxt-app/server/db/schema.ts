import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { SQLUtils } from "./utils";

export const users = sqliteTable("users", {
	id: SQLUtils.primaryKeyIntAutoIncrement(),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	createdAt: SQLUtils.getCreatedAtColumn(),
});