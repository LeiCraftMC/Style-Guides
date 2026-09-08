import type { TaskHandler } from "@cleverjs/utils";
import { desc, sql, eq } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { SQLUtils } from "./utils";
import { UserAccountSettings } from "../api/utils/shared-models/accountData";

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

export const passwordResets = sqliteTable("password_resets", {
	token: text().primaryKey(),
	user_id: integer()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	created_at: SQLUtils.getCreatedAtColumn(),
	expires_at: integer().notNull(),
});

export const sessions = sqliteTable("sessions", {
	id: text().primaryKey(),
	hashed_token: text().notNull(),
	user_id: integer()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// we cache user role here for easier permission checking without having to join the users table, and we will check the role in users table on every update to make sure it's still valid
	user_role: text({
		enum: UserAccountSettings.Roles,
	}).notNull(),
	created_at: SQLUtils.getCreatedAtColumn(),
	expires_at: integer().notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
	id: text().primaryKey(),
	hashed_token: text().notNull(),
	user_id: integer()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// we cache user role here for easier permission checking without having to join the users table, and we will check the role in users table on every update to make sure it's still valid
	user_role: text({
		enum: UserAccountSettings.Roles,
	}).notNull(),
	description: text().notNull(),
	created_at: SQLUtils.getCreatedAtColumn(),
	expires_at: integer(),
});

export const userPreferences = sqliteTable("user_preferences", {
	id: SQLUtils.primaryKeyIntAutoIncrement("id"),
	user_id: integer()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	created_at: SQLUtils.getCreatedAtColumn(),

	// Preference key, e.g. "remote-content-policy".
	key: text().notNull(),
	data: text({ mode: "json" }).$type<Record<string, any> | Array<any>>().notNull(),
});

export const scheduled_tasks = sqliteTable("scheduled_tasks", {
	id: integer().primaryKey({ autoIncrement: true }),
	function: text().notNull(),
	created_by_user_id: integer().references(() => users.id, { onDelete: "set null" }),
	args: text({ mode: "json" }).$type<Record<string, any>>().notNull(),
	autoDelete: integer({ mode: "boolean" }).notNull().default(sql`0`),
	storeLogs: integer({ mode: "boolean" }).notNull().default(sql`0`),
	status: text({ enum: ["pending", "running", "paused", "failed", "completed"] })
		.notNull()
		.default("pending"),
	created_at: integer().notNull(),
	finished_at: integer(),
	result: text({ mode: "json" }).$type<Record<string, any>>(),
	message: text(),
});

export const scheduled_tasks_paused_state = sqliteTable("scheduled_tasks_paused_state", {
	task_id: integer()
		.primaryKey()
		.references(() => scheduled_tasks.id, { onDelete: "cascade" }),
	next_step_to_execute: integer().notNull(),
	data: text({ mode: "json" }).$type<TaskHandler.TempPausedTaskState["data"]>().notNull(),
});

export const metadata = sqliteTable("metadata", {
	key: text().primaryKey(),
	data: text({ mode: "json" }).$type<Record<string, any> | Array<any>>().notNull(),
});
