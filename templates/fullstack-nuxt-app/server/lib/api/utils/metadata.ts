import { eq } from "drizzle-orm";
import { z } from "zod";
import { DB } from "../../db/index";

export class RuntimeMetadata {
	protected static readonly schemas = {
		dummy: z.record(z.string(), z.any()).default({}),
	} as const;

	/** A key without a stored row reads as its schema default; nothing is written. */
	protected static getMetadata<T extends keyof typeof this.schemas>(
		key: T,
	): Promise<z.infer<(typeof this.schemas)[T]>>;
	/**
	 * @deprecated Call `getMetadata(key)`: a missing key then reads as its schema default. With
	 * `createIfNotFound`, a missing key is still written with its default (`true`) or throws (`false`).
	 */
	protected static getMetadata<T extends keyof typeof this.schemas>(
		key: T,
		createIfNotFound: boolean,
	): Promise<z.infer<(typeof this.schemas)[T]>>;
	protected static async getMetadata<T extends keyof typeof this.schemas>(
		key: T,
		createIfNotFound?: boolean,
	): Promise<z.infer<(typeof this.schemas)[T]>> {
		const record = await DB.instance()
			.select()
			.from(DB.Tables.metadata)
			.where(eq(DB.Tables.metadata.key, key))
			.get();

		// Indexing the heterogeneous `schemas` record by the generic key widens the
		// parse result to a union, so narrow it back to this key's inferred type.
		type Parsed = z.infer<(typeof this.schemas)[T]>;

		if (!record && createIfNotFound !== undefined) {
			if (!createIfNotFound) {
				throw new Error(`Metadata with key '${key}' not found`);
			}

			const defaultData = this.schemas[key].parse(undefined) as Parsed;
			await this.setMetadata(key, defaultData);
			return defaultData;
		}

		return this.schemas[key].parse(record?.data) as Parsed;
	}

	protected static async setMetadata<T extends keyof typeof this.schemas>(
		key: T,
		data: z.infer<(typeof this.schemas)[T]>,
	): Promise<void> {
		const parsed = this.schemas[key].parse(data);

		await DB.instance()
			.insert(DB.Tables.metadata)
			.values({ key, data: parsed })
			.onConflictDoUpdate({
				target: DB.Tables.metadata.key,
				set: { data: parsed },
			});
	}
}
