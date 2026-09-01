import { defineConfig } from "@hey-api/openapi-ts";

// `bun run api-client:generate` serves the raw Hono app via Bun.serve (see
// scripts/api-client-generate.ts) and reads the live spec. The /api prefix is only
// applied when Hono is mounted inside Nitro, so the standalone spec is at /docs/v1/openapi.
export default defineConfig({
	input: "http://127.0.0.1:12520/docs/v1/openapi",
	output: "app/api-client",
	plugins: ["@hey-api/client-nuxt", "@hey-api/typescript", "@hey-api/sdk", "zod"],
});