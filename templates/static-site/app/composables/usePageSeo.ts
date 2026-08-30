/**
 * usePageSeo — one composable for per-page SEO on static/marketing sites.
 * Wraps `useSeoMeta` + a canonical `useHead` link + optional JSON-LD.
 * See docs/06-frontend-nuxt.md#static-content-sites.
 */
type JsonLd = Record<string, unknown> & { "@type"?: string };

interface PageSeoOptions {
	title: string;
	description?: string;
	/** Canonical URL path or absolute URL; defaults to the current route. */
	canonical?: string;
	ogTitle?: string;
	ogImage?: string;
	noindex?: boolean;
	/** A JSON-LD block (`SoftwareApplication`, `Person`, `BreadcrumbList`, …). */
	jsonLd?: JsonLd | JsonLd[];
}

export function usePageSeo(options: PageSeoOptions) {
	const route = useRoute();
	const canonical = options.canonical ?? route.path;

	useSeoMeta({
		title: options.title,
		description: options.description,
		ogTitle: options.ogTitle ?? options.title,
		ogDescription: options.description,
		ogImage: options.ogImage,
		robots: options.noindex ? "noindex, nofollow" : "index, follow",
	});

	useHead({
		link: [{ rel: "canonical", href: canonical }],
	});

	if (options.jsonLd) {
		const blocks = Array.isArray(options.jsonLd) ? options.jsonLd : [options.jsonLd];
		useHead({
			script: blocks.map((block) => ({
				type: "application/ld+json",
				innerHTML: JSON.stringify(block),
			})),
		});
	}
}