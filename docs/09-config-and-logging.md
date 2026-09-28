# 09 — Configuration and logging

## Environment variables

Every service reads its config from environment variables at startup. Bun auto-loads `.env` in
development, so services do not need a `dotenv` call. In production, set env vars in the container
or systemd unit.

Variable names are `<PREFIX>_<KEY>`. The prefix is `AppConstants.APP_ENV_PREFIX` in
[`src/utils/constants.ts`](../shared/backend/src/utils/constants.ts) — the templates ship the
placeholder `APPPREFIX`; replace it with a short project prefix. There is no org-wide prefix:

- `DLA_` — Delivr API
- `NOWIP_` — NowIP
- `MINDCODE_` — MindCode
- `LCMC_VAULT_BACKUP_` — Vault backup tool
- `LCCFWSP_` — firewall service panel

The backend-service template's keys (the schema in `src/utils/config.ts` is the source of truth):

| Key (`APPPREFIX_…`) | Type | Default | Notes |
| --- | --- | --- | --- |
| `LOG_LEVEL` | enum | `info` | `debug` / `info` / `warn` / `error` / `critical` |
| `API_HOST` | string | `::` | backend-service only |
| `API_PORT` | number | `12500` | backend-service only |
| `API_DISABLE_DOCS` | boolean | `false` | disables `/docs/v1` + `/docs/v1/openapi` |
| `DB_PATH` | string | `./data/db.sqlite` | |
| `DB_AUTO_MIGRATE` | boolean | `true` | run migrations in `DB.init` |
| `LOG_DIR` | string | `./data/logs` | task log files go to `<LOG_DIR>/tasks/` |
| `CONFIG_BASE_DIR` | string | `./config` | writable dir for runtime artifacts (initial-admin reset URL) |
| `APP_URL` | string | — (**required**) | frontend URL: CORS origin, reset links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` | string / number / boolean | optional | email is disabled while `SMTP_HOST` is unset |

The full-stack template has the same keys **without `API_HOST` / `API_PORT`** (Nitro listens on
`PORT`); its browser-facing `runtimeConfig.public.appUrl` defaults to `APPPREFIX_APP_URL` at build
time and is overridden at runtime with `NUXT_PUBLIC_APP_URL`. The standalone `nuxt-app` has no
`ConfigHandler`; it reads `NUXT_PUBLIC_API_URL` and `NUXT_PUBLIC_APP_URL` through Nuxt's
`runtimeConfig`.

The backend template's [`example.env`](../templates/backend-service/example.env):

```
APPPREFIX_LOG_LEVEL=info

APPPREFIX_API_HOST=::
APPPREFIX_API_PORT=12500
# Booleans: any non-empty value (even "false") is true — leave empty for false; an unset variable falls back to the schema default.
APPPREFIX_API_DISABLE_DOCS=

APPPREFIX_DB_PATH=./data/db.sqlite
APPPREFIX_DB_AUTO_MIGRATE=true

APPPREFIX_LOG_DIR=./data/logs
APPPREFIX_CONFIG_BASE_DIR=./config

APPPREFIX_APP_URL=http://localhost:12510

APPPREFIX_SMTP_HOST=mail.example.com
APPPREFIX_SMTP_PORT=465
APPPREFIX_SMTP_USERNAME=user
APPPREFIX_SMTP_PASSWORD=
APPPREFIX_SMTP_FROM='"App" <system@app.example.com>'
APPPREFIX_SMTP_SECURE=true
```

Always provide an `example.env` with every variable documented. The real `.env` is gitignored.

## `ConfigSchema` and the `CS` builder

[`shared/backend/src/utils/config.ts`](../shared/backend/src/utils/config.ts) declares, coerces,
and validates the env vars with Zod. Each key is built with `CS` and then marked `.default(value)`,
`.optional()`, or neither (= required). From the template:

```ts
export class ConfigHandler {
	// Public so ENVConfigLike / ParsedConfig can derive from it without @ts-ignore.
	// Treat it as read-only.
	static schema = new ConfigSchema({
		LOG_LEVEL: CS.enum(["debug", "info", "warn", "error", "critical"]).default("info"),

		API_HOST: CS.string().default("::"),
		API_PORT: CS.number().default(12500),
		API_DISABLE_DOCS: CS.boolean().default(false),

		DB_PATH: CS.string().default("./data/db.sqlite"),
		DB_AUTO_MIGRATE: CS.boolean().default(true),

		LOG_DIR: CS.string().default("./data/logs"),
		CONFIG_BASE_DIR: CS.string().default("./config"),

		APP_URL: CS.string(),

		SMTP_HOST: CS.string().optional(),
		SMTP_PORT: CS.number().optional(),
		SMTP_USERNAME: CS.string().optional(),
		SMTP_PASSWORD: CS.string().optional(),
		SMTP_FROM: CS.string().optional(),
		SMTP_SECURE: CS.boolean().optional(),
	});

	private static config: ParsedConfig | null = null;

	/** You have to call {@link ConfigHandler.loadConfig} before trying to access the config. */
	static getConfig() {
		return this.config;
	}

	static async loadConfig() {
		if (this.config) return this.config;
		this.config = this.schema.parse();
		return this.config;
	}
}
```

Builders:

| Builder | Zod | Parses |
| --- | --- | --- |
| `CS.string()` | `z.string()` | the raw value |
| `CS.number()` | `z.coerce.number()` | `"12500"` → `12500` |
| `CS.boolean()` | `z.coerce.boolean()` | see the boolean rule below |
| `CS.enum([...])` | `z.enum([...])` | one of the listed values, **case-sensitive** (`INFO` fails) |
| `CS.array()` | string → `string[]` | comma-separated, trimmed, empty entries dropped |

Rules:

- The env name is `APPPREFIX_` + the key (`LOG_LEVEL` → `APPPREFIX_LOG_LEVEL`).
- A missing required or invalid value logs `Failed to read the environment variable <KEY>: <reason>`
  and exits with code 1.
- **Defaults live in the schema.** Don't re-default in `Main` or the Nitro plugin; pass `config.*`
  through.
- **Booleans: any non-empty value is `true` — including `"false"` and `"0"`. Leave the variable
  empty (`KEY=`) for `false`; an unset variable takes the schema default.** This is deliberate
  (`z.coerce.boolean()` is plain JavaScript truthiness; see
  [17 — Decisions](17-decisions.md#20-config-booleans-via-zcoerceboolean)):

  ```
  APPPREFIX_API_DISABLE_DOCS=true    # true  → docs disabled
  APPPREFIX_API_DISABLE_DOCS=false   # true  → docs disabled (!)
  APPPREFIX_API_DISABLE_DOCS=        # false → docs enabled
  # (variable absent)                # default false → docs enabled

  APPPREFIX_DB_AUTO_MIGRATE=         # false → no migrations at startup
  # (variable absent)                # default true → migrations run
  ```

- A default applies only when the variable is **unset**. An empty value is still a value: for an
  enum it fails validation, a number becomes `0`, a string stays `""`. Leave unused non-boolean
  variables out entirely.
- `ConfigHandler.loadConfig()` returns the parsed config — use that value at startup.
  `ConfigHandler.getConfig()` returns `ParsedConfig | null` (null before `loadConfig()`), so later
  callers use `ConfigHandler.getConfig()?.APP_URL` or assert it where startup guarantees it.
- Types: `ParsedConfig` is keyed by the short names (`config.APP_URL`); `ENVConfigLike` is keyed by
  the env names (`APPPREFIX_APP_URL`) — the test preload uses it to type its env block
  (`satisfies ENVConfigLike`).

## Logging

Backend and web services use [`shared/backend/src/utils/logger.ts`](../shared/backend/src/utils/logger.ts).
CLI tools use [`shared/cli/src/utils/logger.ts`](../shared/cli/src/utils/logger.ts), which adds a
`logHistory` buffer (`Logger.getLogHistory()`) for crash dumps.

Set the log level once at startup, right after loading config:

```ts
const config = await ConfigHandler.loadConfig();

Logger.setLogLevel(config.LOG_LEVEL ?? "info");
```

Methods: `Logger.debug`, `Logger.log` / `Logger.info` (both `INFO`), `Logger.warn`, `Logger.error`,
`Logger.critical`; `setLogLevel(level)` / `getLogLevel()`. Output goes to the console with an ISO
timestamp and the level:

```
[2026-08-20T12:34:56.789Z] [INFO] <ProjectName> API listening on http://[::]:12500
```

Levels: `debug < info < warn < error < critical`. Background tasks additionally write a per-task
file, `<LOG_DIR>/tasks/task-<id>.log`, through the `TaskScheduler`'s persistent logger.

### When to use each level

- `debug` — request details, query traces, verbose internals.
- `info` — startup, shutdown, major lifecycle events.
- `warn` — recoverable issues (rate-limit hit, SMTP not configured, deprecated API used).
- `error` — handled failures that need attention.
- `critical` — unrecoverable, page-now kind of failures (uncaught exceptions, failed shutdown).

Never use raw `console.log` in production code. Tests may use `console.log` for quick debugging, but
remove it before committing.

## CLI env loading

CLI tools that accept an explicit env-file option load it with `dotenv` in non-overwriting mode, so
the file does not stomp already-set environment variables (the CLI template ships `dotenv` as a
dependency but no env-file option — add one when you need it):

```ts
import { config as dotenvConfig } from "dotenv";

// envFile: the path from your command's parsed options
dotenvConfig({ path: envFile, override: false });
```

Web services do not do this; rely on Bun's built-in `.env` loading.

## Secrets

- Database paths, tokens, passwords, SMTP credentials, API keys: env vars only.
- Never commit secrets, even in examples.
- Rotate tokens by env var redeploy, not by code change.

## Checklist

- [ ] Env names are `<PREFIX>_<KEY>` with the project prefix in `AppConstants.APP_ENV_PREFIX`.
- [ ] `example.env` documents every variable; `.env` is gitignored.
- [ ] Every key is declared with `CS.*` in the `ConfigHandler.schema`; defaults live there.
- [ ] Booleans documented as "non-empty = true, empty = false, unset = schema default"; enums
  matched case-sensitively.
- [ ] `ConfigHandler.loadConfig()` runs before any other service init; `getConfig()` treated as
  nullable.
- [ ] Log level set from `APPPREFIX_LOG_LEVEL` at startup.
- [ ] Backend uses `shared/backend/src/utils/logger.ts`; CLI uses `shared/cli/src/utils/logger.ts`.
- [ ] No raw `console.log` in production code.
- [ ] CLI env-file load uses non-overwriting `dotenv`.
