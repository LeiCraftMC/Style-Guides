import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	client: "@hey-api/client-fetch",
	input: "http://localhost:3001/docs/v1/openapi",
	output: "app/api-client",
});
