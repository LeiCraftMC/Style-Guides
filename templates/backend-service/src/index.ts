import { API } from "./api";

import { DB } from "./db";
import { ConfigHandler } from "./utils/config";
import { Logger } from "./utils/logger";
import { Utils } from "./utils";
import { EmailService } from "./api/utils/email";

export class Main {

    static async main() {

        process.once("SIGINT", (type) => Main.gracefulShutdown(type, 0));
        process.once("SIGTERM", (type) => Main.gracefulShutdown(type, 0));

        process.once("uncaughtException", Main.handleUncaughtException);
        process.once("unhandledRejection", Main.handleUnhandledRejection);

        const config = await ConfigHandler.loadConfig();

		Logger.setLogLevel(config.APPPREFIX_LOG_LEVEL ?? "info");
		Logger.log("Starting <ProjectName> API...");

		await DB.init(
			config.APPPREFIX_DB_PATH ?? "./data/db.sqlite",
			config.APPPREFIX_DB_AUTO_MIGRATE,
			config.APPPREFIX_CONFIG_BASE_DIR ?? "./config",
		);

		await Utils.ensureDirectoryExists(config.APPPREFIX_LOG_DIR ?? "./data/logs");

        await TaskScheduler.processQueue();

		await EmailService.init();

		await CronJobHandler.init();
        await CronJobHandler.startAll();

		await API.init(
			[config.APPPREFIX_APP_URL || "https://api.app.local"],
			config.APPPREFIX_API_DISABLE_DOCS === true
		);

		await API.start(
			parseInt(config.APPPREFIX_API_PORT ?? "12500"),
            config.APPPREFIX_API_HOST ?? "::"
		);
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
        process.once("SIGTERM", ()=>{});
        process.exit(1);
    }

    private static async handleUncaughtException(error: Error) {
        Logger.critical(`Uncaught Exception:\n${Error.isError(error) ? error.stack ? error.stack : error.message : error}`);
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