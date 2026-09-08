import { createMiddleware } from "hono/factory";
import { APIResponse } from "../../../utils/api-res";
import { AuthHandler } from "../../../utils/authHandler";

export const authMiddlewareV1 = createMiddleware(async (c, next) => {
	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		AuthHandler.AuthContext.set(c, {
			type: "unauthenticated",
		} satisfies AuthHandler.UnauthenticatedAuthContext);

		return await next();
	}

	if (!authHeader.startsWith("Bearer ")) {
		// Allow unauthenticated access to the login endpoint and password reset request endpoint, which may be accessed with an invalid or missing token.
		if (
			c.req.path.startsWith("/v1/auth/login") ||
			c.req.path.startsWith("/v1/auth/signup") ||
			c.req.path.startsWith("/v1/auth/reset-password")
		) {
			AuthHandler.AuthContext.set(c, {
				type: "unauthenticated",
			} satisfies AuthHandler.UnauthenticatedAuthContext);

			return await next();
		}

		return APIResponse.unauthorized(c, "Invalid Authorization header");
	}

	const token = authHeader.substring("Bearer ".length);

	const authContext = await AuthHandler.getAuthContext(token);

	if (!authContext || !(await AuthHandler.isValidAuthContext(authContext))) {
		if (
			c.req.path.startsWith("/v1/auth/login") ||
			c.req.path.startsWith("/v1/auth/signup") ||
			c.req.path.startsWith("/v1/auth/reset-password")
		) {
			AuthHandler.AuthContext.set(c, {
				type: "unauthenticated",
			} satisfies AuthHandler.UnauthenticatedAuthContext);

			return await next();
		}

		return APIResponse.unauthorized(c, "Invalid or expired token");
	}

	AuthHandler.AuthContext.set(c, authContext);

	return await next();
});
