import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { APIv1Router } from "./versions/v1";
import { Logger } from "../utils/logger";
import { type APIVersionRouter } from "../utils/api-version-router";
import { ConfigHandler } from "../utils/config";

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

	static async init(port: number) {
		this.app = new Hono();
		this.app.use(prettyJSON());

		this.app.onError((err, c) => {
			if (err instanceof HTTPException) {
				return c.json({ success: false, code: err.status, message: "Your input is invalid" }, err.status);
			}
			Logger.error("Unhandled error:", err);
			return c.json({ success: false, code: 500, message: "Internal Server Error" }, 500);
		});

		const disableDocs = ConfigHandler.getConfig().API_DISABLE_DOCS === true;
		this.registerVersion(new APIv1Router(), disableDocs);

		this.app.get("/health", (c) =>
			c.json({ success: true, code: 200, message: "healthy", data: null }),
		);

		this.server = Bun.serve({ port, fetch: this.app.fetch });
		Logger.log(`API listening on http://localhost:${port}`);
	}

	static async stop() {
		this.server?.stop(true);
		this.server = null;
	}
}