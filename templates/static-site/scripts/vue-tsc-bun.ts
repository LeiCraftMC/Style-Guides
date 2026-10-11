/**
 * Preloaded by the `typecheck` script (`BUN_OPTIONS=--preload=./scripts/vue-tsc-bun.ts`).
 *
 * vue-tsc adds `.vue` support by patching `fs.readFileSync` while it `require()`s
 * `typescript/lib/tsc.js`. Bun's `require()` reads module source natively and skips that hook, so
 * on Bun vue-tsc silently runs plain tsc and never checks a `.vue` file. Bun does honour
 * `Module._extensions`, so load `tsc.js` through `fs.readFileSync` here. Fail instead of passing
 * if the result is still unpatched or vue-tsc never loads `tsc.js` this way. Remove once vue-tsc
 * no longer relies on the `fs.readFileSync` hook.
 */
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";

type JsLoader = (mod: { _compile(code: string, filename: string): void }, filename: string) => void;

const extensions = (Module as unknown as { _extensions: Record<string, JsLoader> })._extensions;
const loadJs = extensions[".js"] as JsLoader;

let loadedTsc = false;

extensions[".js"] = (mod, filename) => {
	if (!filename.split(path.sep).join("/").endsWith("/typescript/lib/tsc.js")) {
		return loadJs(mod, filename);
	}
	loadedTsc = true;
	const source = fs.readFileSync(filename, "utf8");
	if (!source.includes("proxyCreateProgram")) {
		throw new Error(
			"vue-tsc-bun: tsc.js was not patched by vue-tsc; .vue files would not be type-checked.",
		);
	}
	mod._compile(source, filename);
};

// The preload also runs in the `nuxt` process; only a vue-tsc run must have gone through the hook.
if ((process.argv[1] ?? "").replaceAll("\\", "/").includes("/vue-tsc/")) {
	process.on("exit", (code) => {
		if (code === 0 && !loadedTsc) {
			console.error("vue-tsc-bun: vue-tsc did not load tsc.js; .vue files were not type-checked.");
			process.exitCode = 1;
		}
	});
}
