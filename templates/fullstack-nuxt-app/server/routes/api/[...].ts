import { Hono } from "hono";
import { defineEventHandler, getRequestURL, getMethod, readRawBody } from "h3";
import { API } from "../../lib/api";

// Catch-all: forward every /api/** request to the Hono app (mounted at /api).
// Hono then handles /api/v1/**, /api/health, /api/docs/v1. See docs/04-backend-hono.md.
let wrapper: Hono | null = null;

export default defineEventHandler(async (event) => {
	if (!wrapper) {
		wrapper = new Hono();
		wrapper.route("/api", API.getApp());
	}

	const url = getRequestURL(event);
	const method = getMethod(event);

	const request = new Request(url, {
		method,
		headers: event.headers,
		body: method !== "GET" && method !== "HEAD" ? await readRawBody(event) : undefined,
	});

	return wrapper.fetch(request);
});