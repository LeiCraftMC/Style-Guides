import { codeIcons } from "./data/code-icons";

export default defineAppConfig({
	ui: {
		colors: {
			primary: "sky",
			neutral: "slate",
		},
		prose: {
			codeIcon: codeIcons,
		},
	},
	theme: {
		radius: 0.5,
		blackAsPrimary: false,
	},
});
