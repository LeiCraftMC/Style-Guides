// Full-stack Nuxt: Hono backend lives in server/ and owns /api (see docs/04-backend-hono.md).
export default defineNuxtConfig({
	future: { compatibilityVersion: 4 },
	srcDir: "app/",
	modules: ["@nuxt/ui"],
	css: ["~/assets/css/main.css"],
	ui: { colorMode: true },
	compatibilityDate: "2026-08-20",
	nitro: {
		preset: "bun",
		// Keep the native SQLite binding out of the bundle.
		rollupConfig: { external: ["bun:sqlite"] },
	},
	runtimeConfig: {
		public: {
			// The API is on the same origin under /api.
			appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
		},
	},
	routeRules: {
		"/dashboard/**": { ssr: false },
		"/auth/**": { ssr: false },
		"/**": { ssr: true },
	},
});