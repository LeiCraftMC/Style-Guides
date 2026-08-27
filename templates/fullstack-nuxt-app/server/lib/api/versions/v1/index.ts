import { APIVersionRouter } from "../../utils/api-version-router";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";

export class APIv1Router extends APIVersionRouter {
	constructor() {
		super({
			version: 1,
			openAPIConfig: {
				info: {
					version: "1.0.0",
					title: "<ProjectName> API",
					description: "Full-stack Nuxt API v1",
				},
				servers: [{ url: "/api/v1" }],
				security: [{ bearerAuth: [] }],
				components: {
					securitySchemes: {
						bearerAuth: {
							type: "http",
							scheme: "bearer",
							bearerFormat: "JWT",
						},
					},
				},
			},
			routes: [healthRouter, authRouter],
		});
	}
}