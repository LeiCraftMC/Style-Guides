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
				{ name: "theme-color", content: "#020617" },
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

	runtimeConfig: {
		public: {
			// Public site origin; `usePageSeo` resolves canonical and og:url against it.
			appUrl: "https://www.example.com",
		},
	},

	// Bundle every icon at build time; "none" never fetches from the Iconify API at runtime.
	// The scan also covers `.ts` files (e.g. `app/data/`), which the default patterns skip.
	icon: {
		provider: "none",
		clientBundle: {
			scan: {
				globInclude: ["app/**/*.{vue,ts}", "content/**/*.md"],
			},
		},
	},

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
