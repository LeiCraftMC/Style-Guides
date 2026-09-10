// Static site (nuxt generate). Nuxt 4 (app/ srcDir is the default).
export default defineNuxtConfig({

	compatibilityDate: "2026-09-01",
	devtools: { enabled: true },
	modules: ["@nuxt/ui"],

	colorMode: {
		preference: "dark",
		fallback: "dark",
		classSuffix: "",
	},

	ssr: true,

	css: [
		"~/assets/css/main.css"
	],

	telemetry: false

});