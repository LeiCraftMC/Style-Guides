export default defineNuxtConfig({
	future: { compatibilityVersion: 4 },
	srcDir: "app/",
	modules: ["@nuxt/ui"],
	css: ["~/assets/css/main.css"],
	ui: { colorMode: true },
	compatibilityDate: "2026-08-20",
	nitro: { preset: "bun" },
	runtimeConfig: {
		public: {
			apiUrl: process.env.NUXT_PUBLIC_API_URL || "http://localhost:3001",
			appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
		},
	},
});
