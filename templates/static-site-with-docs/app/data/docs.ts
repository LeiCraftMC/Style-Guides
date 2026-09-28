/**
 * Static docs navigation — consumed by the docs sidebar and prev/next links.
 * Follows the style-guide "static data in app/data/" idiom.
 */

export interface DocsPage {
	/** Absolute page path, also the route. */
	to: string;
	title: string;
	description: string;
	icon: string;
}

export interface DocsSection {
	label: string;
	pages: DocsPage[];
}

export const docsSections: DocsSection[] = [
	{
		label: "Introduction",
		pages: [
			{
				to: "/docs",
				title: "Overview",
				description: "What this project is, how it works, and where to go next.",
				icon: "i-lucide-book-open",
			},
			{
				to: "/docs/about",
				title: "About",
				description: "Background, goals, and architecture of the project.",
				icon: "i-lucide-info",
			},
		],
	},
	{
		label: "Guides",
		pages: [
			{
				to: "/docs/getting-started",
				title: "Getting Started",
				description: "Install dependencies, run the dev server, and generate the static site.",
				icon: "i-lucide-rocket",
			},
		],
	},
];

/** Flat list of pages in reading order, for prev/next navigation. */
export const docsPagesFlat: DocsPage[] = docsSections.flatMap((section) => section.pages);

export function getDocsPageByPath(path: string): DocsPage | undefined {
	return docsPagesFlat.find((page) => page.to === path);
}
