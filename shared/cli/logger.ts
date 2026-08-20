/**
 * Logger (CLI) — the backend Logger plus a `logHistory` buffer for crash dumps.
 *
 * CLI tools keep a buffer of recent log lines so that on a critical failure they can dump the
 * last lines to a notification (ntfy) or stderr before exiting (`Logger.getLogHistory()`).
 * Web services use the simpler `shared/backend/logger.ts`. See docs/09-config-and-logging.md
 * and docs/11-cli-and-infra.md.
 */
export class Logger {
	private static readonly logLevelMap = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
		critical: 4,
	} as const;

	private static logLevel: (typeof this.logLevelMap)[Logger.LogLevel] = this.logLevelMap.info;

	private static logHistory: string[] = [];

	static setLogLevel(level: Logger.LogLevel) {
		if (Logger.logLevelMap[level] === undefined) {
			throw new Error(`Invalid log level: ${level}`);
		}
		Logger.logLevel = Logger.logLevelMap[level];
	}

	static getLogLevel(): Logger.LogLevel {
		const match = Object.entries(Logger.logLevelMap).find(([, value]) => value === Logger.logLevel);
		return (match ? match[0] : "info") as Logger.LogLevel;
	}

	static getLogHistory(): string[] {
		return Logger.logHistory;
	}

	private static record(level: string, args: unknown[]) {
		Logger.logHistory.push(
			`[${new Date(Date.now()).toISOString()}] [${level}] ${args
				.map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a)))
				.join(" ")}`,
		);
	}

	static debug(...args: unknown[]) {
		if (Logger.logLevel <= Logger.logLevelMap.debug) {
			Logger.record("DEBUG", args);
			console.debug(`[${new Date(Date.now()).toISOString()}]`, "[DEBUG]", ...args);
		}
	}

	static log(...args: unknown[]) {
		if (Logger.logLevel <= Logger.logLevelMap.info) {
			Logger.record("INFO", args);
			console.log(`[${new Date(Date.now()).toISOString()}]`, "[INFO]", ...args);
		}
	}

	static info(...args: unknown[]) {
		if (Logger.logLevel <= Logger.logLevelMap.info) {
			Logger.record("INFO", args);
			console.info(`[${new Date(Date.now()).toISOString()}]`, "[INFO]", ...args);
		}
	}

	static warn(...args: unknown[]) {
		if (Logger.logLevel <= Logger.logLevelMap.warn) {
			Logger.record("WARN", args);
			console.warn(`[${new Date(Date.now()).toISOString()}]`, "[WARN]", ...args);
		}
	}

	static error(...args: unknown[]) {
		if (Logger.logLevel <= Logger.logLevelMap.error) {
			Logger.record("ERROR", args);
			console.error(`[${new Date(Date.now()).toISOString()}]`, "[ERROR]", ...args);
		}
	}

	static critical(...args: unknown[]) {
		if (Logger.logLevel <= Logger.logLevelMap.critical) {
			Logger.record("CRITICAL", args);
			console.error(`[${new Date(Date.now()).toISOString()}]`, "[CRITICAL]", ...args);
		}
	}
}

export namespace Logger {
	export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
}
