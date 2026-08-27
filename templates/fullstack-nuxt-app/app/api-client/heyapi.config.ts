import { defineConfig } from "@hey-api/openapi-ts";

// Full-stack Nuxt: Hono is mounted at /api, so the OpenAPI spec lives at /api/docs/v1/openapi.
export default defineConfig({
	client: "@hey-api/client-fetch",
	input: "http://localhost:3000/api/docs/v1/openapi",
	output: "app/api-client",
});