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

const schema = new ConfigSchema()
	.add("SVC_LOG_LEVEL", false, ["debug", "info", "warn", "error", "critical"])
	.add("SVC_API_HOST", false)
	.add("SVC_API_PORT", false)
	.add("SVC_API_DISABLE_DOCS", false, [true, false])
	.add("SVC_DB_PATH", false)
	.add("SVC_DB_AUTO_MIGRATE", false, [true, false])
	.add("SVC_APP_URL", false)
	.add("SVC_CONFIG_BASE_DIR", false);

export type ParsedConfig = ConfigLike<typeof schema.schema>;

export class ConfigHandler {
	private static config: ParsedConfig | null = null;

	static getConfig(): ParsedConfig {
		if (!this.config) {
			throw new Error("Config not loaded. Call ConfigHandler.loadConfig() first.");
		}
		return this.config;
	}

	static async loadConfig(): Promise<ParsedConfig> {
		if (this.config) return this.config;
		this.config = schema.parse();
		return this.config;
	}
}
