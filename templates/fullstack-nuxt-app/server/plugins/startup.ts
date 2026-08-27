import { defineNitroPlugin } from "nitropack/runtime";
import { ConfigHandler } from "../utils/config";
import { Logger } from "../utils/logger";
import { DB } from "../db";
import { API } from "../lib/api";

// Runs once at Nitro boot — replaces Main.main() from the standalone backend shape.
export default defineNitroPlugin(async () => {
	const config = await ConfigHandler.loadConfig();

	Logger.setLogLevel(config.LOG_LEVEL ?? "info");
	Logger.log("Starting <ProjectName> (full-stack Nuxt)...");

	DB.init(config.DB_PATH ?? "./data/db.sqlite", config.DB_AUTO_MIGRATE ?? true);
	await API.init(config.API_DISABLE_DOCS === true);
});