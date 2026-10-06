// Generate the typed API client from the running backend's spec (see openapi-ts.config.ts), then
// patch the generated files (scripts/patch-api-client.ts). The backend must be running on
// port 12500 with docs enabled.
try {
	await Bun.$`bunx openapi-ts`;
	await Bun.$`bun scripts/patch-api-client.ts`;
} catch (err: any) {
	console.error("[api-client-generate] Failed to generate the API client:", err);
	process.exit(1);
}
