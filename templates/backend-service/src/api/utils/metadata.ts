import { eq } from "drizzle-orm";
import { z } from "zod";
import { DB } from "../../db/index";

export class RuntimeMetadata {
	protected static readonly schemas = {
		dummy: z.record(z.string(), z.any()).default({}),
	} as const;

	/** A key without a stored row reads as its schema default; nothing is written. */
	protected static async getMetadata<T extends keyof typeof this.schemas>(
		key: T,
	): Promise<z.infer<(typeof this.schemas)[T]>> {
		const record = await DB.instance()
			.select()
			.from(DB.Tables.metadata)
			.where(eq(DB.Tables.metadata.key, key))
			.get();

		// Indexing the heterogeneous `schemas` record by the generic key widens the
		// parse result to a union, so narrow it back to this key's inferred type.
		type Parsed = z.infer<(typeof this.schemas)[T]>;

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
