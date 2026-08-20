# 10 — Authentication

## Model

The ecosystem uses bearer-token sessions for browser clients and optional API keys for
service-to-service calls. Both are carried in the `Authorization: Bearer <token>` header.

Auth state is represented as a discriminated union:

```ts
export type AuthContext =
	| { type: "session"; userId: number; isAdmin: boolean }
	| { type: "apiKey"; permissions: string[] }
	| { type: "unauthenticated" };
```

## `AuthHandler`

Copy [`shared/backend/auth-handler.example.ts`](../shared/backend/auth-handler.example.ts) into
your service as `src/utils/auth-handler.ts` and replace the stubs with real session / API-key
lookup.

Key responsibilities:

- Extract the bearer token from `Authorization`.
- Resolve it to an `AuthContext`.
- Provide middleware that attaches `c.set("authContext", ctx)`.
- Offer helpers like `requireSession` / `requireAdmin`.

```ts
app.use("*", async (c, next) => {
	c.set("authContext", await AuthHandler.resolveRequest(c));
	await next();
});

app.get("/admin/*", async (c, next) => {
	const ctx = c.get("authContext");
	if (ctx.type !== "session" || !ctx.isAdmin) {
		return APIResponse.forbidden(c, "Admin access required");
	}
	await next();
});
```

Use a typed app to avoid `// @ts-ignore` on `c.get("authContext")`:

```ts
type Variables = { authContext: AuthHandler.AuthContext };
const app = new Hono<{ Variables: Variables }>();
```

## Route-level security

Use `APIRouteSpec.authenticated(...)` so OpenAPI lists `bearerAuth` security for the endpoint. Use
`APIRouteSpec.unauthenticated(...)` to explicitly mark public routes.

```ts
app.get(
	"/me",
	APIRouteSpec.authenticated({
		summary: "Current user",
		tags: ["Authentication"],
		responses: APIResponseSpec.describeBasic(
			APIResponseSpec.success("Current user", UserModel.Response),
			APIResponseSpec.unauthorized(),
		),
	}),
	async (c) => {
		const ctx = c.var.authContext;
		if (ctx.type !== "session") {
			return APIResponse.unauthorized(c, "Session required");
		}
		const user = await UserService.findById(ctx.userId);
		return APIResponse.success(c, "Current user", user);
	},
);
```

## Frontend session handling

The session token is stored in a cookie named `<prefix>_session_token` (e.g. `dla_session_token`).
The frontend `useAPI` composable reads it, attaches it to the generated SDK via `updateAPIClient`,
and redirects to `/auth/login` on 401.

See [`shared/frontend/useAppCookies.ts`](../shared/frontend/useAppCookies.ts) and
[`shared/frontend/useAPI.ts`](../shared/frontend/useAPI.ts).

## Public routes

Use [`shared/frontend/routeMatcher.ts`](../shared/frontend/routeMatcher.ts) in `auth.global.ts` to
allowlist public routes:

```ts
const publicRoutes = [
	"/auth/login",
	"/auth/register",
	"/docs",
	"/dashboard/[id]/public",
];

if (SimpleRouteMatcher.match(to.path, publicRoutes)) return;
```

## API keys

For service-to-service calls, keep a hashed key table and check permissions in the route handler:

```ts
const ctx = c.var.authContext;
if (ctx.type === "unauthenticated") {
	return APIResponse.unauthorized(c, "Authentication required");
}
if (ctx.type === "apiKey" && !ctx.permissions.includes("write:users")) {
	return APIResponse.forbidden(c, "Missing write:users permission");
}
```

## Passwords

Use `Bun.password` (bcrypt/scrypt) for hashing. Never store plaintext. Distinguish test fixtures
from real hashes.

## Checklist

- [ ] `AuthContext` is a discriminated union with `type`.
- [ ] Middleware attaches `authContext` on every request.
- [ ] Typed Hono app so `c.var.authContext` is known.
- [ ] `APIRouteSpec.authenticated` / `unauthenticated` used consistently.
- [ ] Session cookie name matches backend prefix.
- [ ] `useAPI` redirects to `/auth/login` on 401.
- [ ] Public routes allowlisted with `SimpleRouteMatcher`.
- [ ] Passwords hashed with `Bun.password`.
