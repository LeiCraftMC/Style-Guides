/**
 * Static, typed content module — for data that isn't worth a backend.
 * Consumed via `computed` in pages. See docs/06-frontend-nuxt.md#static-content-sites.
 */
export interface ProjectLink {
	label: string;
	url: string;
	icon?: string;
}

export interface Project {
	id: string;
	title: string;
	shortDescription: string;
	description: string;
	logo: string;
	tags: string[];
	status?: string;
	sourceUrl: string;
	websiteUrl?: string;
	additionalLinks?: ProjectLink[];
}

export const projects: Project[] = [
	{
		id: "example",
		title: "Example Project",
		description: "A short, human-readable description of the project.",
		shortDescription: "A short, human-readable description of the project.",
		logo: "logo_path",
		tags: ["TypeScript", "Nuxt"],
		sourceUrl: "https://git.leicraftmc.de/LeiCraftMC/example-project",
		websiteUrl: "https://example.com",
	},
];

export function getProjectById(id: string): Project | undefined {
	return projects.find((project) => project.id === id);
}

export function getAllProjectIds(): string[] {
	return projects.map((project) => project.id);
}
