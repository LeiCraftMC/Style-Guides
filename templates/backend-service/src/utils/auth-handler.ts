/**
 * auth-handler.example.ts — example AuthHandler for bearer-token sessions.
 *
 * Copy into your backend service as `src/utils/auth-handler.ts` and adapt to your
 * actual session / user / API-key model. This is a minimal, type-safe scaffold that
 * demonstrates the pattern used across the ecosystem.
 * See docs/10-auth.md.
 */
import type { Context } from "hono";

export namespace AuthHandler {
	export type AuthContext =
		| { type: "session"; userId: number; isAdmin: boolean }
		| { type: "apiKey"; permissions: string[] }
		| { type: "unauthenticated" };
}

export class AuthHandler {
	/** Resolve a request's bearer token into an AuthContext. */
	static async resolveRequest(c: Context): Promise<AuthHandler.AuthContext> {
		const header = c.req.header("Authorization") ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7) : null;

		if (!token) {
			return { type: "unauthenticated" };
		}

		// Replace with your real session lookup (DB, Redis, etc.).
		const session = await this.lookupSession(token);
		if (!session) {
			return { type: "unauthenticated" };
		}

		return {
			type: "session",
			userId: session.userId,
			isAdmin: session.isAdmin,
		};
	}

	/** Optional API-key path for service-to-service calls. */
	static async resolveAPIKey(c: Context): Promise<AuthHandler.AuthContext> {
		const header = c.req.header("Authorization") ?? "";
		const key = header.startsWith("Bearer ") ? header.slice(7) : null;
		if (!key) return { type: "unauthenticated" };

		const permissions = await this.lookupAPIKey(key);
		if (!permissions) return { type: "unauthenticated" };

		return { type: "apiKey", permissions };
	}

	// --- project-specific stubs ------------------------------------------------
	private static async lookupSession(_token: string) {
		// return { userId: 1, isAdmin: false };
		return null;
	}

	private static async lookupAPIKey(_key: string) {
		// return ["read:users", "write:users"];
		return null;
	}
}
