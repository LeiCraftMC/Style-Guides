import { defineEventHandler, getRequestIP, setResponseStatus, toWebRequest } from "h3";
import { Hono } from "hono";
import { API } from "../../lib/api";

// Catch-all: forward every /api/** request to the Hono app (mounted at /api).
// Hono then handles /api/v1/**, /api/health, /api/docs/v1. See docs/04-backend-hono.md.
let wrapper: Hono | null = null;

// Only cache the wrapper once `API.getApp()` succeeds. A request that arrives while
// `server/plugins/startup.ts` is still running `API.init()` must not cache an empty router.
function getWrapper(): Hono | null {
	if (wrapper) return wrapper;
	try {
		const app = new Hono();
		app.route("/api", API.getApp());
		wrapper = app;
		return wrapper;
	} catch {
		return null;
	}
}

export default defineEventHandler(async (event) => {
	const app = getWrapper();
	if (!app) {
		setResponseStatus(event, 503);
		return {
			success: false,
			code: 503,
			message: "API is starting, please retry shortly",
		};
	}

	// `toWebRequest` passes the body through as raw bytes (uploads stay intact) and gives methods
	// without a body, such as OPTIONS preflights, none. `getRequestIP` is the socket address where
	// Nitro has one — the Bun preset has none, so production relies on API_TRUST_PROXY.
	return app.fetch(toWebRequest(event), { clientIP: getRequestIP(event) });
});
