/**
 * ConfigSchema — a typed environment-variable builder.
 *
 * Chain `.add(KEY, required, type?)` to declare your env vars, then `.parse()` reads
 * `process.env`, coerces booleans (`"true"`/`"false"`), validates enums case-insensitively,
 * and `process.exit(1)`s on a missing required var. The result is fully typed.
 *
 * Each project builds its own `ConfigHandler` with its own `<PREFIX>_` vars (e.g. `DLA_`,
 * `NOWIP_`, `MINDCODE_`). The example below uses `EXAMPLE_` — rename it.
 */
import { Logger } from "./logger";

interface ConfigSchemaSetting<
	REQUIRED extends ConfigSchemaSetting.Required,
	TYPE extends ConfigSchemaSetting.Type = undefined,
> {
	required: REQUIRED;
	type?: TYPE;
}

namespace ConfigSchemaSetting {
	export type Required = boolean;
	export type Type = string[] | boolean[] | undefined;
	export type Sample = ConfigSchemaSetting<Required, Type>;
}

type ConfigValueType<
	T extends ConfigSchemaSetting.Sample,
	F = [T] extends [ConfigSchemaSetting<any, infer U>]
		? U extends (string | boolean)[]
			? U[number]
			: string
		: string,
> = T["required"] extends true ? F : F | undefined;

interface ConfigSchemaSettings {
	[key: string]: ConfigSchemaSetting.Sample;
}

type ConfigLike<T extends ConfigSchemaSettings> = {
	[K in keyof T]: ConfigValueType<T[K]>;
};

class ConfigSchema<T extends ConfigSchemaSettings = {}> {
	readonly schema: T = {} as any;

	public add<
		KEY extends string,
		Setings extends ConfigSchemaSetting<ISREQUIRED, TYPE>,
		ISREQUIRED extends boolean,
		const TYPE extends ConfigSchemaSetting.Type = undefined,
	>(key: KEY, required = false as ISREQUIRED, type?: TYPE) {
		(this.schema as any)[key] = { required, type };
		return this as any as ConfigSchema<T & { [K in KEY]: Setings }>;
	}

	public parse() {
		const result: ConfigLike<T> = {} as ConfigLike<T>;

		for (const [key, settings] of Object.entries(this.schema)) {
			const value = process.env[key];

			if (!value) {
				if (settings.required) {
					Logger.error(`The environment variable ${key} is required but not set.`);
					process.exit(1);
				}
				continue;
			}

			if (settings.type) {
				if (typeof settings.type[0] === "boolean") {
					(result[key] as any) = value.toLowerCase() === "true";
					continue;
				}
				if (!(settings.type as string[]).some((t) => t.toLowerCase() === value.toLowerCase())) {
					Logger.error(
						`The environment variable ${key} has to be one of the following: ${settings.type.join(", ")}`,
					);
					process.exit(1);
				}
			}

			(result[key] as any) = value;
		}
		return result;
	}
}

// --- Example ConfigHandler -----------------------------------------------------
// Replace EXAMPLE_ with your project's env prefix and add/remove vars to match.
const schema = new ConfigSchema()
	.add("EXAMPLE_LOG_LEVEL", false, ["debug", "info", "warn", "error", "critical"])
	.add("EXAMPLE_API_HOST", false)
	.add("EXAMPLE_API_PORT", false)
	.add("EXAMPLE_API_DISABLE_DOCS", false, [true, false])
	.add("EXAMPLE_DB_PATH", false)
	.add("EXAMPLE_DB_AUTO_MIGRATE", false, [true, false])
	.add("EXAMPLE_APP_URL", false);

export type ParsedConfig = ConfigLike<typeof schema.schema>;

export class ConfigHandler {
	private static config: ParsedConfig | null = null;

	static getConfig(): ParsedConfig {
		if (!ConfigHandler.config) {
			throw new Error("Config not loaded. Call await ConfigHandler.loadConfig() first.");
		}
		return ConfigHandler.config;
	}

	static async loadConfig(): Promise<ParsedConfig> {
		if (ConfigHandler.config) return ConfigHandler.config;
		ConfigHandler.config = schema.parse();
		return ConfigHandler.config;
	}
}
