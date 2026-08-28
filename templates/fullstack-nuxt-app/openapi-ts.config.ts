import { defineConfig } from "@hey-api/openapi-ts";

// Full-stack Nuxt: Hono is mounted at /api, so the OpenAPI spec lives at
// /api/docs/v1/openapi. `bun run api-client:generate` runs `openapi-ts`.
export default defineConfig({
	input: "http://localhost:3000/api/docs/v1/openapi",
	output: "app/api-client",
	plugins: ["@hey-api/client-nuxt", "@hey-api/typescript", "@hey-api/sdk", "zod"],
});