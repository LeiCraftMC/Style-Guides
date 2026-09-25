# 04 — Backend architecture (Hono)

The reference implementation is [`templates/backend-service/`](../templates/backend-service/) (and
the same code under `server/lib/` in
[`templates/fullstack-nuxt-app/`](../templates/fullstack-nuxt-app/)). The core utilities are mirrored
in [`shared/backend/`](../shared/backend/); feature modules (email, tasks, cron, crypto, DB schema,
routes) are template-only.

## Lifecycle: `Main → API → VersionRouter → Routes`

A backend service is a static-class stack. There is no DI container and no `new` at the top level
besides the framework instances Hono itself needs.

```
Main.main()                                   // src/index.ts, self-invoked at the bottom
  ├─ process.once(SIGINT | SIGTERM | uncaughtException | unhandledRejection)
  ├─ ConfigHandler.loadConfig()
  ├─ Logger.setLogLevel(LOG_LEVEL)
  ├─ DB.init(DB_PATH, DB_AUTO_MIGRATE, CONFIG_BASE_DIR)   // bun-sqlite, migrations, initial admin
  ├─ Utils.ensureDirectoryExists(LOG_DIR)
  ├─ TaskScheduler.processQueue()             // resume pending/paused background tasks
  ├─ EmailService.init()                      // SMTP, or disabled when SMTP_HOST is unset
  ├─ CronJobHandler.init() + startAll()
  ├─ API.init([APP_URL], API_DISABLE_DOCS === true)
  │   ├─ prettyJSON, cors, onError
  │   ├─ /v1  → APIv1Router (authMiddlewareV1 → auth / account / admin routers)
  │   ├─ /docs/v1, /docs/v1/openapi           // unless docs are disabled
  │   └─ /health, /
  └─ API.start(API_PORT, API_HOST)            // Bun.serve
```

Shutdown is handled **inline in `Main`** — there is no separate shutdown module. From
[`src/index.ts`](../templates/backend-service/src/index.ts) (trimmed):

```ts
// biome-ignore format: keep the hand-formatted Main lifecycle layout
export class Main {
	static async main() {
		process.once("SIGINT", (type) => Main.gracefulShutdown(type, 0));
		process.once("SIGTERM", (type) => Main.gracefulShutdown(type, 0));

		process.once("uncaughtException", Main.handleUncaughtException);
		process.once("unhandledRejection", Main.handleUnhandledRejection);

		const config = await ConfigHandler.loadConfig();

		Logger.setLogLevel(config.LOG_LEVEL ?? "info");
		Logger.log(`Starting ${AppConstants.APP_NAME} API...`);

		await DB.init(config.DB_PATH, config.DB_AUTO_MIGRATE, config.CONFIG_BASE_DIR);

		await Utils.ensureDirectoryExists(config.LOG_DIR ?? "./data/logs");

		await TaskScheduler.processQueue();

		await EmailService.init();

		await CronJobHandler.init();
		await CronJobHandler.startAll();

		await API.init([config.APP_URL], config.API_DISABLE_DOCS === true);

		await API.start(config.API_PORT, config.API_HOST);
	}

	private static async gracefulShutdown(type: NodeJS.Signals, code: number) {
		try {
			Logger.log(`Received ${type}, shutting down...`);

			await CronJobHandler.stopAll();

			await API.stop();

			await EmailService.reset();
			await TaskScheduler.stopProcessing();

			await DB.close();

			Logger.log("Shutdown complete, exiting.");
			process.exit(code);
		} catch {
			Logger.critical("Error during shutdown, forcing exit");
			Main.forceShutdown();
		}
	}

	// forceShutdown(), handleUncaughtException(), handleUnhandledRejection() — see src/index.ts
}

Main.main().catch((err) => {
	Logger.error("Fatal startup error:", err);
	process.exit(1);
});
```

Rules:

- Keep the order: config → log level → DB → everything that needs the DB → API last. Shutdown runs
  in reverse (cron, API, email, tasks, DB).
- Defaults live in the config schema, so `Main` passes `config.*` straight through (see
  [09 — Config & logging](09-config-and-logging.md)).
- The `// biome-ignore format` comment keeps the one-step-per-paragraph layout; keep it.

## `APIVersionRouter`

Each major API version is a subclass of `APIVersionRouter` from
[`shared/backend/src/api/utils/apiVersionRouter.ts`](../shared/backend/src/api/utils/apiVersionRouter.ts).
The base stores `version`, `openAPIConfig`, and a `router` (`routes` accepts one Hono instance or an
array of Hono instances / `{ router }` objects). The template builds **one** v1 router, attaches the
auth middleware to it, and mounts the feature routers
([`versions/v1/index.ts`](../templates/backend-service/src/api/versions/v1/index.ts), trimmed):

```ts
import { Hono } from "hono";
import { type GenerateSpecOptions } from "hono-openapi";
import { AppConstants } from "../../../utils/constants";
import { APIVersionRouter } from "../../utils/apiVersionRouter";
import { authMiddlewareV1 } from "./middleware/auth";
import { router as accountRouter } from "./routes/account";
import { router as adminRouter } from "./routes/admin";
import { router as authRouter } from "./routes/auth";

const openAPIConfig: Partial<GenerateSpecOptions> = {
	documentation: {
		info: {
			title: `${AppConstants.APP_NAME} API`,
			version: "1.0.0",
			description: `API for ${AppConstants.APP_NAME} Frontend and third-party clients`,
		},
		// components, security, servers, x-tagGroups, tags — see "OpenAPI setup" below
	},
};

const router = new Hono();

router.use(authMiddlewareV1);

router.route("/", authRouter);
router.route("/", accountRouter);
router.route("/", adminRouter);

export class APIv1Router extends APIVersionRouter {
	constructor() {
		super({
			version: 1,
			openAPIConfig,
			routes: router,
		});
	}
}
```

There is no per-version health router — `/health` lives on the root app.

## `API` class skeleton

The `API` class ([`src/api/index.ts`](../templates/backend-service/src/api/index.ts)) is a static
singleton. It owns the root Hono app, registers versions and docs, and wraps `Bun.serve`. Keep it
focused on HTTP plumbing; business logic lives in route modules and the `AuthHandler` / `DB` /
service classes. Trimmed:

```ts
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { prettyJSON } from "hono/pretty-json";
import { openAPIRouteHandler } from "hono-openapi";
import { AppConstants } from "../utils/constants";
import { Logger } from "../utils/logger";
import type { APIVersionRouter } from "./utils/apiVersionRouter";
import { APIv1Router } from "./versions/v1";

export class API {
	protected static server: Bun.Server<undefined> | null = null;
	protected static app: Hono | null;

	protected static latestVersion: number | null = null;

	protected static registerVersion(versionRouter: APIVersionRouter, disableDocs: boolean) {
		if (!this.app) {
			throw new Error("API not initialized. Call API.init() first.");
		}

		this.app.route(`/v${versionRouter.version}`, versionRouter.router);

		if (!this.latestVersion || versionRouter.version > this.latestVersion) {
			this.latestVersion = versionRouter.version;
		}

		if (!disableDocs) {
			this.app.get(
				`/docs/v${versionRouter.version}/openapi`,
				openAPIRouteHandler(versionRouter.router, versionRouter.openAPIConfig),
			);

			this.app.get(
				`/docs/v${versionRouter.version}`,
				// Relative, so the docs page also finds its spec when the API is mounted under a prefix.
				Scalar({ url: `./v${versionRouter.version}/openapi` }),
			);
		}
	}

	static async init(frontendUrls: string[], disableDocs: boolean) {
		this.app = new Hono();

		this.app.use(prettyJSON());

		this.app.use(
			"*",
			cors({
				origin: frontendUrls,
				allowHeaders: ["Content-Type", "Authorization"],
				allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
				maxAge: 600,
				credentials: true,
			}),
		);

		this.app.onError((err, c) => {
			if (err instanceof HTTPException) {
				// Return only safe error metadata — never leak Zod validation details
				return c.json(
					{ success: false, code: err.status, message: "Your input is invalid" },
					err.status,
				);
			}

			Logger.error("Unhandled API error:", err);
			return c.json({ success: false, code: 500, message: "Internal Server Error" }, 500);
		});

		this.registerVersion(new APIv1Router(), disableDocs);

		this.app.get("/health", (c) => {
			return c.json({
				success: true,
				code: 200,
				message: `${AppConstants.APP_NAME} API is running`,
				data: null,
			});
		});

		// `/` → `<mount prefix>/docs/v<latest>`, or a "Documentation is disabled." envelope
		// when disableDocs is true — see src/api/index.ts
	}

	static async start(port: number, hostname: string) {
		if (!this.app) {
			throw new Error(`${AppConstants.APP_NAME} API not initialized. Call API.init() first.`);
		}
		this.server = Bun.serve({ port, hostname, fetch: this.app.fetch });
		// logs "<APP_NAME> API listening on http://[::]:12500"
	}

	static async stop() {
		if (this.server) {
			this.server.stop();
			Logger.log(`${AppConstants.APP_NAME} API server stopped.`);
		}
	}

	static getApp(): Hono {
		if (!this.app) {
			throw new Error(`${AppConstants.APP_NAME} API not initialized. Call API.init() first.`);
		}
		return this.app;
	}
}
```

What it serves:

| Path | What |
| --- | --- |
| `/v1/**` | The v1 router. |
| `/docs/v1` | Scalar UI. Its spec URL is **relative** (`./v1/openapi`) so it works under `/api`. |
| `/docs/v1/openapi` | Raw OpenAPI JSON (the contract the frontend client is generated from). |
| `/health` | `{ success: true, code: 200, message: "<APP_NAME> API is running", data: null }` |
| `/` | Redirect to `<mount prefix>/docs/v<latest>` (keeps e.g. `/api`), or a JSON envelope saying docs are disabled. |

`init()` never listens; `start(port, hostname)` does. Tests and the full-stack shape call only
`init()` and drive `API.getApp()` directly.

## Route conventions

A route folder mirrors the URL path. It contains an `index.ts` for handlers and a `model.ts` for
Zod schemas + inferred types. The template's tree:

```
src/api/
  index.ts                     # API class
  utils/                       # api-res, specHelpers, apiVersionRouter, authHandler,
                               # email, metadata, preferences, shared-models/
  versions/v1/
    index.ts                   # openAPIConfig + APIv1Router
    docs/index.ts              # DOCS_TAGS
    middleware/auth.ts         # authMiddlewareV1
    routes/
      auth/                    # POST /login, GET /session, POST /logout
        reset-password/        # POST / (consume token), POST /request
      account/                 # session guard; GET, PUT, DELETE /; PUT /password
        apikeys/               # GET /, POST /, GET /:apiKeyID, DELETE /:apiKeyID
        preferences/           # GET / (all), GET /onboarding, PUT /onboarding
      admin/                   # admin guard (user_role === "admin")
        users/                 # GET, POST /; GET, PUT, DELETE /:userId; PUT /:userId/password
```

So the full paths are `/v1/auth/login`, `/v1/account/apikeys/:apiKeyID`, `/v1/admin/users/:userId`,
and so on (prefixed with `/api` in the full-stack shape).

Each router is a plain `Hono` with a `basePath`; sub-routers are mounted at the end of the parent
file with a dynamic import, and their `basePath` is relative to the parent's:

```ts
// routes/account/index.ts
export const router = new Hono().basePath("/account");
// … guard + routes …
router.route("/", (await import("./apikeys")).router);
router.route("/", (await import("./preferences")).router);
```

Register each endpoint as **`APIRouteSpec.*` first, then `zValidator(...)`, then the handler**. The
validator is hono-openapi's `validator` — there is no `zValidator` export, so alias it on import
(some template files import it as plain `validator`; it is the same function). The whole
preferences router ([`routes/account/preferences/index.ts`](../templates/backend-service/src/api/versions/v1/routes/account/preferences/index.ts),
GET-all route trimmed):

```ts
import { Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import { APIResponse } from "../../../../../utils/api-res";
import { AuthHandler } from "../../../../../utils/authHandler";
import { UserPreferencesHandler } from "../../../../../utils/preferences";
import { APIResponseSpec, APIRouteSpec } from "../../../../../utils/specHelpers";
import { DOCS_TAGS } from "../../../docs";
import { AccountPreferencesModel } from "./model";

export const router = new Hono().basePath("/preferences");

router.get(
	"/onboarding",

	APIRouteSpec.authenticated({
		summary: "Get onboarding state",
		description:
			"Retrieve whether the authenticated user has completed the one-time, platform-wide welcome onboarding.",
		tags: [DOCS_TAGS.ACCOUNT_PREFERENCES],

		responses: APIResponseSpec.describeBasic(
			APIResponseSpec.success(
				"Onboarding state retrieved successfully",
				AccountPreferencesModel.Onboarding.Response,
			),
		),
	}),

	async (c) => {
		const authContext = AuthHandler.AuthContext.getAsSession(c);

		const preference = await UserPreferencesHandler.getOnboarding(authContext.user_id);

		return APIResponse.success(c, "Onboarding state retrieved successfully", preference);
	},
);

router.put(
	"/onboarding",

	APIRouteSpec.authenticated({
		summary: "Update onboarding state",
		description:
			"Set whether the authenticated user has completed the one-time, platform-wide welcome onboarding.",
		tags: [DOCS_TAGS.ACCOUNT_PREFERENCES],

		responses: APIResponseSpec.describeWithWrongInputs(
			APIResponseSpec.successNoData("Onboarding state updated successfully"),
		),
	}),

	zValidator("json", AccountPreferencesModel.Onboarding.Body),

	async (c) => {
		const authContext = AuthHandler.AuthContext.getAsSession(c);

		const body = c.req.valid("json");

		await UserPreferencesHandler.setOnboarding(authContext.user_id, body);

		return APIResponse.successNoData(c, "Onboarding state updated successfully");
	},
);
```

Use `describeWithWrongInputs(...)` whenever the route validates a body, query, or params; it appends
the 400 response. For routes without input use `describeBasic(...)`. See
[05 — API contract](05-api-contract.md) for the response builders and model conventions.

Routers are untyped `new Hono()` (no `Variables` generic). Read and write the auth context only
through `AuthHandler.AuthContext.get(c)` / `getAsSession(c)` / `getAsApiKey(c)` / `set(c, ctx)`.
`getAsSession` / `getAsApiKey` are unchecked casts — use them only behind a guard that already
established the context type (the account router's session guard, for example).

## Error handling

Do **not** throw inside route handlers to return client errors. Use the typed `APIResponse.*`
helpers so the runtime shape, the OpenAPI spec, and the generated client stay in sync:

```ts
if (!apiKey) {
	return APIResponse.notFound(c, "API key not found");
}
if (authContext.user_role !== "admin") {
	return APIResponse.forbidden(c, "This endpoint is restricted to administrators");
}
```

Unexpected failures are either caught in the handler (`Logger.error(...)` +
`APIResponse.serverError(c, "Failed to …")`, the template's pattern around transactions) or bubble
up to `onError`, which logs and returns `{ success: false, code: 500, message: "Internal Server
Error" }`.

Validation errors take two paths — know both:

- **Malformed JSON** (and other `HTTPException`s) go through `onError` and return the envelope
  `{ success: false, code: 400, message: "Your input is invalid" }`.
- **Schema failures** from `zValidator` are answered directly by `@hono/standard-validator` with
  status 400 and its own body, `{ success: false, error: [/* Zod issues */], data: <the input> }` —
  **not** the envelope (no `code`/`message`), and it echoes the input and the issues. The templates
  accept this; if a project needs the envelope here, pass a hook as the validator's third argument
  that returns `APIResponse.badRequest(...)`.

## Authentication middleware

Auth is covered in detail in [10 — Authentication](10-auth.md). The short form:

- `authMiddlewareV1` ([`shared/backend/src/api/versions/v1/middleware/auth.ts`](../shared/backend/src/api/versions/v1/middleware/auth.ts))
  runs on every `/v1` request (`router.use(authMiddlewareV1)`).
- No `Authorization` header → an `unauthenticated` context, request continues.
- A non-Bearer header or an unknown/expired token → 401 (`"Invalid Authorization header"` /
  `"Invalid or expired token"`), **except** on the public auth paths (`/v1/auth/login`,
  `/v1/auth/signup`, `/v1/auth/reset-password…`), where the request continues as `unauthenticated`
  so a stale cookie can't lock anyone out. The path check starts at `/v1/`, so it also works under
  `/api`.
- A valid token → `AuthHandler.AuthContext.set(c, ctx)` with the session or API-key row.

**Enforcement lives in router guards and handlers**, not in the middleware. The admin guard
([`routes/admin/index.ts`](../templates/backend-service/src/api/versions/v1/routes/admin/index.ts)):

```ts
export const router = new Hono().basePath("/admin");

router.use("*", async (c, next) => {
	const authContext = AuthHandler.AuthContext.get(c);

	if (authContext.type === "unauthenticated") {
		return APIResponse.unauthorized(c, "Authentication required");
	}

	if (authContext.user_role !== "admin") {
		return APIResponse.forbidden(c, "This endpoint is restricted to administrators");
	}

	await next();
});
```

The account router has the same kind of guard, but session-only
(`authContext.type !== "session"` → 401 `"Your Auth Context is not a session"`). Mark bearer routes
with `APIRouteSpec.authenticated(...)` and public ones with `APIRouteSpec.unauthenticated(...)` so
the spec matches.

## OpenAPI setup

The spec is generated per version router by `openAPIRouteHandler(versionRouter.router,
versionRouter.openAPIConfig)` from the `describeRoute` metadata that `APIRouteSpec.*` attaches. The
OpenAPI JSON is the contract; the frontend client is generated from it (see
[05 — API contract](05-api-contract.md)).

Everything document-level goes under `openAPIConfig.documentation` — the security scheme under
`documentation.components` (from `versions/v1/index.ts`, trimmed):

```ts
documentation: {
	info: { /* title, version, description */ },
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				description: "Enter your bearer token in the format **Bearer &lt;token&gt;**",
			},
		},
	},
	security: [{ bearerAuth: [] }],
	servers: [
		{
			url: `http://localhost:${AppConstants.APP_API_DEFAULT_PORT}/v1`,
			description: "Local development server",
		},
		{ url: `${AppConstants.APP_API_DEFAULT_PROD_URL}/v1`, description: "Production server" },
	],
	"x-tagGroups": [
		{
			name: "Account & Authentication",
			tags: ["Account", "Account / API Keys", "Account / Preferences", "Authentication"],
		},
		{ name: "Admin", tags: ["Admin / Users"] },
	],
	tags: [
		{ name: "Account", description: "Endpoints for user account management" },
		{
			name: "Account / API Keys",
			// @ts-ignore
			"x-displayName": "API Keys",
			summary: "API Keys",
			parent: "Account",
			description: "Endpoints for managing account API keys",
		},
		// … one entry per tag
	],
},
```

- **No `bearerFormat`.** The tokens are opaque, not JWTs; see
  [17 — Decisions](17-decisions.md#12-opaque-bearer-tokens-not-jwt).
- Routes reference tags through the `DOCS_TAGS` constant
  ([`versions/v1/docs/index.ts`](../templates/backend-service/src/api/versions/v1/docs/index.ts)).
  Keep `DOCS_TAGS`, `tags` and `x-tagGroups` in sync. *(The template currently doesn't:
  `DOCS_TAGS.ADMIN_API.USERS` is `"Admin API / Users"` while `tags`/`x-tagGroups` declare
  `"Admin / Users"`, so the admin endpoints land under an undeclared tag. Align them in your
  project.)*
- `APIRouteSpec.authenticated(...)` adds `security: [{ bearerAuth: [] }]` to the operation;
  `APIRouteSpec.unauthenticated(...)` sets `security: []`.

## Mounting Hono in Nitro

For the full-stack Nuxt shape (see [01 — Project structure](01-project-structure.md)), the same
`API` class (`server/lib/api/index.ts`, identical to the backend-service file) runs **inside Nitro**.
Three things change:

1. **No `Main`.** Nitro owns the process. `server/plugins/startup.ts` runs the same init sequence
   once at boot — without `API.start()` — and registers the shutdown on Nitro's `close` hook.
2. **A catch-all Nitro route** (`server/routes/api/[...].ts`) mounts `API.getApp()` at `/api` in a
   wrapper Hono app and forwards each request. Endpoints become `/api/v1/<resource>`,
   `/api/health`, `/api/docs/v1`.
3. **Config has no `API_HOST` / `API_PORT`** — Nitro listens on `PORT` (12520 in the template).

[`server/plugins/startup.ts`](../templates/fullstack-nuxt-app/server/plugins/startup.ts) (imports
trimmed):

```ts
import { defineNitroPlugin } from "nitropack/runtime";

// Runs once at Nitro boot — replaces Main.main() from the standalone backend shape.
export default defineNitroPlugin(async (nitroApp) => {
	const config = await ConfigHandler.loadConfig();

	Logger.setLogLevel(config.LOG_LEVEL ?? "info");
	Logger.log(`Starting ${AppConstants.APP_NAME}...`);

	await DB.init(config.DB_PATH, config.DB_AUTO_MIGRATE, config.CONFIG_BASE_DIR);

	await Utils.ensureDirectoryExists(config.LOG_DIR ?? "./data/logs");

	await TaskScheduler.processQueue();

	await EmailService.init();

	await CronJobHandler.init();
	await CronJobHandler.startAll();

	await API.init([config.APP_URL], config.API_DISABLE_DOCS === true);

	nitroApp.hooks.hook("close", async () => {
		try {
			Logger.log(`Received SIGTERM, shutting down...`);

			await CronJobHandler.stopAll();

			await API.stop();

			await EmailService.reset();
			await TaskScheduler.stopProcessing();

			await DB.close();

			Logger.log("Shutdown complete, exiting.");
		} catch {
			Logger.critical("Error during shutdown, forcing exit");
		}
	});
});
```

[`server/routes/api/[...].ts`](../templates/fullstack-nuxt-app/server/routes/api/%5B...%5D.ts) — the
bridge from Nitro to Hono:

```ts
import { defineEventHandler, getMethod, getRequestURL, readRawBody, setResponseStatus } from "h3";
import { Hono } from "hono";
import { API } from "../../lib/api";

let wrapper: Hono | null = null;

// Only cache the wrapper once `API.getApp()` succeeds. A request that arrives while
// `server/plugins/startup.ts` is still running `API.init()` must not cache an empty router.
function getWrapper(): Hono | null {
	if (wrapper) return wrapper;
	try {
		const app = new Hono();
		app.route("/api", API.getApp());
		wrapper = app;
		return wrapper;
	} catch {
		return null;
	}
}

export default defineEventHandler(async (event) => {
	const app = getWrapper();
	if (!app) {
		setResponseStatus(event, 503);
		return {
			success: false,
			code: 503,
			message: "API is starting, please retry shortly",
		};
	}

	const url = getRequestURL(event);
	const method = getMethod(event);

	const request = new Request(url, {
		method,
		headers: event.headers,
		body: method !== "GET" && method !== "HEAD" ? await readRawBody(event) : undefined,
	});

	return app.fetch(request);
});
```

The relevant [`nuxt.config.ts`](../templates/fullstack-nuxt-app/nuxt.config.ts) bits:

```ts
nitro: {
	rollupConfig: { external: ["bun:sqlite"] },

	esbuild: {
		options: {
			target: "esnext",
		},
	},
},

runtimeConfig: {
	public: {
		//@ts-ignore
		appUrl: process.env.APPPREFIX_APP_URL || "http://localhost:12520",
	},
},

routeRules: {
	"/dashboard/**": { ssr: false },
	"/auth/**": { ssr: false },
	"/**": { ssr: true },
},
```

Notes:

- `rollupConfig.external: ["bun:sqlite"]` keeps Nitro from bundling the native SQLite binding;
  `target: "esnext"` keeps modern syntax such as the route modules' top-level `await` intact.
- Set the public URL twice in production: `APPPREFIX_APP_URL` (API side: CORS, reset links) and
  `NUXT_PUBLIC_APP_URL` (runtime override of `public.appUrl`, which the browser's API client uses) —
  see `docker/Dockerfile`.
- While the startup plugin is still running, `/api/**` answers 503 (an error envelope without
  `data`); the wrapper is cached only after `API.getApp()` succeeds.
- Bare `/api` is not routed (Nitro's `[...]` catch-all needs `/api/…`); open the docs at
  `/api/docs/v1`. The client is generated in-process, not over HTTP (see
  [05 — API contract](05-api-contract.md#generating-the-frontend-client)).
- The template's `openAPIConfig.servers` and `AppConstants.APP_API_DEFAULT_PORT` still carry the
  backend values (`http://localhost:12500/v1`); in a full-stack project point them at
  `http://localhost:12520/api/v1` and your production `/api/v1`.
- Tests drive `API.getApp()` directly — no Nitro, no `/api` prefix, no `API.start()`
  (`makeAPIRequest("/v1/...")`).

### Realtime (WebSocket)

*Ecosystem pattern (MindCode), not part of the templates.* A full-stack Nuxt app that needs
push/streaming adds a WebSocket transport alongside REST. It needs the Bun preset (the templates
build with `nuxt build --preset bun`) and Nitro's experimental WebSocket support:

```ts
export default defineNuxtConfig({
	nitro: {
		experimental: { websocket: true },
	},
});
```

Add a WS route with `defineWebSocketHandler` (crossws) in `server/routes/ws/<name>.ts`, delegating
to your own runner class:

```ts
export default defineWebSocketHandler({
	async open(peer) { await MySessionRunner.handleOpen(peer); },
	async message(peer, message) { await MySessionRunner.handleMessage(peer, message); },
	async close(peer) { await MySessionRunner.handleClose(peer); },
	error(peer, error) { Logger.error("WebSocket error:", error); },
});
```

Drive the work from a static `<Name>SessionRunner` + `<Name>SessionRegistry` pair (the same
static-class house style): the runner routes peers to sessions, the registry holds live state.
**Re-validate the bearer token on every privileged WS message** — don't trust the connection once
it's open. Isolate sessions per user (e.g. under `mindcode/user-{userId}/…`). The frontend talks to
the socket through a `useXxxWebSocketManager` composable; REST is still used for listings/history.

## Compatibility-proxy backend

A service whose job is to be **protocol-compatible with an upstream vendor** (LeiAI API-Gateway
speaking OpenAI/Anthropic) is a documented exception to the CRUD conventions. The rules relax:

- **Responses are vendor-native, not the envelope.** `/v1/chat/completions` returns
  `{ object: "list", data: [...] }`; Anthropic errors return `{ type: "error", error: { type, message } }`.
  The `{ success, code, message, data }` envelope applies **only to `/health` and control-plane
  endpoints**.
- **No `hono-openapi` / no `zValidator` / no Drizzle.** Request validation is manual `JSON.parse` +
  field checks; config lives in Zod-validated JSON files (`gateway.json`, `api-keys.json`), not a DB.
- **Auth is gateway API keys**, not session tokens. `Authorization: Bearer <key>` **or**
  `x-api-key: <key>` (match the client style); per-key model scoping via `allowedModels` **or**
  `denyModels` (mutually exclusive), checked per-route. Error shape is chosen to match the client
  (Anthropic-style vs OpenAI-style).
- The static `API` class + `onError` + versioned-router skeleton still apply; the `prettyJSON` and
  `cors` middleware may be dropped if the proxy is not browser-facing.

This is a special case, not the default. Record the choice in the project's `CLAUDE.md` and
[17 — Decisions › Compatibility-proxy backends](17-decisions.md#14-compatibility-proxy-backends-are-a-noted-exception).

## Service utilities

Besides the HTTP stack, the template ships a set of static service classes. They are **feature
modules — template-only, not in `shared/`**; copy them from the template when you need them (the
full-stack template has the same files under `server/lib/`). Links go to the backend-service copy.

| Utility | File | What it does |
| --- | --- | --- |
| `EmailService` | [`src/api/utils/email.ts`](../templates/backend-service/src/api/utils/email.ts) | nodemailer wrapper. `init()` reads `SMTP_*`; without `SMTP_HOST` it logs a warning and stays disabled. `init(transporter)` injects a test transport. `isEnabled()`, `getFrom()`, `reset()`, `sendPasswordResetEmail(to, rawToken)` (fire-and-forget: logs, never throws). |
| `TaskScheduler` | [`src/tasks/`](../templates/backend-service/src/tasks/) | `@cleverjs/utils` `TaskHandler` persisted in `scheduled_tasks` (+ `scheduled_tasks_paused_state`). Register task functions in the `Registry` (`sampleTask.ts` shows the shape); `processQueue()` at startup resumes pending/paused tasks; `TaskQueueUtils.createPendingTaskRecord(...)` / `activatePendingTask(id)` enqueue work. Per-task logs go to `<LOG_DIR>/tasks/task-<id>.log`. |
| `CronJobHandler` | [`src/utils/cron.ts`](../templates/backend-service/src/utils/cron.ts) | Wraps `Bun.cron`. Declare jobs in `init()` (the template ships two empty every-minute placeholders — replace or delete them); `startAll()` / `stopAll()`. |
| `RuntimeMetadata` | [`src/api/utils/metadata.ts`](../templates/backend-service/src/api/utils/metadata.ts) | Global key/value store in the `metadata` table, one Zod schema per key; protected `getMetadata(key, createIfNotFound)` / `setMetadata(key, data)` — subclass or extend with typed accessors. |
| `UserPreferences` / `UserPreferencesHandler` | [`src/api/utils/preferences.ts`](../templates/backend-service/src/api/utils/preferences.ts) | Per-user key/value store in `user_preferences`, one Zod schema per key (per-field defaults). `get`, `getAll` (fills defaults, drops unknown keys), `set` (upsert), `deleteAllForUser`, typed `getOnboarding` / `setOnboarding`. Add a key to `UserPreferences.schemas`, then a typed getter/setter and a route. |
| `LCrypt` & co. | [`src/utils/crypto/`](../templates/backend-service/src/utils/crypto/) | `LCrypt.sha256()` — **SHA3-256** despite the name — `randomBytes()`, secp256k1 keys/sign/recover/ECDH, AES-256-GCM `encryptData`/`decryptData`; `ObjectEncryption.encrypt/decrypt(obj, key)`; `PublicKey`/`PrivateKey`/`KeyPair`, `Signature`. |
| `AppConstants` | [`shared/backend/src/utils/constants.ts`](../shared/backend/src/utils/constants.ts) | `APP_NAME`, `APP_ENV_PREFIX` (`APPPREFIX`), `APP_KEYS_PREFIX` (`appprefix`), `APP_API_DEFAULT_PORT`, `APP_API_DEFAULT_PROD_URL`, `DEFAULT_EMAIL_FROM_HOST`, `DEFAULT_SMTP_FROM`, `BINARY_NAME`. Core file (in `shared/`). |
| `Utils` | [`shared/backend/src/utils/index.ts`](../shared/backend/src/utils/index.ts) | `getRandomU32`, `splitNTimes(Reverse)`, `mergeObjects`, `sleep`, `ensureDirectoryExists`, `asExact`. Core file (in `shared/`). |
| Shared models | [`src/api/utils/shared-models/`](../templates/backend-service/src/api/utils/shared-models/) | `UserDataPolicies.Username` / `.Password`, `UserAccountSettings.Roles` / `.Role`, `ApiHelperModels.ListAll.Query` / `.QueryWithSearch` (limit/offset/order paging). |

Every DB-touching method on these classes takes an optional trailing `tx: DrizzleDB = DB.instance()`
so it can join a caller's transaction (see [08 — Database](08-database.md#transaction-boundaries)).

## Environment, config, and logging

- Load config at startup with `ConfigHandler` from
  [`shared/backend/src/utils/config.ts`](../shared/backend/src/utils/config.ts); env names are
  `APPPREFIX_<KEY>`.
- Set the log level from `APPPREFIX_LOG_LEVEL` right after loading config.
- Use the backend [`Logger`](../shared/backend/src/utils/logger.ts) everywhere; never raw
  `console.log` in production code.
- Store secrets (tokens, DB paths, SMTP credentials) only in env vars, never in code.

See [09 — Config & logging](09-config-and-logging.md).

## Testing routes

Use `makeAPIRequest(path, opts?, expectedCode?)` from
[`shared/backend/tests/helpers/api.ts`](../shared/backend/tests/helpers/api.ts). It calls
`API.getApp().request(...)` in-process, asserts the status, and returns the response's `data`
(validated against `expectedBodySchema` when given):

```ts
const data = await makeAPIRequest("/v1/auth/session", {
	authToken: session_token,
	expectedBodySchema: AuthModel.Session.Response,
});

expect(data.user_id).toBe(testUser.id);

await makeAPIRequest("/v1/admin/users", {}, 401);
```

See [12 — Testing](12-testing.md) for the harness (bunfig preload, temp DB, seed helpers).

## Database touch points

Route handlers go through `DB.instance()` and the tables in `DB.Tables.*` (row types in
`DB.Models.*`); they import query operators (`eq`, `and`, …) from `drizzle-orm`, never table
builders from `drizzle-orm/sqlite-core`. Column helpers and the `DrizzleDB` type are in
[`shared/backend/src/db/utils.ts`](../shared/backend/src/db/utils.ts). See
[08 — Database](08-database.md).

## Checklist

- [ ] `Main.main()` registers its signal/exception handlers first, then runs config → log level →
  DB → tasks → email → cron → `API.init` → `API.start`, and shuts down inline in reverse.
  *(Full-stack Nuxt shape: `server/plugins/startup.ts` + the Nitro `close` hook instead; see
  [Mounting Hono in Nitro](#mounting-hono-in-nitro).)*
- [ ] `API` is a static class: `init(frontendUrls, disableDocs)`, `start(port, hostname)`, `stop()`,
  `getApp()`; prettyJSON + CORS + `onError`; `/health` at the root.
- [ ] Each version is an `APIVersionRouter` subclass with `openAPIConfig.documentation` and one
  router that runs `authMiddlewareV1`.
- [ ] Routers are `new Hono().basePath(...)`; sub-routers mounted via `router.route("/", (await
  import(...)).router)`.
- [ ] Endpoints are `APIRouteSpec.*` → `zValidator(...)` → handler returning `APIResponse.*`.
- [ ] `APIRouteSpec.authenticated` for bearer routes, `unauthenticated` for public routes; access is
  enforced by router guards / handlers.
- [ ] `bearerAuth` is `type: http, scheme: bearer` with no `bearerFormat`; `DOCS_TAGS` match the
  declared `tags`.
- [ ] OpenAPI JSON at `/docs/v1/openapi`, Scalar at `/docs/v1` (relative spec URL), both off with
  `API_DISABLE_DOCS`.
- [ ] Hand-written route clients do not exist; the frontend client is generated.
