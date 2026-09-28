import { CLIApp, CLICommandArg } from "@cleverjs/cli";
import { HelloCMD } from "./commands/hello-cmd";
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
	.register(new HelloCMD())
	.use(async (args, _ctx, next) => {
		Logger.setLogLevel(args["log-level"]);
		return await next();
	})
	.handle(process.argv.slice(2), "shell");
