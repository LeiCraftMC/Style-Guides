# 11 — CLI tools and infrastructure

## `@cleverjs/cli`

CLI tools use [`@cleverjs/cli`](https://github.com/cleverjs/cli) as their command framework. Commands
extend `CLIBaseCommand`, the app is a `CLIApp`, and a global `--log-level` flag gates output.

Canonical entrypoint in `src/index.ts` — copy
[`shared/cli/src/index.ts`](../shared/cli/src/index.ts) (same as
[`templates/cli-tool/src/index.ts`](../templates/cli-tool/src/index.ts)):

```ts
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
```

`bun run dev` runs this file with `--watch`; `bun run start` runs `scripts/entrypoint.ts` (see
[Entrypoint script](#entrypoint-script)).

## Commands

Each command is a `CLIBaseCommand` subclass in `src/commands/`. The constructor passes `name`,
`description` and optional `aliases`; `run()` returns `true` on success. From
[`shared/cli/src/commands/hello-cmd.ts`](../shared/cli/src/commands/hello-cmd.ts):

```ts
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
```

Register it in `src/index.ts`: `.register(new HelloCMD())`. Commands that take arguments declare
them with `CLICommandArg.defineCLIArgSpecs(...)` and pass them as `args` — see
[`scripts/compile/compileCMD.ts`](../shared/cli/scripts/compile/compileCMD.ts) for a worked example.

## Version command

Every CLI registers a `version` command (aliases `-v`, `--version`). Copy
[`shared/cli/src/commands/version-cmd.ts`](../shared/cli/src/commands/version-cmd.ts) and replace
`<ProjectName>`:

```ts
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
```

`APP_VERSION` is baked in at compile time (`--define`, see below); under `bun run dev` it prints
`unknown`.

## `AppConstants`

[`src/utils/constants.ts`](../shared/cli/src/utils/constants.ts) holds the project identity. The
compile script imports it, so it is **required** even in a CLI that uses nothing else from it:

```ts
export namespace AppConstants {
	export const APP_NAME = "<ProjectName>";
	export const APP_ENV_PREFIX = "APPPREFIX";
	export const APP_KEYS_PREFIX = "appprefix";
	export const BINARY_NAME = "my-project-api";
}
```

Set `BINARY_NAME` to your binary's name (the placeholder is the same in every template, including
the CLI). Services keep more constants here (ports, SMTP defaults) — see
[09 — Config & logging](09-config-and-logging.md).

## Compiling to a single binary

`bun build --compile` produces one self-contained executable. The compile script lives in
`scripts/compile/`; copy the three files from
[`shared/cli/scripts/compile/`](../shared/cli/scripts/compile/):

- `index.ts` — the compile CLI itself (`bun run ./scripts/compile`, built on `@cleverjs/cli`).
- `compileCMD.ts` — `auto` (aliases: every platform name) and `all`; resolves the version.
- `compiler.ts` — the `Platforms` enum and the `bun build --compile` command line.

Usage (`"compile": "bun run ./scripts/compile"` in `package.json`):

```bash
bun run compile auto                                # host platform, version from package.json
bun run compile auto 1.2.3                          # host platform, explicit version
bun run compile linux-x64-baseline --no-version-tag # what the service CI job runs
bun run compile all --no-version-tag                # every platform (CLI release workflow)
```

**Version.** `compile <target> <version>` uses the given version; without one it falls back to
`APP_TARGET_VERSION`, then to `package.json` `"version"`. `--no-version-tag` as the first argument
means "version from `package.json`, no `-v<version>` in the file name"; as the second argument
(`compile auto 1.2.3 --no-version-tag`) it only drops the suffix. Templates ship `"version": "0.1.0"`
— bump it before a release.

**Targets** (`Platforms` in `compiler.ts`):

| Name | Bun target |
| --- | --- |
| `linux-x64` | `bun-linux-x64-modern` (AVX2 CPUs) |
| `linux-x64-baseline` | `bun-linux-x64-baseline` (any x64; used by the Docker image) |
| `linux-arm64` | `bun-linux-arm64` |

The `win-*` and `macos-*` entries are commented out — binaries are **Linux-only** by default,
even though development happens on Windows. Uncomment them if a tool really needs them.

**Output path:** `./build/bin/<BINARY_NAME>[-v<version>][-<platform>]` — e.g.
`build/bin/my-project-api-v0.1.0` (`auto`) or `build/bin/my-project-api-linux-x64-baseline`
(`--no-version-tag`). `build/` is gitignored.

**The command** `compiler.ts` builds:

```bash
bun build --compile --sourcemap --minify --bytecode --format=esm ./scripts/entrypoint.ts \
  --outfile ./build/bin/<BINARY_NAME>-linux-x64 --target=bun-linux-x64-modern \
  --define "process.env.APP_VERSION='0.1.0'"
```

Services differ in two places
([`templates/backend-service/scripts/compile/compiler.ts`](../templates/backend-service/scripts/compile/compiler.ts)):

- `bytecode = false` — with Bun 1.4.0 a `--bytecode` service binary aborts at startup on Linux
  (JSC `UnlinkedArrayProfile` assertion). The CLI keeps bytecode on. Re-enable once Bun fixes it.
- `this.command.addArg("--asset ./drizzle/migrations")` — embeds the migrations in the binary as
  `migrations/…` (no `drizzle/` segment). `DB.init` switches to that folder when
  `Bun.isStandaloneExecutable` is set, so the binary migrates without any files next to it.

## Entrypoint script

`scripts/entrypoint.ts` is the compile entry and the target of `bun run start`. It differs per shape:

| Shape | `scripts/entrypoint.ts` |
| --- | --- |
| CLI | `import "../src/index";` |
| Backend service | sets `process.env.APPPREFIX_DB_AUTO_MIGRATE = "true"`, then `await import("../src/index")` |
| Full-stack Nuxt | same, but imports `../.output/server/index.mjs` — **not functional** (see below) |

`src/index.ts` must start the app on import (the backend's `Main` is self-invoked). The backend
entrypoint forces auto-migration on every start of the binary — see
[14 — Deployment](14-deployment.md#environment-in-production).

> The full-stack template's `scripts/compile/` and `scripts/entrypoint.ts` are left in place but do
> **not** produce a working binary: bundling `.output/` needs
> `--conditions=node --conditions=production`, and the result hangs at startup. CI does not use
> them; the full-stack app deploys as `.output/` on `oven/bun`
> ([14](14-deployment.md#full-stack-nuxt-hono-in-server)).

## CLI Logger

CLI tools use [`shared/cli/src/utils/logger.ts`](../shared/cli/src/utils/logger.ts). It is a
standalone class with the same API as the backend logger (`setLogLevel`, `getLogLevel`, `debug`,
`log`, `info`, `warn`, `error`, `critical`) **plus** a `logHistory` buffer: every emitted line is
also recorded, and `Logger.getLogHistory()` returns the list. It does not import or extend the
backend logger. On a critical failure, dump recent lines to a notification or stderr:

```ts
Logger.critical("Backup failed:", err);
await notifyError(Logger.getLogHistory().slice(-20).join("\n")); // your ntfy helper
```

## Environment loading

The template reads configuration straight from `process.env` (Bun loads `.env` automatically) and
ships no env-file flag. `dotenv` and `@cleverjs/utils` are in its `dependencies` but unused — drop
them if you don't need them. When a CLI needs an explicit env file, load it non-overwriting so it
does not stomp variables that are already set:

```ts
import { config as dotenvConfig } from "dotenv";

if (envFile) {
	dotenvConfig({ path: envFile, override: false });
}
```

## Docker

Services ship the **compiled binary only** — no Bun runtime, no multi-stage build. The backend
template's [`docker/Dockerfile`](../templates/backend-service/docker/Dockerfile) copies
`build/bin/${BINARY_NAME}-linux-x64-baseline` (`ARG BINARY_NAME=my-project-api`, must match
`AppConstants.BINARY_NAME`) into `debian:stable-slim`, and
[`docker/docker-compose.yml`](../templates/backend-service/docker/docker-compose.yml) runs it with
`APPPREFIX_*` env and a `./data:/data` volume. Build the binary first (CI does); details in
[14 — Deployment](14-deployment.md#backend-services).

The compose file publishes `12500:12500` on all interfaces, which is fine for local runs. On a
server behind a reverse proxy on the same host, bind loopback instead: `"127.0.0.1:12500:12500"`.

The CLI template has no Dockerfile. A CLI that must run in a container reuses the same
binary-in-slim-image pattern.

## Infrastructure / backup tools

Some repos are operational tooling, not user-facing apps — Vault is a Vaultwarden backup automation
CLI plus Docker packaging. The CLI conventions above all apply. These are **project patterns from
Vault, not template defaults** — adopt them when a tool needs them:

- **AES-256-GCM streaming crypto.** For encrypting large backup tarballs without buffering the whole
  file, reserve the 16-byte auth-tag slot up front, stream the encrypted payload, and back-write the
  tag after the pipeline finishes. PBKDF2 (100k iterations, sha256) derives the 32-byte key from a
  passphrase + 16-byte salt; layout is `salt(16) | iv(12) | ciphertext | authTag(16)`.
- **Binary envelope.** Pack the (optionally encrypted) payload into a custom container (`.lcmc`)
  with a header (version + timestamp) and an unlimited-length-prefixed body. `flexbuf` +
  `low-level` provide the typed binary encoding.
- **S3 + notifications + retention.** Upload the stream to S3-compatible storage, then post a
  result to an ntfy.sh-compatible endpoint: `notifySuccess` / `notifyWarning` / `notifyError`. The
  error path includes `Logger.getLogHistory().slice(-20)` so the alert carries recent context.
  Apply retention after every successful run: `RETENTION_DAYS` deletes old backups but keeps at
  least `RETENTION_MIN_COUNT` newest.
- **cosign image signing + GHA cache.** Vault signs every published image tag with
  `cosign sign --yes <tag>@<digest>`, skips `:latest` for pre-releases, and uses GitHub Actions'
  `type=gha` build cache. The templates' CI does none of this (it pushes `:latest` from the default
  branch, unsigned) — add it for publicly distributed images.
- **supervisord for app + cron.** When a container must run both an app and scheduled backups, use
  `supervisord` (`conf/services.ini`) to supervise `cron -f -l` and the app's `/start.sh` together,
  logging both to `/dev/fd/{1,2}` so they appear in `docker logs`.
- **Two-image split for branded web UI.** To layer a branded web vault onto an upstream server
  image, build three image tags: `noweb` (server only), `onlyweb` (web vault from the upstream
  release + local `web/patches/*.patch` + `web/resources/`), and `customweb` (`FROM noweb` +
  `COPY --from=onlyweb /web-vault ./web-vault`).
- **Config via env + mounted volume.** `<PREFIX>_*` env vars in compose; data dir mounted
  read-write (snapshots are written there); loopback-only port mapping (`127.0.0.1:<port>:80`)
  with a reverse proxy in front.

## Checklist

- [ ] `src/index.ts` from `shared/cli/src/index.ts`: `CLIApp` with global `--log-level`,
      `VersionCMD` registered.
- [ ] Commands live in `src/commands/`, pass `name`/`description`/`aliases` to `super`, log via
      `Logger`, return `true` from `run()`.
- [ ] `VersionCMD` prints `<ProjectName> ${version}` from `process.env.APP_VERSION`.
- [ ] `src/utils/constants.ts` exists and `AppConstants.BINARY_NAME` is set (the Dockerfile's
      `ARG BINARY_NAME` matches).
- [ ] `scripts/entrypoint.ts` matches the shape (CLI: `import "../src/index"`).
- [ ] `scripts/compile/` from `shared/cli/scripts/compile/`; targets `linux-x64`,
      `linux-x64-baseline`, `linux-arm64`.
- [ ] Services: `bytecode = false`, `--asset ./drizzle/migrations`, migrations committed.
- [ ] `package.json` `"version"` is set and bumped before tagging a release.
- [ ] CLI tools: `.github/workflows/release.yml` from `shared/config/github-actions/release.yml`.
- [ ] CLI uses `shared/cli/src/utils/logger.ts` (`logHistory` for crash dumps).
- [ ] Env-file loading (if any) uses non-overwriting `dotenv`.
- [ ] (Infra tools) streaming AES-256-GCM, S3 + ntfy + retention; cosign signing if images are
      published.
