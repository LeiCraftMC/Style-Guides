import { Hono } from "hono";
import { type GenerateSpecOptions } from "hono-openapi";
import { authMiddlewareV1 } from "./middleware/auth";
import { router as authRouter } from "./routes/auth";
import { router as accountRouter } from "./routes/account";
import { router as adminRouter } from "./routes/admin";
import { APIVersionRouter } from "../../utils/apiVersionRouter";
import { AppConstants } from "../../../utils/constants";

const openAPIConfig: Partial<GenerateSpecOptions> = {
	documentation: {
		info: {
			title: `${AppConstants.APP_NAME} API`,
			version: "1.0.0",
			description: `API for ${AppConstants.APP_NAME} Frontend and third-party clients`,
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					description: "Enter your bearer token in the format **Bearer &lt;token&gt;**",
				},
			},
			responses: {
				401: {
					description: "Authentication information is missing or invalid",
				},
			},
		},

		// Disable global security because Scalar could not handle multiple security schemes properly
		security: [
			{
				bearerAuth: [],
			},
		],

		servers: [
			{
				url: `http://localhost:${AppConstants.APP_API_DEFAULT_PORT}/v1`,
				description: "Local development server",
			},
			{
				url: `${AppConstants.APP_API_DEFAULT_PROD_URL}/v1`,
				description: "Production server",
			},
		],

		"x-tagGroups": [
			{
				name: "Account & Authentication",
				tags: ["Account", "Account / API Keys", "Account / Preferences", "Authentication"],
			},
			{
				name: "Admin API",
				tags: ["Admin API / Users"],
			},
		],

		tags: [
			{
				name: "Account",
				description: "Endpoints for user account management",
			},
			{
				name: "Account / API Keys",
				// @ts-ignore
				"x-displayName": "API Keys",
				summary: "API Keys",
				parent: "Account",
				description: "Endpoints for managing account API keys",
			},
			{
				name: "Account / Preferences",
				// @ts-ignore
				"x-displayName": "Preferences",
				summary: "Preferences",
				parent: "Account",
				description: "Endpoints for managing account preferences (e.g. remote email content policy)",
			},

			{
				name: "Authentication",
				description: "Endpoints for authentication and authorization",
			},

			{
				name: "Admin API / Users",
				// @ts-ignore
				"x-displayName": "Users",
				summary: "Users",
				parent: "Admin API",
				description: "Endpoints for user management",
			},
		],
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
