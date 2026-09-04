/**
 * APIRouteSpec / APIResponseSpec — declarative OpenAPI route + response builders.
 *
 * Wrap a route with `APIRouteSpec.authenticated({ summary, description, tags, responses })`
 * and build the `responses` map with `APIResponseSpec.success/created/badRequest/...`.
 * `describeBasic(...)` merges response entries; `describeWithWrongInputs(...)` also appends
 * a 400. Used together with `zValidator` from `hono-openapi` so validation is reflected in the
 * spec. See docs/04-backend-hono.md and docs/05-api-contract.md.
 */
import { describeRoute, type DescribeRouteOptions, resolver } from "hono-openapi";
import { type MiddlewareHandler } from "hono";
import { z } from "zod";
import { APIResponse } from "./api-response";

export class APIRouteSpec {
	/** @deprecated Use `custom`, `authenticated`, or `unauthenticated` instead. */
	static basic(spec: APIResponseSpec.Types.DescribeRouteOptionsWithResponses): MiddlewareHandler {
		return describeRoute(spec);
	}

	static custom(spec: APIResponseSpec.Types.DescribeRouteOptionsWithResponses): MiddlewareHandler {
		return describeRoute(spec);
	}

	static authenticated(
		spec: APIResponseSpec.Types.DescribeRouteOptionsWithResponses,
	): MiddlewareHandler {
		return describeRoute({
			...spec,
			security: [{ bearerAuth: [] }],
		});
	}

	static unauthenticated(
		spec: APIResponseSpec.Types.DescribeRouteOptionsWithResponses,
	): MiddlewareHandler {
		return describeRoute({
			...spec,
			security: [],
		});
	}
}

export class APIResponseSpec {
	static describeBasic<T extends APIResponseSpec.Types.BasicDescription[]>(...responseSchemas: T) {
		return Object.assign({}, ...responseSchemas);
	}

	static describeWithWrongInputs<T extends APIResponseSpec.Types.BasicDescription[]>(
		...responseSchemas: T
	) {
		return Object.assign(
			{},
			...responseSchemas,
			APIResponseSpec.badRequest("Bad Request: Syntax or validation error in request"),
		);
	}

	static success<Data extends z.ZodType<APIResponse.Types.NonRequiredReturnData>>(
		description: string,
		dataSchema: Data,
	) {
		return {
			200: {
				description,
				content: {
					"application/json": {
						schema: resolver(APIResponse.Schema.success(description, dataSchema)),
					},
				},
			},
		};
	}

	static successNoData(description: string) {
		return this.success(description, z.null());
	}

	static created<Data extends z.ZodType<APIResponse.Types.NonRequiredReturnData>>(
		description: string,
		dataSchema: Data,
	) {
		return {
			201: {
				description,
				content: {
					"application/json": {
						schema: resolver(APIResponse.Schema.created(description, dataSchema)),
					},
				},
			},
		};
	}

	static createdNoData(description: string) {
		return this.created(description, z.null());
	}

	static accepted<Data extends z.ZodType<APIResponse.Types.RequiredReturnData>>(
		description: string,
		dataSchema: Data,
	) {
		return {
			202: {
				description,
				content: {
					"application/json": {
						schema: resolver(APIResponse.Schema.accepted(description, dataSchema)),
					},
				},
			},
		};
	}

	/** @deprecated Use the specific error methods (`badRequest`, `unauthorized`, …) instead. */
	static genericError<StatusCode extends APIResponseSpec.Types.HTTP_ERROR_CODES>(
		statusCode: StatusCode,
		description: string,
	) {
		const settings = {
			description,
			content: {
				"application/json": {
					schema: resolver(APIResponse.Utils.genericErrorSchema(statusCode, description)),
				},
			},
		};

		return {
			[statusCode as StatusCode]: settings,
		} as {
			[K in StatusCode]: typeof settings;
		};
	}

	static serverError(message = "Internal Server Error: An unexpected error occurred on the server") {
		return this.genericError(500, message);
	}

	static unauthorized(
		message = "Unauthorized: Authentication is required and has failed or has not yet been provided",
	) {
		return this.genericError(401, message);
	}

	static forbidden(
		message = "Forbidden: You do not have permission to access the requested resource",
	) {
		return this.genericError(403, message);
	}

	static badRequest(message = "Bad Request: Syntax or validation error in request") {
		return this.genericError(400, message);
	}

	static notFound(message = "Not Found: The requested resource could not be found") {
		return this.genericError(404, message);
	}

	static conflict(
		message = "Conflict: The request could not be completed due to a conflict with the current state of the resource",
	) {
		return this.genericError(409, message);
	}

	static tooManyRequests(
		message = "Too Many Requests: You have sent too many requests in a given amount of time",
	) {
		return this.genericError(429, message);
	}
}

export namespace APIResponseSpec.Types {
	export type BasicDescription = {
		[statusCode: number]: {
			description: string;
			content: {
				"application/json": {
					schema: ReturnType<typeof resolver>;
				};
			};
		};
	};

	export type DescribeRouteOptionsWithResponses = DescribeRouteOptions & {
		responses: DescribeRouteOptions["responses"];
	};

	export type HTTP_ERROR_CODES = 400 | 401 | 403 | 404 | 409 | 429 | 500;
}
