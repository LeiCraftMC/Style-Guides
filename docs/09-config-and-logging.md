# 09 — Configuration and logging

## Environment variables

Every project reads config from environment variables at startup. Bun auto-loads `.env` in
development, so services do not need a `dotenv` call. In production, set env vars in the container or
systemd unit.

Variable names use a short project prefix. There is no org-wide prefix:

- `DLA_` — Delivr API
- `NOWIP_` — NowIP
- `MINDCODE_` — MindCode
- `LCMC_VAULT_BACKUP_` — Vault backup tool
- `LCCFWSP_` — firewall service panel

Examples:

```
EXAMPLE_LOG_LEVEL=info
EXAMPLE_API_HOST=0.0.0.0
EXAMPLE_API_PORT=3000
EXAMPLE_API_DISABLE_DOCS=false
EXAMPLE_DB_PATH=./data/db.sqlite
EXAMPLE_DB_AUTO_MIGRATE=true
EXAMPLE_APP_URL=https://example.leicraftmc.de
```

Always provide an `example.env` with every variable documented. The real `.env` is gitignored.

## `ConfigSchema`

Use [`shared/backend/config-schema.ts`](../shared/backend/config-schema.ts) to declare, coerce, and
validate env vars. The builder chains `.add(KEY, required, type?)`:

```ts
const schema = new ConfigSchema()
	.add("EXAMPLE_LOG_LEVEL", false, ["debug", "info", "warn", "error", "critical"])
	.add("EXAMPLE_API_HOST", false)
	.add("EXAMPLE_API_PORT", false)
	.add("EXAMPLE_API_DISABLE_DOCS", false, [true, false])
	.add("EXAMPLE_DB_PATH", false)
	.add("EXAMPLE_DB_AUTO_MIGRATE", false, [true, false])
	.add("EXAMPLE_APP_URL", false);
```

Rules:

- Required missing variables call `Logger.error(...)` and `process.exit(1)`.
- Boolean types coerce `"true"` / `"false"` case-insensitively.
- Enum types validate case-insensitively against the allowed list.
- Default all optional variables to sensible values in `Main.main()` rather than requiring them.

Wrap the parsed config in a static `ConfigHandler`:

```ts
export class ConfigHandler {
	private static config: ParsedConfig | null = null;

	static getConfig(): ParsedConfig {
		if (!this.config) {
			throw new Error("Config not loaded. Call ConfigHandler.loadConfig() first.");
		}
		return this.config;
	}

	static async loadConfig(): Promise<ParsedConfig> {
		if (this.config) return this.config;
		this.config = schema.parse();
		return this.config;
	}
}
```

## Logging

Backend and web services use [`shared/backend/logger.ts`](../shared/backend/logger.ts). CLI tools use
[`shared/cli/logger.ts`](../shared/cli/logger.ts) which adds a `logHistory` buffer for crash dumps.

Set the log level once at startup:

```ts
Logger.setLogLevel(ConfigHandler.getConfig().LOG_LEVEL ?? "info");
```

Log format is ISO timestamp + level:

```
[2026-08-20T12:34:56.789Z] [INFO] Starting service on port 3000
```

Levels: `debug < info < warn < error < critical`.

### When to use each level

- `debug` — request details, query traces, verbose internals.
- `info` — startup, shutdown, major lifecycle events.
- `warn` — recoverable issues (rate-limit hit, deprecated API used).
- `error` — handled failures that need attention.
- `critical` — unrecoverable, page-now kind of failures.

Never use raw `console.log` in production code. Tests may use `console.log` for quick debugging, but
remove it before committing.

## CLI env loading

CLI tools that accept an explicit `--env` file use `dotenv` in non-overwriting mode so the file does
not stomp already-set environment variables:

```ts
import { config as dotenvConfig } from "dotenv";

if (options.envFile) {
	dotenvConfig({ path: options.envFile, override: false });
}
```

Web services do not do this; rely on Bun's built-in `.env` loading.

## Secrets

- Database paths, tokens, passwords, API keys: env vars only.
- Never commit secrets, even in examples.
- Rotate tokens by env var redeploy, not by code change.

## Checklist

- [ ] `example.env` documents every variable.
- [ ] `.env` is gitignored.
- [ ] `ConfigHandler.loadConfig()` runs before any other service init.
- [ ] Log level set from env var at startup.
- [ ] Backend uses `shared/backend/logger.ts`; CLI uses `shared/cli/logger.ts`.
- [ ] No raw `console.log` in production code.
- [ ] CLI env-file load uses non-overwriting `dotenv`.
