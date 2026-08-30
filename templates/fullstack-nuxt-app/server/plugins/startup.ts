import { defineNitroPlugin } from "nitropack/runtime";
import { ConfigHandler } from "../utils/config";
import { Logger } from "../utils/logger";
import { DB } from "../db";
import { API } from "../lib/api";

// Runs once at Nitro boot — replaces Main.main() from the standalone backend shape.
export default defineNitroPlugin(async () => {
	const config = await ConfigHandler.loadConfig();

	Logger.setLogLevel(config.FNA_LOG_LEVEL ?? "info");
	Logger.log("Starting <ProjectName> (full-stack Nuxt)...");

	await DB.init(
		config.FNA_DB_PATH ?? "./data/db.sqlite",
		config.FNA_DB_AUTO_MIGRATE ?? true,
		config.FNA_CONFIG_BASE_DIR ?? "./data",
	);
	await API.init(config.FNA_API_DISABLE_DOCS === true);
});