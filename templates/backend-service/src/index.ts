import { ConfigHandler } from "./utils/config";
import { DB } from "./db";
import { API } from "./api";
import { Logger } from "./utils/logger";
import { registerShutdownHandlers } from "./main-shutdown";

export class Main {
	static async main() {
		registerShutdownHandlers({
			onShutdown: async (signal) => {
				Logger.log(`Received ${signal}, shutting down...`);
				await API.stop();
				DB.close();
			},
		});

		await ConfigHandler.loadConfig();
		const config = ConfigHandler.getConfig();

		Logger.setLogLevel(config.SVC_LOG_LEVEL ?? "info");
		Logger.log("Starting <ProjectName> API...");

		await DB.init(
			config.SVC_DB_PATH ?? ":memory:",
			config.SVC_DB_AUTO_MIGRATE ?? true,
			config.SVC_CONFIG_BASE_DIR ?? "./data",
		);

		// CORS: allow the frontend origin(s) (comma-separated in SVC_APP_URL).
		const frontendUrls = config.SVC_APP_URL
			? config.SVC_APP_URL.split(",").map((u) => u.trim()).filter(Boolean)
			: [];

		await API.init(frontendUrls, config.SVC_API_DISABLE_DOCS === true);
		await API.start(Number(config.SVC_API_PORT ?? 12500), config.SVC_API_HOST ?? "::");
	}
}

Main.main().catch((err) => {
	Logger.error("Fatal startup error:", err);
	process.exit(1);
});