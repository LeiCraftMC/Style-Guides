// Static site + docs (nuxt generate). Nuxt 4 (app/ srcDir is the default).
export default defineNuxtConfig({
	compatibilityDate: "2026-09-01",
	devtools: { enabled: true },
	modules: ["@nuxt/ui", "@nuxt/content"],

	app: {
		head: {
			htmlAttrs: {
				lang: "en-US",
			},
			charset: "utf-8",
			viewport: "width=device-width, initial-scale=1",
			meta: [
				{ name: "author", content: "LeiCraft_MC" },
				{ name: "robots", content: "index, follow, max-image-preview:large" },
				{ name: "theme-color", content: "#0b0c1b" },
			],
			link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
		},
	},

	colorMode: {
		preference: "dark",
		fallback: "dark",
		classSuffix: "",
	},

	ssr: true,

	css: ["~/assets/css/main.css"],

	routeRules: {
		"/__nuxt_content/**": { prerender: false },
	},

	nitro: {
		preset: "static",
		prerender: {
			crawlLinks: true,
			routes: ["/"],
			ignore: ["/__nuxt_content/**"],
		},
	},

	telemetry: false,
});
