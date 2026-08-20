/**
 * CLIApp skeleton — the canonical @cleverjs/cli entrypoint.
 *
 * A global `--log-level` enum flag, command registration, a `.use()` middleware that applies
 * the log level before dispatching, and `.handle(process.argv.slice(2), "shell")`. Commands
 * extend `CLIBaseCommand` (see `version-cmd.ts`). See docs/11-cli-and-infra.md.
 */
import { CLIApp, CLICommandArg } from "@cleverjs/cli";
import { VersionCMD } from "./commands/version-cmd";
import { Logger } from "./utils/logger";

new CLIApp({
	globalFlags: CLICommandArg.defineCLIFlagSpecs([
		{
			name: "log-level",
			type: "enum",
			allowedValues: ["debug", "info", "warn", "error", "critical"],
			description: "Set the log level for the application.",
			default: "info",
		},
	]),
	logger: Logger,
	exitOnError: true,
})
	.register(new VersionCMD())
	// .register(new YourCMD())
	.use(async (args, _ctx, next) => {
		Logger.setLogLevel(args["log-level"]);
		return await next();
	})
	.handle(process.argv.slice(2), "shell");
