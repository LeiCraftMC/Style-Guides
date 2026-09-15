// Static site (nuxt generate). Nuxt 4 (app/ srcDir is the default).
export default defineNuxtConfig({

	compatibilityDate: "2026-09-01",
	devtools: { enabled: true },
	modules: ["@nuxt/ui"],

	app: {
        head: {
            htmlAttrs: {
                lang: 'en-US',
            },
            charset: 'utf-8',
            viewport: 'width=device-width, initial-scale=1',
            meta: [
                { name: 'author', content: 'LeiCraft_MC' },
                { name: 'robots', content: 'index, follow, max-image-preview:large' },
                { name: 'theme-color', content: '#0b0c1b' },
            ],
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
            ],
        },
    },

	colorMode: {
		preference: "dark",
		fallback: "dark",
		classSuffix: "",
	},

	ssr: true,

	css: [
		"~/assets/css/main.css"
	],

	nitro: {
		// sometimes prerenderng has to be set specifically for certain routes, like /projects/**, to ensure they are generated correctly.
        prerender: {
            routes: [
                '/projects/example'
            ],
        },
    },

	telemetry: false

});