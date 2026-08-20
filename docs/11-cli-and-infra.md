# 11 — CLI tools and infrastructure

## `@cleverjs/cli`

CLI tools use [`@cleverjs/cli`](https://github.com/cleverjs/cli) as their command framework. Commands
extend `CLIBaseCommand`, the app wraps `CLIApp`, and a global `--log-level` flag gates output.

Canonical entrypoint in `src/index.ts`:

```ts
import { CLIApp, CLICommandArg } from "@cleverjs/cli";
import { Logger } from "./utils/logger";
import { VersionCMD } from "./commands/version-cmd";

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
	.use(async (args, _ctx, next) => {
		Logger.setLogLevel(args["log-level"]);
		return await next();
	})
	.handle(process.argv.slice(2), "shell");
```

Copy [`shared/cli/cli-app.example.ts`](../shared/cli/cli-app.example.ts) as `src/index.ts`.

## Commands

Each command is a `CLIBaseCommand` subclass in `src/commands/`:

```ts
import { CLIBaseCommand } from "@cleverjs/cli";

export class HelloCMD extends CLIBaseCommand {
	constructor() {
		super({ name: "hello", description: "Say hello", aliases: ["hi"] });
	}

	async run() {
		Logger.log("Hello from the CLI!");
		return true;
	}
}
```

Register it in the app: `.register(new HelloCMD())`.

## Version command

Every CLI has a `version` command. Copy [`shared/cli/version-cmd.ts`](../shared/cli/version-cmd.ts):

```ts
export class VersionCMD extends CLIBaseCommand {
	async run() {
		Logger.log(`my-tool ${process.env.APP_VERSION || "unknown"}`);
		return true;
	}
}
```

## Compiling to a single binary

Use `bun build --compile` to produce a single binary. The compile script lives in
`scripts/compile/`; copy the three files from [`shared/cli/compile/`](../shared/cli/compile/):

- `compiler.ts` — builds the `bun build --compile` command.
- `compileCMD.ts` — `auto`, `all`, and platform aliases.
- `index.ts` — entrypoint that wires the compile CLI.

Usage:

```bash
bun run compile auto 1.2.3            # host platform
bun run compile linux-x64-baseline 1.2.3
bun run compile all 1.2.3             # all platforms
bun run compile auto --no-version-tag # no -v<version> suffix
```

The compiler injects `APP_VERSION` via `--define` and targets `linux-x64-modern`,
`linux-x64-baseline`, and `linux-arm64`.

## CLI Logger

CLI tools use [`shared/cli/logger.ts`](../shared/cli/logger.ts), which extends the backend logger
with a `logHistory` buffer. On a critical failure, dump recent logs to a notification or stderr:

```ts
notifyAdmin(`Crash: ${Logger.getLogHistory().slice(-20).join("\n")}`);
```

## Environment loading

When a CLI needs an explicit env file, use `dotenv` in non-overwriting mode:

```ts
import { config as dotenvConfig } from "dotenv";

if (options.envFile) {
	dotenvConfig({ path: options.envFile, override: false });
}
```

## Entrypoint script

For services or long-running tools, provide a `scripts/entrypoint.ts` that calls `Main.main()`. The
compile script uses `./scripts/entrypoint.ts` as the default entrypoint.

## Docker

Backend services run in `debian:stable-slim` with Bun installed, or in a multi-stage build that
compiles the binary. See [14 — Deployment](14-deployment.md).

## Checklist

- [ ] CLI app uses `@cleverjs/cli` with a global `--log-level` flag.
- [ ] `VersionCMD` registered and reads `process.env.APP_VERSION`.
- [ ] Commands live in `src/commands/`.
- [ ] Compile script in `scripts/compile/` with `auto`, `all`, and platform targets.
- [ ] CLI uses `shared/cli/logger.ts` (with `logHistory` for crash dumps).
- [ ] Env-file load uses non-overwriting `dotenv`.
