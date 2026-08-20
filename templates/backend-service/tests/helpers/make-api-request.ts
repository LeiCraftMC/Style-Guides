/**
 * makeAPIRequest — the backbone of the integration-test harness.
 *
 * Drives a Hono app in-process (no network), asserts the status code, and — when
 * `expectedBodySchema` is provided — validates the envelope's `data` with Zod. Pair with the
 * `preload.ts` harness that boots a real `API` + DB. See docs/12-testing.md.
 */
import type { Hono } from "hono";
import type { ZodType } from "zod";

export interface MakeAPIRequestOptions {
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	authToken?: string | null;
	body?: unknown;
	/** When set, the response `data` is validated against this Zod schema. */
	expectedBodySchema?: ZodType;
}

const OK_CODES = [200, 201, 202, 204] as const;

export interface APIRequestResult<T = unknown> {
	status: number;
	body: { success: boolean; code: number; message: string; data: unknown };
	data: T;
}

export async function makeAPIRequest<T = unknown>(
	app: Hono,
	path: string,
	options: MakeAPIRequestOptions = {},
	expectedCode?: number,
): Promise<APIRequestResult<T>> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (options.authToken) headers.Authorization = `Bearer ${options.authToken}`;

	const res = await app.request(path, {
		method: options.method ?? "GET",
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});

	const expected = expectedCode !== undefined ? [expectedCode] : [...OK_CODES];
	if (!expected.includes(res.status)) {
		throw new Error(
			`Expected status ${expected.join("|")} but got ${res.status} for ${options.method ?? "GET"} ${path}`,
		);
	}

	const body = (await res.json()) as APIRequestResult["body"];

	if (options.expectedBodySchema) {
		const parsed = options.expectedBodySchema.safeParse(body.data);
		if (!parsed.success) {
			throw new Error(`Response body did not match schema: ${parsed.error.message}`);
		}
		return { status: res.status, body, data: parsed.data as T };
	}
	return { status: res.status, body, data: body.data as T };
}