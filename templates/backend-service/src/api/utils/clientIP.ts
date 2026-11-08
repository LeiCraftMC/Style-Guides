import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { ConfigHandler } from "../../utils/config";

/**
 * The client's IP address, or `null` when it cannot be determined.
 *
 * Sources, in order:
 * 1. With `API_TRUST_PROXY`, the last `X-Forwarded-For` entry — the address the trusted proxy saw.
 *    Earlier entries are sent by the client and can be forged.
 * 2. A `clientIP` env binding, for callers that run the app via `app.fetch(request, { clientIP })`.
 * 3. The Bun server's socket address (`Bun.serve({ fetch: app.fetch })` passes the server as env).
 *
 * `app.request()` in tests passes no env, so it yields `null` unless a test provides one.
 */
export function getClientIP(c: Context): string | null {
	if (ConfigHandler.getConfig()?.API_TRUST_PROXY === true) {
		const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
		if (forwarded) return forwarded;
	}

	const bound = (c.env as { clientIP?: unknown } | undefined)?.clientIP;
	if (typeof bound === "string" && bound) return bound;

	try {
		return getConnInfo(c).remote.address ?? null;
	} catch {
		return null;
	}
}
