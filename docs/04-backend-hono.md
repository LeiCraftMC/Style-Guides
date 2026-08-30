# 04 — Backend architecture (Hono)

## Lifecycle: `Main → API → VersionRouter → Routes`

A backend service is a static-class stack. There is no DI container and no `new` at the top level
besides the framework instances Hono itself needs.

```
Main.main()                     // entry point, loads config, registers shutdown handlers
  ├─ ConfigHandler.loadConfig()
  ├─ Logger.setLogLevel(...)
  ├─ DB.init(...)               // Drizzle + bun-sqlite
  ├─ API.init(...)              // creates Hono, mounts routers, serves docs
  │   ├─ APIv1Router            // APIVersionRouter subclass
  │   │   ├─ auth routes
  │   │   ├─ resource routes
  │   └─ openAPI metadata
  └─ Bun.serve({ fetch: API.app.fetch, port })  // or node:http Server
```

Copy [`shared/backend/main-shutdown.ts`](../shared/backend/main-shutdown.ts) into `src/main-shutdown.ts`
and call it as the first thing in `Main.main()`:

```ts
export class Main {
	static async main() {
		registerShutdownHandlers({
			onShutdown: async (signal) => {
				Logger.log(`Shutting down on ${signal}...`);
				await API.stop();
				DB.close();
			},
		});

		await ConfigHandler.loadConfig();
		const config = ConfigHandler.getConfig();

		Logger.setLogLevel(config.LOG_LEVEL ?? "info");
		Logger.log("Starting service...");

		await DB.init(config.DB_PATH ?? ":memory:", config.DB_AUTO_MIGRATE ?? true);
		await API.init(config.API_PORT ?? 3000);
	}
}

Main.main().catch((err) => {
	Logger.error("Fatal startup error:", err);
	process.exit(1);
});
```

The `API` class is a static singleton. It owns the root `Hono` app, mounts versioned routers, wires
health checks, and serves OpenAPI specs. Keep it focused on HTTP plumbing; business logic lives in
route modules and `AuthHandler` / `DB` helpers.

## `APIVersionRouter`

Each major API version is a subclass of `APIVersionRouter` from
[`shared/backend/api-version-router.ts`](../shared/backend/api-version-router.ts). The base mounts a
Hono router and stores an OpenAPI configuration. The concrete class only declares version,
routes, and metadata:

```ts
import { APIVersionRouter } from "../api-version-router";
import { authRouter } from "./auth";
import { healthRouter } from "./health";

export class APIv1Router extends APIVersionRouter {
	constructor() {
		super({
			version: 1,
			openAPIConfig: {
				info: {
					version: "1.0.0",
					title: "My Service API",
					description: "Public API v1",
				},
				servers: [{ url: "/v1" }],
			},
			routes: [authRouter, healthRouter],
		});
	}
}
```

`routes` accepts either a single `Hono` instance or an array of `Hono` instances / `{ router: Hono }`
objects. The `API` class then mounts the router at `/v1` and exposes:

- `/docs/v1/openapi` — raw OpenAPI JSON
- `/docs/v1` — Scalar UI

## `API` class skeleton

```ts
import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { APIv1Router } from "./versions/v1";
import { Logger } from "./logger";

export class API {
	static app: Hono;
	static server: ReturnType<typeof Bun.serve> | null = null;

	static async init(port: number) {
		this.app = new Hono();

		// global middleware
		this.app.use("*", loggerMiddleware());
		this.app.use("*", authMiddleware());

		// health check outside versioning
		this.app.get("/health", (c) =>
			c.json({ success: true, code: 200, message: "healthy", data: null }),
		);

		// mount versions
		const v1 = new APIv1Router();
		this.app.route(`/v${v1.version}`, v1.router);

		// serve OpenAPI + Scalar per version
		this.app.get(`/docs/v${v1.version}/openapi`, openAPISpecs(this.app, v1.openAPIConfig));
		this.app.get(`/docs/v${v1.version}`, apiReference({
			spec: { url: `/docs/v${v1.version}/openapi` },
			theme: "kepler",
		}));

		this.server = Bun.serve({ port, fetch: this.app.fetch });
		Logger.log(`API listening on http://localhost:${port}`);
	}

	static async stop() {
		this.server?.stop(true);
		this.server = null;
	}
}
```

Use typed app variables so middleware can attach context without `// @ts-ignore`:

```ts
type Variables = { authContext: AuthHandler.AuthContext };
const app = new Hono<{ Variables: Variables }>();
```

## Route conventions

A route folder mirrors the URL path. It contains an `index.ts` for handlers and a `model.ts` for
Zod schemas + inferred types:

```
versions/
  v1/
    index.ts            # APIv1Router subclass (version, openAPIConfig, routes)
    docs/index.ts       # DOCS_TAGS constant
    middleware/auth.ts   # authMiddlewareV1
    routes/
      auth/
        index.ts        # POST /login, POST /logout, GET /me
        model.ts        # AuthModel.Login.Body, AuthModel.Login.Response, ...
      mail-accounts/
        index.ts
        model.ts
```

Within `index.ts`, register each endpoint with `zValidator` and `APIRouteSpec`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "hono-openapi";
import { APIRouteSpec, APIResponseSpec } from "../../api-response-spec";
import { APIResponse } from "../../api-response";
import { AuthModel } from "./model";

const app = new Hono<{ Variables: { authContext: AuthHandler.AuthContext } }>();

app.post(
	"/login",
	zValidator("json", AuthModel.Login.Body),
	APIRouteSpec.unauthenticated({
		summary: "Log in",
		description: "Exchange credentials for a session token.",
		tags: ["Authentication"],
		responses: APIResponseSpec.describeWithWrongInputs(
			APIResponseSpec.success("Login successful", AuthModel.Login.Response),
			APIResponseSpec.unauthorized(),
		),
	}),
	async (c) => {
		const body = c.req.valid("json");
		const result = await AuthHandler.login(body.username, body.password);
		if (!result) {
			return APIResponse.unauthorized(c, "Invalid credentials");
		}
		return APIResponse.success(c, "Login successful", result);
	},
);

export const authRouter = app;
```

Use `describeWithWrongInputs(...)` whenever the route has a validated body or query; it appends the
400 response automatically. For GET-only routes use `describeBasic(...)`.

## Error handling

Do **not** throw inside route handlers to return client errors. Use the typed `APIResponse.*`
helpers so the runtime shape, the OpenAPI spec, and the generated client stay in sync:

```ts
if (!user) {
	return APIResponse.notFound(c, "User not found");
}
if (!hasPermission(ctx, "admin")) {
	return APIResponse.forbidden(c, "Admin permission required");
}
```

The global error handler catches unexpected errors and maps them to the envelope:

```ts
this.app.onError((err, c) => {
	Logger.error("Unhandled error:", err);
	return APIResponse.serverError(c, "Internal Server Error: please try again later");
});
```

Validation errors from `zValidator` are automatically returned as 400 by `hono-openapi`. Keep them as
400 Bad Request; don't transform them into the envelope unless you have a custom validator that does
so deliberately.

## Authentication middleware

Auth is covered in detail in [10 — Authentication](10-auth.md). The short form:

- Extract `Authorization: Bearer <token>` from the header.
- Resolve the token to a session / user / API key context.
- Attach `c.set("authContext", ctx)`.
- Use `APIRouteSpec.authenticated(...)` so OpenAPI lists `bearerAuth` security.
- In the route, narrow the context: `if (c.var.authContext.type !== "session") return APIResponse.unauthorized(...);`.

```ts
app.use("/admin/*", async (c, next) => {
	const ctx = await AuthHandler.resolveRequest(c);
	c.set("authContext", ctx);
	if (ctx.type === "unauthenticated") {
		return APIResponse.unauthorized(c, "Authentication required");
	}
	if (ctx.type === "session" && !ctx.user.isAdmin) {
		return APIResponse.forbidden(c, "Admin access required");
	}
	await next();
});
```

## OpenAPI setup

Use `openAPISpecs` from `hono-openapi` and `@scalar/hono-api-reference` for docs. The OpenAPI JSON is
the contract; the frontend client is generated from it (see [05 — API contract](05-api-contract.md)).

Add the security scheme in the version metadata:

```ts
openAPIConfig: {
	info: { version: "1.0.0", title: "My API" },
	security: [{ bearerAuth: [] }],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				// No bearerFormat: "JWT" — tokens are opaque. See 10 — Authentication.
			},
		},
	},
}
```

Then individual routes use `APIRouteSpec.authenticated(...)` (bearer required) or
`APIRouteSpec.unauthenticated(...)` (explicitly no security).

## Mounting Hono in Nitro

For the full-stack Nuxt shape (see [01 — Project structure](01-project-structure.md)), the same
Hono `API` class runs **inside Nitro** instead of under `Bun.serve`. Three things change:

1. **No `Bun.serve` / `Main.main()` / `registerShutdownHandlers`.** Nitro owns the process lifecycle.
   Initialization moves into a Nitro plugin (`server/plugins/startup.ts`) that runs once at boot.
2. **A catch-all Nitro route** (`server/routes/api/[...].ts`) builds a Hono wrapper, mounts the `API`
   app at `/api`, and forwards each request. All endpoints become `/api/v1/<resource>`, `/api/health`,
   `/api/docs/v1`.
3. **The `API` class exposes `getApp()`** instead of `start()`/`stop()`.

`server/lib/api/index.ts` — the `API` class (no `Bun.serve`):

```ts
import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { Logger } from "../../utils/logger";
import { APIv1Router } from "./versions/v1";

export class API {
	protected static app: Hono | undefined;
	protected static latestVersion: number | null = null;

	protected static registerVersion(versionRouter: APIVersionRouter, disableDocs = false) {
		if (!this.app) throw new Error("API not initialized. Call API.init() first.");
		this.app.route(`/v${versionRouter.version}`, versionRouter.router);
		if (!this.latestVersion || versionRouter.version > this.latestVersion) {
			this.latestVersion = versionRouter.version;
		}
		if (!disableDocs) {
			this.app.get(`/docs/v${versionRouter.version}/openapi`, openAPIRouteHandler(versionRouter.router, versionRouter.openAPIConfig));
			this.app.get(`/docs/v${versionRouter.version}`, Scalar({ url: `/docs/v${versionRouter.version}/openapi` }));
		}
	}

	static async init(disableDocs = false) {
		this.app = new Hono();
		this.app.use(prettyJSON());
		this.app.onError((err, c) => {
			if (err instanceof HTTPException) {
				return c.json({ success: false, code: err.status, message: "Your input is invalid" }, err.status);
			}
			Logger.error("API Error:", err);
			return c.json({ success: false, code: 500, message: "Internal Server Error" }, 500);
		});
		this.registerVersion(new APIv1Router(), disableDocs);
		this.app.get("/health", (c) => c.json({ success: true, code: 200, message: "healthy", data: null }));
	}

	static getApp(): Hono {
		if (!this.app) throw new Error("API not initialized. Call API.init() first.");
		return this.app;
	}
}
```

`server/routes/api/[...].ts` — the catch-all that bridges Nitro → Hono:

```ts
import { Hono } from "hono";
import { defineEventHandler, getRequestURL, getMethod, readRawBody } from "h3";
import { API } from "../../lib/api";

let wrapper: Hono | null = null;

export default defineEventHandler(async (event) => {
	if (!wrapper) {
		wrapper = new Hono();
		wrapper.route("/api", API.getApp());
	}
	const url = getRequestURL(event);
	const method = getMethod(event);
	const request = new Request(url, {
		method,
		headers: event.headers,
		body: method !== "GET" && method !== "HEAD" ? await readRawBody(event) : undefined,
	});
	return wrapper.fetch(request);
});
```

`server/plugins/startup.ts` — replaces `Main.main()`:

```ts
import { defineNitroPlugin } from "nitropack/runtime";
import { ConfigHandler } from "../utils/config";
import { Logger } from "../utils/logger";
import { DB } from "../db";
import { API } from "../lib/api";

export default defineNitroPlugin(async () => {
	const config = await ConfigHandler.loadConfig();
	Logger.setLogLevel(config.LOG_LEVEL ?? "info");
	DB.init(config.DB_PATH ?? "./data/db.sqlite", config.DB_AUTO_MIGRATE ?? true);
	await API.init(config.API_DISABLE_DOCS === true);
});
```

Notes:

- Mount at `/api` once (the `if (!wrapper)` guard). `API.getApp()` throws if `startup.ts` hasn't run
  yet — in dev that's fine because Nitro runs plugins before routes; keep the guard anyway.
- `nitro.rollupConfig.external: ["bun:sqlite"]` is required in `nuxt.config.ts` so Nitro doesn't try
  to bundle the native SQLite binding.
- OpenAPI is served per-router with `openAPIRouteHandler(versionRouter.router, config)` (not
  `openAPISpecs(app, …)`), because the spec should describe the version router, not the `/api`
  wrapper. The frontend generates the client from `/api/docs/v1/openapi`.
- `routeRules` can set `ssr: false` for dashboard/auth pages while keeping SSR for public pages.
- Tests still use `makeAPIRequest(API.getApp(), "/v1/...")` — drive the Hono app directly, no Nitro.

### Realtime (WebSocket)

A full-stack Nuxt app that needs push/streaming (MindCode's live Claude chat) adds a WebSocket
transport alongside REST. Enable it in `nuxt.config.ts` (Bun preset required):

```ts
export default defineNuxtConfig({
	nitro: {
		preset: "bun",
		experimental: { websocket: true },
	},
});
```

Add a WS route with `defineWebSocketHandler` (crossws) in `server/routes/ws/<name>.ts`:

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

## Environment, config, and logging

- Load config at startup with [`shared/backend/config-schema.ts`](../shared/backend/config-schema.ts).
- Set log level from `<PREFIX>_LOG_LEVEL`.
- Use the backend [`Logger`](../shared/backend/logger.ts) everywhere; never raw `console.log` in
  production code.
- Store secrets (tokens, DB) only in env vars, never in code.

## Testing routes

Use the in-process test helper [`shared/backend/make-api-request.ts`](../shared/backend/make-api-request.ts):

```ts
const { data, body } = await makeAPIRequest(app, "/v1/health", {
	expectedBodySchema: z.object({ uptime: z.number() }),
});
expect(body.success).toBe(true);
```

See [12 — Testing](12-testing.md) for the full harness (`preload.ts`, migrations, fixtures).

## Database touch points

Route handlers should not import `drizzle-orm/sqlite-core` directly. Call `DB.instance()` and use
the schemas exported in `DB.Tables.*` (with row types via `DB.Models.*`). Shared SQL helpers are in
[`shared/backend/sql-utils.ts`](../shared/backend/sql-utils.ts).

## Checklist

- [ ] `Main.main()` calls `registerShutdownHandlers` first. *(Full-stack Nuxt shape: skip — use a
  `server/plugins/startup.ts` Nitro plugin instead; see [Mounting Hono in Nitro](#mounting-hono-in-nitro).)*
- [ ] `API` is a static class; `API.init` mounts versioned routers and serves docs.
- [ ] Each version is an `APIVersionRouter` subclass.
- [ ] Routes use `zValidator` + `APIRouteSpec` + `APIResponse.*`.
- [ ] `APIRouteSpec.authenticated` for bearer routes, `unauthenticated` for public routes.
- [ ] `app.onError` returns `APIResponse.serverError`.
- [ ] OpenAPI JSON is available at `/docs/v1/openapi`; Scalar at `/docs/v1`.
- [ ] Hand-written route clients do not exist; generation is configured in the frontend.
