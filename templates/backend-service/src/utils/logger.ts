/**
 * Logger — leveled logging with ISO timestamps.
 *
 * The backend services use this clean form. CLI tools use the `logHistory`-extended
 * version in `shared/cli/logger.ts` so they can dump recent logs on a critical crash.
 * Gate the level at startup with `Logger.setLogLevel(config.<PREFIX>_LOG_LEVEL ?? "info")`.
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

	static setLogLevel(level: Logger.LogLevel) {
		if (this.logLevelMap[level] === undefined) {
			throw new Error(`Invalid log level: ${level}`);
		}
		this.logLevel = this.logLevelMap[level];
	}

	static getLogLevel(): Logger.LogLevel {
		const match = Object.entries(this.logLevelMap).find(([, value]) => value === this.logLevel);
		return (match ? match[0] : "info") as Logger.LogLevel;
	}

	static debug(...args: unknown[]) {
		if (this.logLevel <= this.logLevelMap.debug) {
			console.debug(`[${new Date(Date.now()).toISOString()}]`, "[DEBUG]", ...args);
		}
	}

	static log(...args: unknown[]) {
		if (this.logLevel <= this.logLevelMap.info) {
			console.log(`[${new Date(Date.now()).toISOString()}]`, "[INFO]", ...args);
		}
	}

	static info(...args: unknown[]) {
		if (this.logLevel <= this.logLevelMap.info) {
			console.info(`[${new Date(Date.now()).toISOString()}]`, "[INFO]", ...args);
		}
	}

	static warn(...args: unknown[]) {
		if (this.logLevel <= this.logLevelMap.warn) {
			console.warn(`[${new Date(Date.now()).toISOString()}]`, "[WARN]", ...args);
		}
	}

	static error(...args: unknown[]) {
		if (this.logLevel <= this.logLevelMap.error) {
			console.error(`[${new Date(Date.now()).toISOString()}]`, "[ERROR]", ...args);
		}
	}

	static critical(...args: unknown[]) {
		if (this.logLevel <= this.logLevelMap.critical) {
			console.error(`[${new Date(Date.now()).toISOString()}]`, "[CRITICAL]", ...args);
		}
	}
}

export namespace Logger {
	export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
}