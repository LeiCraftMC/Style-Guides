/**
 * echo.ts — minimal WebSocket route example (crossws / defineWebSocketHandler).
 *
 * Enable with `nitro.experimental.websocket = true` (see nuxt.config.ts). Connect from the
 * frontend with a `useXxxWebSocketManager`-style composable. For a real-time feature, drive
 * the work from a static `<Name>SessionRunner` + `<Name>SessionRegistry` pair and re-validate
 * the bearer token on every privileged message (see docs/04-backend-hono.md#realtime-websocket).
 *
 * This echo endpoint is a placeholder — delete it (and the `experimental.websocket` flag) if
 * your app doesn't need realtime.
 */
import { defineWebSocketHandler } from "h3";

export default defineWebSocketHandler({
	async open(peer) {
		peer.send("connected");
	},
	async message(peer, message) {
		peer.send(`echo: ${message.toString()}`);
	},
	async close(peer) {
		// cleanup per-connection state here
		peer.send("disconnected");
	},
	error(_peer, error) {
		console.error("[ws/echo] error:", error);
	},
});