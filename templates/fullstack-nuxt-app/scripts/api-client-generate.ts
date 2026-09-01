/**
 * Standalone script that generates the OpenAPI TypeScript client.
 *
 * 1. Builds the Hono app via API.init() and serves it on a fixed port.
 * 2. Runs openapi-ts (reads openapi-ts.config.ts → fetches the live spec → generates app/api-client/).
 * 3. Patches known generator typing bugs via scripts/patch-api-client.ts.
 * 4. Stops the server (always, even on failure).
 *
 * The spec is served from the raw Hono app — no /api prefix (that is only applied when
 * Hono is mounted inside Nitro), so openapi-ts.config.ts reads /docs/v1/openapi.
 */
import { API } from "../server/lib/api";

const PORT = 12520;
const HOST = "127.0.0.1";

await API.init();
const apiServer = Bun.serve({ port: PORT, hostname: HOST, fetch: API.getApp().fetch });

try {
	console.log(`[api-client-generate] Server running at ${HOST}:${PORT}, generating client…`);
	await Bun.$`bunx openapi-ts`;
	console.log("[api-client-generate] openapi-ts succeeded, patching generated client…");
	await Bun.$`bun scripts/patch-api-client.ts`;
	console.log("[api-client-generate] Patch applied successfully.");
} finally {
	apiServer.stop();
	console.log("[api-client-generate] Server stopped.");
}