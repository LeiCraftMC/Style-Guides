import { defineConfig } from "@hey-api/openapi-ts";

// Generate the typed API client from the backend's OpenAPI spec.
// `bun run api-client:generate` runs `openapi-ts`, which reads this file.
// Output goes to app/api-client/ (committed, never hand-edited).
export default defineConfig({
	input: "http://localhost:12500/docs/v1/openapi",
	output: "app/api-client",
	plugins: ["@hey-api/client-nuxt", "@hey-api/typescript", "@hey-api/sdk", "zod"],
});