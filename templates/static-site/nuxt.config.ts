export default defineNuxtConfig({
	future: { compatibilityVersion: 4 },
	srcDir: "app/",
	modules: ["@nuxt/ui"],
	css: ["~/assets/css/main.css"],
	ui: { colorMode: true },
	compatibilityDate: "2026-08-20",
	nitro: { preset: "static" },
});
