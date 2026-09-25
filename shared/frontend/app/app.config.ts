/**
 * app.config.ts — NuxtUI theme.
 *
 * `neutral` is `slate` everywhere; pick your project's `primary` from the NuxtUI palette
 * (e.g. `sky` for LeiOS/Delivr/sites, `emerald` for NowIP, `orange` for MindCode). `radius: 0.5`
 * and `blackAsPrimary: false` are the house defaults. See docs/15-design-system.md.
 */
export default defineAppConfig({
	ui: {
		colors: {
			primary: "sky",
			neutral: "slate",
		},
	},
	theme: {
		radius: 0.5,
		blackAsPrimary: false,
	},
});
