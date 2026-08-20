/**
 * registerShutdownHandlers — graceful process teardown.
 *
 * Wires SIGINT / SIGTERM / uncaughtException / unhandledRejection so that `onShutdown` runs
 * once (stop the server, flush, close the DB), then the process exits. A second signal during
 * shutdown forces an immediate exit. Call this at the very top of `Main.main()`, before any
 * async work, so a crash anywhere still tears the process down cleanly.
 * See docs/04-backend-hono.md and docs/11-cli-and-infra.md.
 */
import { Logger } from "./logger";

export interface ShutdownOptions {
	/** Called once on the first shutdown signal — stop the server, flush, close the DB, etc. */
	onShutdown: (signal: string) => Promise<void> | void;
	/** Exit code after a graceful shutdown from a signal (default 0). */
	signalExitCode?: number;
	/** Exit code after an uncaught exception / unhandled rejection (default 1). */
	errorExitCode?: number;
}

export function registerShutdownHandlers(options: ShutdownOptions): void {
	let shuttingDown = false;

	const gracefulShutdown = async (signal: string, code: number) => {
		if (shuttingDown) {
			Logger.warn(`Received ${signal} during shutdown — forcing exit.`);
			process.exit(code);
		}
		shuttingDown = true;
		Logger.log(`Received ${signal}, shutting down...`);
		try {
			await options.onShutdown(signal);
		} catch (err) {
			Logger.error("Error during graceful shutdown:", err);
		}
		process.exit(code);
	};

	const handleUncaught = (err: unknown) => {
		Logger.error("Uncaught exception:", err);
		void gracefulShutdown("uncaughtException", options.errorExitCode ?? 1);
	};

	const handleRejection = (reason: unknown) => {
		Logger.error("Unhandled rejection:", reason);
		void gracefulShutdown("unhandledRejection", options.errorExitCode ?? 1);
	};

	process.once("SIGINT", (s) => void gracefulShutdown(s, options.signalExitCode ?? 0));
	process.once("SIGTERM", (s) => void gracefulShutdown(s, options.signalExitCode ?? 0));
	process.once("uncaughtException", handleUncaught);
	process.once("unhandledRejection", handleRejection);
}