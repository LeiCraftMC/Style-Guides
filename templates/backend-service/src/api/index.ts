import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { APIv1Router } from "./versions/v1";
import { Logger } from "../utils/logger";
import { APIResponse } from "../utils/api-response";
import { ConfigHandler } from "../utils/config";

export class API {
	static app: Hono;
	static server: ReturnType<typeof Bun.serve> | null = null;

	static async init(port: number) {
		this.app = new Hono();

		this.app.get("/health", (c) =>
			c.json({ success: true, code: 200, message: "healthy", data: null }),
		);

		const v1 = new APIv1Router();
		this.app.route(`/v${v1.version}`, v1.router);

		this.app.get(`/docs/v${v1.version}/openapi`, openAPISpecs(this.app, v1.openAPIConfig));
		this.app.get(`/docs/v${v1.version}`, apiReference({
			spec: { url: `/docs/v${v1.version}/openapi` },
			theme: "kepler",
		}));

		this.app.onError((err, c) => {
			Logger.error("Unhandled error:", err);
			return APIResponse.serverError(c, "Internal Server Error");
		});

		if (ConfigHandler.getConfig().API_DISABLE_DOCS) {
			this.app.use("/docs/*", (c) => APIResponse.notFound(c, "Documentation disabled"));
		}

		this.server = Bun.serve({ port, fetch: this.app.fetch });
		Logger.log(`API listening on http://localhost:${port}`);
	}

	static async stop() {
		this.server?.stop(true);
		this.server = null;
	}
}
