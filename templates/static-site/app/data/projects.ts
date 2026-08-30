/**
 * Static, typed content module — for data that isn't worth a backend.
 * Consumed via `computed` in pages. See docs/06-frontend-nuxt.md#static-content-sites.
 */
export interface Project {
	id: string;
	title: string;
	description: string;
	tags: string[];
	url: string;
}

export const projects: Project[] = [
	{
		id: "example",
		title: "Example Project",
		description: "A short, human-readable description of the project.",
		tags: ["TypeScript", "Nuxt"],
		url: "https://example.com",
	},
];

export function getProjectById(id: string): Project | undefined {
	return projects.find((project) => project.id === id);
}