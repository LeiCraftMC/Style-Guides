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

		Logger.setLogLevel(config.LOG_LEVEL ?? "info");
		Logger.log("Starting <ProjectName> API...");

		DB.init(config.DB_PATH ?? ":memory:", config.DB_AUTO_MIGRATE ?? true);
		await API.init(config.API_PORT ?? 3000);
	}
}

Main.main().catch((err) => {
	Logger.error("Fatal startup error:", err);
	process.exit(1);
});
