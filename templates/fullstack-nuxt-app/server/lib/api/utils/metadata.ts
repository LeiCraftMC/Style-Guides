import { eq } from "drizzle-orm";
import { z } from "zod";
import { DB } from "../../db/index";

export class RuntimeMetadata {
	protected static readonly schemas = {
		dummy: z.record(z.string(), z.any()).default({}),
	} as const;

	protected static async getMetadata<T extends keyof typeof this.schemas>(
		key: T,
		createIfNotFound = false,
	): Promise<z.infer<(typeof this.schemas)[T]>> {
		const record = await DB.instance()
			.select()
			.from(DB.Tables.metadata)
			.where(eq(DB.Tables.metadata.key, key))
			.get();

		if (!record) {
			if (!createIfNotFound) {
				throw new Error(`Metadata with key '${key}' not found`);
			}

			const defaultData = this.schemas[key].parse(undefined);
			await DB.instance().insert(DB.Tables.metadata).values({
				key: key,
				data: defaultData,
			});
			return defaultData;
		}

		return this.schemas[key].parse(record.data);
	}

	protected static async setMetadata<T extends keyof typeof this.schemas>(
		key: T,
		data: z.infer<(typeof this.schemas)[T]>,
	): Promise<void> {
		await DB.instance()
			.update(DB.Tables.metadata)
			.set({
				data: data,
			})
			.where(eq(DB.Tables.metadata.key, key));
	}
}
