import { Logger } from "./logger";
import { z } from "zod";

interface ConfigSchemaSettings {
	[key: string]: CS.ConfigItem<z.ZodType>;
}

type ConfigLike<T extends ConfigSchemaSettings> = {
    [K in keyof T]: z.infer<T[K]["_schema"]>;
}

class CS {

	private constructor() {}

	static string() {
		return new CS.ConfigItem(z.string());
	}

	static number() {
		return new CS.ConfigItem(z.coerce.number());
	}

	static boolean() {
		return new CS.ConfigItem(z.coerce.boolean());
	}

	static enum<const T extends readonly string[]>(values: T) {
		return new CS.ConfigItem(z.enum(values));
	}

	static array() {
		return new CS.ConfigItem(z.string().transform<string[]>((val) => {
			if (typeof val === "string") {
				return val.split(",").map(v => v.trim()).filter(Boolean);
			}
			return [];
		}));
	}

}

namespace CS {

	export class ConfigItem<const Schema extends z.ZodType> {

		constructor(public _schema: Schema) {}

		public parse(value: unknown) {
			return this._schema.safeParse(value);
		}

		public default(value: z.util.NoUndefined<z.core.output<Schema>>) {
			this._schema = this._schema.default(value) as any;
			return this as any as ConfigItem<z.ZodDefault<Schema>>;
		}

		public optional() {
			this._schema = this._schema.optional() as any;
			return this as any as ConfigItem<z.ZodOptional<Schema>>;
		}

	}

}

class ConfigSchema<T extends ConfigSchemaSettings> {

	readonly schema: T;

	constructor(schema: T) {
		this.schema = schema;
	}

    public parse() {
		
        const result: ConfigLike<T> = {} as ConfigLike<T>;

        for (const [key, settings] of Object.entries(this.schema)) {
            
            const value = process.env[key];

			const parseResult = settings.parse(value);
			if (!parseResult.success) {
				Logger.error(`Failed to read the environment variable ${key}: ${parseResult.error.issues[0]?.message}`);
				process.exit(1);
			}


            (result[key] as any) = value;

        }
        return result;
    }

}



// @ts-ignore
export type ParsedConfig = ConfigLike<typeof ConfigHandler.schema.schema>;

export class ConfigHandler {

    private static schema = new ConfigSchema({

		APPPREFIX_LOG_LEVEL: CS.enum(["debug", "info", "warn", "error", "critical"]).default("info"),

		APPPREFIX_API_HOST: CS.string().default("::"),
		APPPREFIX_API_PORT: CS.number().default(12500),
		APPPREFIX_API_DISABLE_DOCS: CS.boolean().default(false),

		APPPREFIX_DB_PATH: CS.string().default("./data/db.sqlite"),
		APPPREFIX_DB_AUTO_MIGRATE: CS.boolean().default(true),

		APPPREFIX_LOG_DIR: CS.string().default("./data/logs"),
		APPPREFIX_CONFIG_BASE_DIR: CS.string().default("./config"),

		APPPREFIX_APP_URL: CS.string(),

		APPPREFIX_SMTP_HOST: CS.string().optional(),
		APPPREFIX_SMTP_PORT: CS.number().optional(),
		APPPREFIX_SMTP_USERNAME: CS.string().optional(),
		APPPREFIX_SMTP_PASSWORD: CS.string().optional(),
		APPPREFIX_SMTP_FROM: CS.string().optional(),
		APPPREFIX_SMTP_SECURE: CS.boolean().optional(),
		
	});


    private static config: ParsedConfig | null = null;

    /** You have to call {@link ConfigHandler.parseConfigFile} before trying to access the config. */
    static getConfig() {
        return this.config;
    }

    static async loadConfig() {
        if (this.config) return this.config;
        this.config = this.schema.parse();
        return this.config;
    }

}
