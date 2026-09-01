import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { APIv1Router } from "./versions/v1";
import { Logger } from "../utils/logger";
import { type APIVersionRouter } from "../utils/api-version-router";

export class API {
	static app: Hono;
	static server: ReturnType<typeof Bun.serve> | null = null;
	protected static latestVersion: number | null = null;

	protected static registerVersion(versionRouter: APIVersionRouter, disableDocs = false) {
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

	/**
	 * Build the Hono app: prettyJSON, CORS (allow the frontend origins), error handler,
	 * versioned routes, docs, /health, and a `/` redirect to the latest docs. Does NOT
	 * call Bun.serve — call `start(port, hostname)` for that.
	 */
	static async init(frontendUrls: string[] = [], disableDocs = false) {
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
				return c.json({ success: false, code: err.status, message: "Your input is invalid" }, err.status);
			}
			Logger.error("Unhandled error:", err);
			return c.json({ success: false, code: 500, message: "Internal Server Error" }, 500);
		});

		this.registerVersion(new APIv1Router(), disableDocs);

		this.app.get("/health", (c) =>
			c.json({ success: true, code: 200, message: "healthy", data: null }),
		);

		if (!disableDocs) {
			this.app.get("/", (c) => c.redirect(`/docs/v${this.latestVersion}`));
		} else {
			this.app.get("/", (c) =>
				c.json({
					success: true,
					code: 200,
					message: "API is running. Documentation is disabled.",
					data: null,
				}),
			);
		}
	}

	/** Start Bun.serve on `port`/`hostname` (default `::` for IPv6). */
	static async start(port: number, hostname = "::") {
		if (!this.app) await this.init();
		this.server = Bun.serve({ port, hostname, fetch: this.app.fetch });
		Logger.log(`API listening on http://${hostname}:${port}`);
	}

	static async stop() {
		this.server?.stop(true);
		this.server = null;
	}

	static getApp(): Hono {
		if (!this.app) throw new Error("API not initialized. Call API.init() first.");
		return this.app;
	}
}