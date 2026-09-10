import type { BuildConfig } from "bun";

/**
 * The compile engine: wraps `bun build --compile --sourcemap --minify --bytecode` and injects
 * `APP_VERSION` via `--define`. Targets: linux-x64 (modern), linux-x64-baseline, linux-arm64.
 * Replace `<binary-name>` with your compiled binary name. See docs/11-cli-and-infra.md.
 */
export enum Platforms {
	"linux-x64" = "bun-linux-x64-modern",
	"linux-x64-baseline" = "bun-linux-x64-baseline",
	"linux-arm64" = "bun-linux-arm64",

    // "win-x64" = "bun-windows-x64-modern",
    // "win-x64-baseline" = "bun-windows-x64-baseline",

    // "macos-x64" = "bun-darwin-x64-modern",
    // "macos-x64-baseline" = "bun-darwin-x64-baseline",
    // "macos-arm64" = "bun-darwin-arm64"
}

export type PlatformArg = keyof typeof Platforms | "auto";

class CompilerOptions {

	public sourcemap = true;
	public minify = true;
	public bytecode = true;
	public entrypoint = "./scripts/entrypoint.ts";
	// Replace <binary-name> with your compiled binary name (e.g. leios-api, nowip-api).
	public outfile = "./build/bin/<binary-name>";

	public env: NodeJS.ProcessEnv = {};
	
	constructor(
		public platform: PlatformArg,
		public version: string,
		private versionInFileName: boolean,
		public additionalOptions: Partial<BuildConfig> = {}
	) {}

	public getOutFilePath() : string {
		let outfile = this.outfile;

		if (this.versionInFileName) {
			outfile += `-v${this.version}`;
		}

		if (this.platform !== "auto") {
			if (!Object.keys(Platforms).some((p) => p === this.platform)) {
				throw new Error(`Invalid platform: ${this.platform}`);
			}
			outfile += `-${this.platform}`;
		}

		return outfile;
	}

	public getOptions() : BuildConfig {

		const outfile = this.getOutFilePath();

		return {
			sourcemap: this.sourcemap,
			minify: this.minify,
			bytecode: this.bytecode,
			entrypoints: [this.entrypoint],
			compile: {
				outfile: outfile,
				...(this.platform === "auto" ? {} : { target: Platforms[this.platform] }),
			},
			format: "esm",
			define: {
				"process.env.APP_VERSION": `"${this.version}"`,
				...Object.fromEntries(
					Object.entries(this.env).map(([key, value]) => [
						`process.env.${key}`,
						`"${value}"`,
					]),
				),
			},
			...this.additionalOptions
		};
	}
}

export class Compiler {

	private readonly options: CompilerOptions;

	constructor(
		private platform: PlatformArg,
		private version: string,
		versionInFileName: boolean,
	) {
		this.options = new CompilerOptions(platform, version, versionInFileName);
	}

	async build() {
		try {
			console.log(`Building from sources. Version: ${this.version} Platform: ${this.platform}`);
			const output = await Bun.build(this.options.getOptions());
			console.log(output);
		} catch (err: any) {
			console.log(`Compiling Failed:\n`, err);
		}
		
	}
}
