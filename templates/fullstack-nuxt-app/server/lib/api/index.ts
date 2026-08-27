import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { Logger } from "../../utils/logger";
import { type APIVersionRouter } from "./utils/api-version-router";
import { APIv1Router } from "./versions/v1";

/**
 * API — the Hono backend, mounted inside Nitro at /api (see server/routes/api/[...].ts).
 * No Bun.serve / Main.main() / shutdown handlers — Nitro owns the lifecycle.
 * `init()` is called from server/plugins/startup.ts; `getApp()` returns the Hono instance.
 * See docs/04-backend-hono.md#mounting-hono-in-nitro.
 */
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
			this.app.get(
				`/docs/v${versionRouter.version}/openapi`,
				openAPIRouteHandler(versionRouter.router, versionRouter.openAPIConfig),
			);
			this.app.get(
				`/docs/v${versionRouter.version}`,
				Scalar({ url: `/docs/v${versionRouter.version}/openapi` }),
			);
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

		this.app.get("/health", (c) =>
			c.json({ success: true, code: 200, message: "healthy", data: null }),
		);
	}

	static getApp(): Hono {
		if (!this.app) throw new Error("API not initialized. Call API.init() first.");
		return this.app;
	}
}