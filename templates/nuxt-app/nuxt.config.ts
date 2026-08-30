// Nuxt 4 (app/ srcDir is the default). See docs/06-frontend-nuxt.md.
export default defineNuxtConfig({
	compatibilityDate: "2026-08-20",
	devtools: { enabled: true },
	modules: ["@nuxt/ui"],
	colorMode: {
		preference: "dark",
		fallback: "dark",
		classSuffix: "",
	},
	ssr: true,
	css: ["~/assets/css/main.css"],
	nitro: {
		preset: "bun",
	},
	runtimeConfig: {
		public: {
			apiUrl: process.env.NUXT_PUBLIC_API_URL || "http://localhost:12500",
			appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:12510",
		},
	},
});