import { CLIBaseCommand } from "@cleverjs/cli";
import { Logger } from "../utils/logger";

export class HelloCMD extends CLIBaseCommand {
	constructor() {
		super({
			name: "hello",
			description: "Say hello.",
			aliases: ["hi"],
		});
	}

	async run() {
		Logger.log("Hello from <ProjectName> CLI!");
		return true;
	}
}
