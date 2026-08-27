import { Hono } from "hono";
import { zValidator } from "hono-openapi";
import { APIResponse } from "../../../../utils/api-response";
import { APIRouteSpec, APIResponseSpec } from "../../../../utils/spec-helpers";
import { AuthModel } from "./model";

const app = new Hono();

app.post(
	"/login",
	zValidator("json", AuthModel.Login.Body),
	APIRouteSpec.unauthenticated({
		summary: "Log in",
		description: "Exchange credentials for a session token.",
		tags: ["Authentication"],
		responses: APIResponseSpec.describeWithWrongInputs(
			APIResponseSpec.success("Login successful", AuthModel.Login.Response),
			APIResponseSpec.unauthorized("Invalid credentials"),
		),
	}),
	async (c) => {
		const body = c.req.valid("json");
		if (body.username !== "admin" || body.password !== "admin") {
			return APIResponse.unauthorized(c, "Invalid credentials");
		}
		return APIResponse.success(c, "Login successful", { token: "dummy-token" });
	},
);

export const authRouter = app;