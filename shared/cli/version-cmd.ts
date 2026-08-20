/**
 * VersionCMD — prints the baked-in `APP_VERSION` (set at compile time via
 * `--define "process.env.APP_VERSION=..."`). Registered on every CLI app. Replace
 * `<ProjectName>` with your tool's name. See docs/11-cli-and-infra.md.
 */
import { CLIBaseCommand } from "@cleverjs/cli";
// When copied into a project's src/commands/, change this import to "../utils/logger".
import { Logger } from "./logger";

export class VersionCMD extends CLIBaseCommand {
	constructor() {
		super({
			name: "version",
			description: "Prints the version of the tool.",
			aliases: ["-v", "--version"],
		});
	}

	async run() {
		const version = process.env.APP_VERSION || "unknown";
		Logger.log(`<ProjectName> ${version}`);
		return true;
	}
}
