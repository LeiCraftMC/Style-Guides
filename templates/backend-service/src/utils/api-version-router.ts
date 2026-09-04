/**
 * APIVersionRouter — abstract base for mounting a versioned API (`/v1`, `/v2`, …).
 *
 * A concrete `APIv1Router extends APIVersionRouter { constructor() { super({ version: 1,
 * openAPIConfig, routes }); } }`. The `API` class mounts it at `/v${version}` and serves its
 * OpenAPI spec at `/docs/v${version}/openapi` + Scalar at `/docs/v${version}`.
 * See docs/04-backend-hono.md.
 */
import { Hono } from "hono";
import type { GenerateSpecOptions } from "hono-openapi";
import { HonoBase } from "hono/hono-base";

export abstract class APIVersionRouter<
	T extends APIVersionRouter.InitSettings = APIVersionRouter.InitSettings,
> {
	readonly version: number;
	readonly openAPIConfig: Readonly<APIVersionRouter.OpenAPIConfig>;
	readonly router: HonoBase;

	protected constructor(settings: Readonly<T>) {
		this.version = settings.version;
		this.openAPIConfig = settings.openAPIConfig;

		if (settings.routes instanceof HonoBase) {
			this.router = settings.routes;
		} else if (Array.isArray(settings.routes)) {
			this.router = new Hono();
			for (const route of settings.routes as Array<{ router: HonoBase } | HonoBase>) {
				if (route instanceof HonoBase) {
					this.router.route("/", route);
				} else if ("router" in route && route.router instanceof HonoBase) {
					this.router.route("/", route.router);
				} else {
					throw new Error(
						"Invalid route configuration: each route must be a Hono instance or an object with a 'router' property that is a Hono instance.",
					);
				}
			}
		} else {
			throw new Error(
				"Invalid route configuration: 'routes' must be a Hono instance or an array of Hono instances / objects with a 'router' property.",
			);
		}
	}
}

export namespace APIVersionRouter {
	export interface InitSettings {
		version: number;
		openAPIConfig: OpenAPIConfig;
		routes: Routable;
	}

	export type OpenAPIConfig = Partial<GenerateSpecOptions>;

	export type Routable = HonoBase | Array<{ router: HonoBase } | HonoBase>;
}
