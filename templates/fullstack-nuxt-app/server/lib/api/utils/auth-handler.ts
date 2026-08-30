/**
 * auth-handler.ts — opaque bearer-token auth for LeiCraftMC backends.
 *
 * Replace the DB-lookup stubs (lookupSessionRow / lookupAPIKeyRow / deleteSession)
 * with real Drizzle queries against DB.Tables.sessions / DB.Tables.api_keys.
 *
 * Token scheme (see docs/10-auth.md):
 *   `<prefix>_<kind>_<id>:<base>`
 *     kind  = "sess" | "apikey"
 *     id    = 32 random bytes hex  -> indexes the DB row
 *     base  = 32 random bytes hex  -> stored ONLY as Bun.password.hash(row.hashed_token)
 *   The full token is returned to the client once, at creation. The server re-resolves
 *   against the DB on every request (no JWT, no signed claims).
 */
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { APIResponse } from "./api-response";

// Replace with your project's token prefix, e.g. "dla_", "lra_", "lccfwsp_".
const TOKEN_PREFIX = "fna_";
const SESSION_PREFIX = `${TOKEN_PREFIX}sess_`;
const APIKEY_PREFIX = `${TOKEN_PREFIX}apikey_`;

// Routes that may run without a valid token (the handler reads c.get("authContext")).
const PUBLIC_AUTH_PATHS = new Set(["/v1/auth/login", "/v1/auth/reset-password"]);

// Precomputed dummy hash so a missing user takes the same time as a wrong password.
// Generate once at boot with `await Bun.password.hash("dummy")` and reuse it.
const DUMMY_HASH = "$2b$10$O0.00000000000000000000000000000000000000000000000";

export namespace AuthUtils {
	/** 32 random bytes as 64-char hex. */
	export function randomTokenPart(): string {
		return crypto.getRandomValues(new Uint8Array(32)).reduce(
			(hex, b) => hex + b.toString(16).padStart(2, "0"),
			"",
		);
	}

	/** Build `<prefix><kind>_<id>:<base>` and the hash to persist for `base`. */
	export async function createToken(kind: "sess" | "apikey") {
		const id = randomTokenPart();
		const base = randomTokenPart();
		const prefix = kind === "sess" ? SESSION_PREFIX : APIKEY_PREFIX;
		return {
			token: `${prefix}${id}:${base}`,
			id,
			hashedBase: await Bun.password.hash(base),
		};
	}

	/** Parse a full token into its kind / id / base, or null if the shape is wrong. */
	export function parseToken(
		token: string,
	): { kind: "session" | "apiKey"; id: string; base: string } | null {
		let prefix: string;
		let kind: "session" | "apiKey";
		if (token.startsWith(SESSION_PREFIX)) {
			prefix = SESSION_PREFIX;
			kind = "session";
		} else if (token.startsWith(APIKEY_PREFIX)) {
			prefix = APIKEY_PREFIX;
			kind = "apiKey";
		} else {
			return null;
		}
		const rest = token.slice(prefix.length);
		const colon = rest.indexOf(":");
		if (colon <= 0) return null;
		return { kind, id: rest.slice(0, colon), base: rest.slice(colon + 1) };
	}
}

export namespace AuthHandler {
	export type AuthContext =
		| { type: "session"; sessionId: string; userId: number; role: string }
		| { type: "apiKey"; keyId: string; permissions: string[] }
		| { type: "unauthenticated" };

	export type SessionContext = Extract<AuthContext, { type: "session" }>;
}

export class AuthHandler {
	/** Resolve a request's bearer token into an AuthContext. */
	static async resolveRequest(c: Context): Promise<AuthHandler.AuthContext> {
		const header = c.req.header("Authorization") ?? "";
		if (!header.startsWith("Bearer ")) return { type: "unauthenticated" };
		const token = header.slice(7);
		const parsed = AuthUtils.parseToken(token);
		if (!parsed) return { type: "unauthenticated" };

		if (parsed.kind === "session") {
			const row = await AuthHandler.lookupSessionRow(parsed.id);
			if (!row) return { type: "unauthenticated" };
			if (row.expires_at <= Date.now()) {
				await AuthHandler.deleteSession(row.id);
				return { type: "unauthenticated" };
			}
			if (!(await Bun.password.verify(row.hashed_token, parsed.base))) {
				return { type: "unauthenticated" };
			}
			return { type: "session", sessionId: row.id, userId: row.user_id, role: row.user_role };
		}
		const row = await AuthHandler.lookupAPIKeyRow(parsed.id);
		if (!row) return { type: "unauthenticated" };
		if (!(await Bun.password.verify(row.hashed_token, parsed.base))) {
			return { type: "unauthenticated" };
		}
		return { type: "apiKey", keyId: row.id, permissions: row.permissions };
	}

	/**
	 * Hono middleware: attaches `authContext` on every request. For public auth
	 * endpoints (login, reset-password) a missing/invalid token continues as
	 * `unauthenticated`; for every other path it returns 401.
	 */
	static authMiddlewareV1 = createMiddleware<{
		Variables: { authContext: AuthHandler.AuthContext };
	}>(async (c, next) => {
		const ctx = await AuthHandler.resolveRequest(c);
		c.set("authContext", ctx);
		if (ctx.type === "unauthenticated" && !PUBLIC_AUTH_PATHS.has(c.req.path)) {
			return APIResponse.unauthorized(c, "Missing or invalid Authorization header");
		}
		await next();
	});

	/** Narrow to a session context or return a 401 response. */
	static requireSession(c: Context): APIResponse.Types.Returnable | AuthHandler.SessionContext {
		const ctx = c.get("authContext") as AuthHandler.AuthContext;
		if (ctx.type !== "session") return APIResponse.unauthorized(c, "Session required");
		return ctx;
	}

	/** Narrow to an admin session or return a 401/403 response. */
	static requireAdmin(c: Context): APIResponse.Types.Returnable | AuthHandler.SessionContext {
		const ctx = c.get("authContext") as AuthHandler.AuthContext;
		if (ctx.type !== "session") return APIResponse.unauthorized(c, "Session required");
		if (ctx.role !== "admin") return APIResponse.forbidden(c, "Admin access required");
		return ctx;
	}

	// --- project-specific stubs ------------------------------------------------
	private static async lookupSessionRow(
		_id: string,
	): Promise<{ id: string; user_id: number; user_role: string; hashed_token: string; expires_at: number } | null> {
		// const row = await DB.instance().select().from(DB.Tables.sessions).where(eq(DB.Tables.sessions.id, _id)).get();
		// return row ?? null;
		return null;
	}
	private static async lookupAPIKeyRow(
		_id: string,
	): Promise<{ id: string; hashed_token: string; permissions: string[] } | null> {
		// const row = await DB.instance().select().from(DB.Tables.api_keys).where(eq(DB.Tables.api_keys.id, _id)).get();
		// return row ? { ...row, permissions: JSON.parse(row.permissions) } : null;
		return null;
	}
	private static async deleteSession(_id: string): Promise<void> {
		// await DB.instance().delete(DB.Tables.sessions).where(eq(DB.Tables.sessions.id, _id));
	}
}

export { DUMMY_HASH };
// Keep DUMMY_HASH referenced; use it in the login route so missing-user verify time
// equals wrong-password time (see docs/10-auth.md#login-hardening).

/**
 * Minimal rate limiter for the login route (in-memory, per-IP-per-username).
 * For production scale, move to Redis.
 */
export namespace AuthRateLimiter {
	const attempts = new Map<string, { count: number; firstAt: number }>();
	const WINDOW_MS = 5 * 60 * 1000;
	const MAX = 10;

	export function check(ip: string, username: string): { allowed: boolean; retryAfter: number } {
		const key = `${ip}:${username}`;
		const now = Date.now();
		const entry = attempts.get(key);
		if (entry && now - entry.firstAt < WINDOW_MS) {
			if (entry.count >= MAX) {
				return { allowed: false, retryAfter: Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 1000) };
			}
			entry.count++;
		} else {
			attempts.set(key, { count: 1, firstAt: now });
		}
		return { allowed: true, retryAfter: 0 };
	}

	export function reset(ip: string, username: string): void {
		attempts.delete(`${ip}:${username}`);
	}
}