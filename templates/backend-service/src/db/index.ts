import { drizzle } from "drizzle-orm/bun-sqlite";
import * as TableSchema from "./schema";
import { randomBytes as crypto_randomBytes, createHash as crypto_createHash } from "crypto";
import { type DrizzleDB } from "./utils";
import { Logger } from "../utils/logger";
import { eq } from "drizzle-orm";
import { ConfigHandler } from "../utils/config";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdir as fs_mkdir } from "fs/promises";
import { dirname as path_dirname } from "path";

export class DB {
	protected static db: DrizzleDB;

	static async init(path: string, autoMigrate: boolean = false, configBaseDir: string = "./config") {
		await fs_mkdir(path_dirname(path), { recursive: true });

		this.db = drizzle(path);
		if (autoMigrate) {
			Logger.info("Running database migrations...");
			await migrate(this.db, { migrationsFolder: "drizzle" });
			Logger.info("Database migrations completed.");
		}

		await this.createInitialAdminUserIfNeeded(configBaseDir);

		Logger.info(`Database initialized at ${path}`);
	}

	private static async createInitialAdminUserIfNeeded(configBaseDir: string) {
		const usersTableEmpty = (await this.db.select().from(DB.Tables.users).limit(1)).length === 0;
		if (!usersTableEmpty) return;

		const username = "admin";

		const admin_user_id = await this.db
			.insert(DB.Tables.users)
			.values({
				username,
				email: "admin@appname.local",
				password_hash: await Bun.password.hash(crypto_randomBytes(32).toString("hex")),
				display_name: "Default Administrator",
				role: "admin",
			})
			.returning()
			.get().id;

		const passwordResetToken = crypto_randomBytes(64).toString("hex");

		await this.db.insert(DB.Tables.passwordResets).values({
			token: crypto_createHash("sha256").update(passwordResetToken).digest("hex"),
			user_id: admin_user_id,
			expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 Days
		});

		const APP_URL = ConfigHandler.getConfig()?.SVC_APP_URL || "https://{APP_URL}";

		await Bun.write(
			`${configBaseDir}/initial_admin_password_reset_token.txt`,
			`${APP_URL}/auth/reset-password?token=${passwordResetToken}`,
			{
				mode: 0o600,
				createPath: true,
			},
		);

		Logger.info(
			`Initial admin user created with username: ${username}.\n` +
				`You can set the password under ${APP_URL}/auth/reset-password?token=${passwordResetToken}\n` +
				`The url is also saved at ${configBaseDir}/initial_admin_password_reset_token.txt\n`,
		);

		return admin_user_id;
	}

	static instance() {
		if (!this.db) {
			throw new Error("Database not initialized. Call DB.init() first.");
		}
		return DB.db;
	}

	static async close() {
		if (!this.db) return;

		Logger.info("Database connection closed.");
		this.db.$client.close();
		await Bun.sleep(500);
	}
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
