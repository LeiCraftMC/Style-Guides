import { z } from "zod";

export namespace HealthModel {
	export const Response = z.object({
		status: z.literal("ok"),
		uptime: z.number(),
	});
	export type Response = z.infer<typeof Response>;
}