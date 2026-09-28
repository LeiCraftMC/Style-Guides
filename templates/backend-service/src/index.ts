import { API } from "./api";
import { EmailService } from "./api/utils/email";
import { DB } from "./db";
import { TaskScheduler } from "./tasks";
import { Utils } from "./utils";
import { ConfigHandler } from "./utils/config";
import { AppConstants } from "./utils/constants";
import { CronJobHandler } from "./utils/cron";
import { Logger } from "./utils/logger";

// biome-ignore format: keep the hand-formatted Main lifecycle layout
export class Main {
	static async main() {
		process.once("SIGINT", (type) => Main.gracefulShutdown(type, 0));
		process.once("SIGTERM", (type) => Main.gracefulShutdown(type, 0));

		process.once("uncaughtException", Main.handleUncaughtException);
		process.once("unhandledRejection", Main.handleUnhandledRejection);

		const config = await ConfigHandler.loadConfig();

		Logger.setLogLevel(config.LOG_LEVEL ?? "info");
		Logger.log(`Starting ${AppConstants.APP_NAME} API...`);

		await DB.init(config.DB_PATH, config.DB_AUTO_MIGRATE, config.CONFIG_BASE_DIR);

		await Utils.ensureDirectoryExists(config.LOG_DIR ?? "./data/logs");

		await TaskScheduler.processQueue();

		await EmailService.init();

		await CronJobHandler.init();
		await CronJobHandler.startAll();

		await API.init([config.APP_URL], config.API_DISABLE_DOCS === true);

		await API.start(config.API_PORT, config.API_HOST);
	}

	private static async gracefulShutdown(type: NodeJS.Signals, code: number) {
		try {
			Logger.log(`Received ${type}, shutting down...`);

			await CronJobHandler.stopAll();

			await API.stop();

			await EmailService.reset();
			await TaskScheduler.stopProcessing();

			await DB.close();

			Logger.log("Shutdown complete, exiting.");
			process.exit(code);
		} catch {
			Logger.critical("Error during shutdown, forcing exit");
			Main.forceShutdown();
		}
	}

	private static forceShutdown() {
		process.once("SIGTERM", () => {});
		process.exit(1);
	}

	private static async handleUncaughtException(error: Error) {
		Logger.critical(
			`Uncaught Exception:\n${Error.isError(error) ? (error.stack ? error.stack : error.message) : error}`,
		);
		Main.gracefulShutdown("SIGTERM", 1);
	}

	private static async handleUnhandledRejection(reason: any) {
		if (Error.isError(reason)) {
			// reason is an error
			return Main.handleUncaughtException(reason);
		}
		Logger.critical(`Unhandled Rejection:\n${reason}`);
		Main.gracefulShutdown("SIGTERM", 1);
	}
}

Main.main().catch((err) => {
	Logger.error("Fatal startup error:", err);
	process.exit(1);
});
