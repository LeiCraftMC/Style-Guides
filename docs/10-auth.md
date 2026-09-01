# 10 — Authentication

## Model

The ecosystem uses **opaque random bearer tokens** — not JWTs. Browser clients get session tokens;
service-to-service callers get API keys. Both travel in `Authorization: Bearer <token>`. The token
is a random hex string that indexes a DB row; the row stores only a **hash** of the token's secret
half. Nothing in the token is meaningful to a client, and nothing signed is trusted — the server
always re-resolves the token against the DB on every request.

There are two token kinds, dispatched by prefix:

| Kind | Prefix | Lifetime | Example |
| --- | --- | --- | --- |
| Session | `<prefix>_sess_` | 7 days (deleted on access once expired) | `dla_sess_<id>:<base>` |
| API key | `<prefix>_apikey_` | optional / no expiry | `lra_apikey_<id>:<base>` |

The full token is `<prefix><id>:<base>`:

- `id` — 32 random bytes hex; indexes the `sessions` / `api_keys` row so the lookup is O(1).
- `base` — 32 random bytes hex; stored **hashed via `Bun.password.hash`** (`Bun.password`'s default
  algorithm). Never persist `base` plaintext. The full token is returned to the client **once**, at
  creation; the client (browser cookie or service secret store) keeps it.

> The OpenAPI `securitySchemes.bearerAuth` is `type: http, scheme: bearer` — **do not set
> `bearerFormat: "JWT"`**. The tokens are opaque; advertising JWT misleads consumers.

Auth state is a discriminated union carrying the resolved DB row:

```ts
export type AuthContext =
	| { type: "session"; userId: number; role: UserAccountSettings.Roles; /* + row fields */ }
	| { type: "apiKey"; keyId: number; permissions: string[]; /* + row fields */ }
	| { type: "unauthenticated" };
```

## `AuthHandler`

Copy [`shared/backend/auth-handler.example.ts`](../shared/backend/auth-handler.example.ts) into your
service as `src/utils/auth-handler.ts` and replace the DB-lookup stubs with real queries. It is split
into static classes — `AuthHandler` (dispatch + context), `SessionHandler`, `APIKeyHandler`,
`AuthUtils` (token parse / random / hash) — matching the house static-class style.

Responsibilities:

- Parse `Authorization: Bearer <token>`, split `<prefix><id>:<base>`, dispatch by prefix.
- Look up the row by `id`, verify `base` with `Bun.password.verify(base, row.hashed_base)`.
- For sessions: delete the row if `expires_at` has passed, else return the context.
- Provide `authMiddlewareV1` (a `createMiddleware`) that attaches `c.set("authContext", ctx)`.
- Provide `requireSession(c)` / `requireAdmin(c)` helpers that return a 401/403 response or the
  narrowed context.

The middleware allow-lists the unauthenticated auth endpoints (`/v1/auth/login`,
`/v1/auth/reset-password`) — for those, a missing/invalid token sets `{ type: "unauthenticated" }`
and **continues** so the handler can run; for every other path it returns
`APIResponse.unauthorized`:

```ts
export const authMiddlewareV1 = createMiddleware(async (c, next) => {
	const ctx = await AuthHandler.resolveRequest(c); // { type: "unauthenticated" } if no/invalid token
	c.set("authContext", ctx);
	if (ctx.type === "unauthenticated" && !PUBLIC_AUTH_PATHS.has(c.req.path)) {
		return APIResponse.unauthorized(c, "Missing or invalid Authorization header");
	}
	await next();
});
```

Use a typed app so `c.get("authContext")` is known (no `// @ts-ignore`):

```ts
type Variables = { authContext: AuthHandler.AuthContext };
const app = new Hono<{ Variables: Variables }>();
```

## Login hardening

The login route does three things the guide mandates:

1. **Timing-safe dummy-hash verify.** Always run a `Bun.password.verify` against a precomputed
   `DUMMY_HASH` when the username is not found, so a missing user takes the same time as a wrong
   password. This prevents username enumeration via timing.
2. **In-memory rate limiter.** Track attempts per-IP-per-username and globally-per-username in a
   `Map`; above the threshold return `APIResponse.tooManyRequests` with a `Retry-After` header. Use
   an `unref`'d interval to clean the map. (Production-scale services may move this to Redis.)
3. **Session creation.** On success, generate the token, persist `hashed_base` + `expires_at`
   (now + 7 days), and return the full token once via `APIResponse.success`.

```ts
const result = await AuthHandler.login(body.username, body.password);
if (!result) return APIResponse.unauthorized(c, "Invalid username or password");
return APIResponse.success(c, "Login successful", { token: result.token, ...result.session });
```

## Authorization

Two tiers exist in the ecosystem — pick the one your domain needs:

**Simple role enum** (Delivr, Status-Page, MindCode): a `UserAccountSettings.Roles` string enum
(`["user", "admin"]` or `["member", "admin"]`) co-located in shared-models and stored on the
`users`/`sessions`/`api_keys` row. Check it in the handler:

```ts
const ctx = c.var.authContext;
if (ctx.type !== "session") return APIResponse.unauthorized(c, "Session required");
if (ctx.role !== "admin") return APIResponse.forbidden(c, "Admin access required");
```

**Full RBAC** (API-Server): a `PermissionHelper` static class with an `OrgRoles` enum
(`admin / maintainer / developer / viewer`), a `RolePermissions` matrix per resource, and
`can({ authContext, publisherId, packageId?, check })`. Effective role = publisher membership, with
per-package role-assignment overrides via `maxRole`. Site-admin short-circuits to true. **RBAC
checks live inside handlers, not in middleware** — `PermissionHelper.can(...)` returns a boolean the
handler turns into `APIResponse.forbidden`:

```ts
if (!PermissionHelper.can({ authContext, publisherId, check: "releases:publish" })) {
	return APIResponse.forbidden(c, "You may not publish releases for this publisher");
}
```

## Route-level security

Use `APIRouteSpec.authenticated(...)` so OpenAPI lists `bearerAuth` for the endpoint;
`APIRouteSpec.unauthenticated(...)` marks public routes.

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
		if (ctx.type !== "session") return APIResponse.unauthorized(c, "Session required");
		const user = await UserService.findById(ctx.userId);
		return APIResponse.success(c, "Current user", user);
	},
);
```

## Frontend session handling

The session token is stored in a cookie named `<prefix>_session_token` (e.g. `dla_session_token`,
`leioshub_session_token`), managed through
[`shared/frontend/useAppCookies.ts`](../shared/frontend/useAppCookies.ts). Set it on login with
these attributes — `httpOnly: false` because the client must read it to feed `updateAPIClient`:

```ts
const cookie = useAppCookies().sessionToken;
cookie.set(token, {
	path: "/",
	secure: true,
	sameSite: "lax",
	httpOnly: false,
	maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // 30 days only when "remember me"
});
```

`useAPI` reads the cookie, attaches it via `updateAPIClient`, and **redirects to
`/auth/login?url=...` on any `code === 401`** (clearing the cookie first). Use the simple any-401
rule — an older message-matching approach (`/Invalid or expired token|Missing or invalid
Authorization header/`) drifted out of sync with backend messages and silently stopped firing.

See [`shared/frontend/useAPI.ts`](../shared/frontend/useAPI.ts).

## Public routes

Use [`shared/frontend/routeMatcher.ts`](../shared/frontend/routeMatcher.ts) in `auth.global.ts` to
allowlist public routes. Read the cookie through `useAppCookies()` consistently — don't drop to raw
`useCookie("<prefix>_session_token")` in one place and the abstraction in another:

```ts
const publicRoutes = ["/auth/login", "/auth/register", "/docs", "/dashboard/[id]/public"];
if (SimpleRouteMatcher.match(to.path, publicRoutes)) return;
```

## API keys

API keys use the same `<prefix>_apikey_<id>:<base>` shape and the same hashed-base storage. They may
carry no expiry. Check `permissions` in the route handler (string scopes like `write:users`):

```ts
const ctx = c.var.authContext;
if (ctx.type === "unauthenticated") return APIResponse.unauthorized(c, "Authentication required");
if (ctx.type === "apiKey" && !ctx.permissions.includes("write:users")) {
	return APIResponse.forbidden(c, "Missing write:users permission");
}
```

A gateway-style service may instead scope keys by model: an `allowedModels` or `denyModels` list
(mutually exclusive) checked per-route. See the compatibility-proxy note in
[04 — Backend architecture](04-backend-hono.md#compatibility-proxy-backend).

## Password reset

Beyond the initial-admin seed (see [08 — Database](08-database.md)), the reset flow is: `POST
/v1/auth/reset-password/request` issues a token, stores its **SHA-256 hash** in `password_resets`
with an expiry, and emails a `{APP_URL}/auth/reset-password?token=...` link. `POST
/v1/auth/reset-password` verifies the hash, updates `password_hash`, and deletes the reset row. Never
store reset tokens plaintext.

## Passwords

Hash with `Bun.password.hash` / verify with `Bun.password.verify` (Bun's default algorithm). Never
store plaintext. Distinguish test fixtures (a known hash) from real hashes.

## Checklist

- [ ] Tokens are opaque `<prefix>_<kind>_<id>:<base>`; `base` stored only as a `Bun.password` hash.
- [ ] `bearerFormat: "JWT"` is **not** set in the OpenAPI securityScheme.
- [ ] `AuthContext` is a discriminated union with `type`; session/apiKey carry the row.
- [ ] `authMiddlewareV1` attaches `authContext`; allow-lists `login` + `reset-password`.
- [ ] Login uses a timing-safe dummy-hash verify + an in-memory rate limiter.
- [ ] Sessions expire after 7 days and are deleted on access once expired.
- [ ] Typed Hono app so `c.var.authContext` is known.
- [ ] `APIRouteSpec.authenticated` / `unauthenticated` used consistently.
- [ ] Authorization (role enum or `PermissionHelper.can`) checked inside handlers.
- [ ] Session cookie via `useAppCookies()`: `secure; sameSite=lax; httpOnly:false; maxAge` on remember.
- [ ] `useAPI` redirects on any `code === 401`.
- [ ] Public routes allowlisted with `SimpleRouteMatcher`.
- [ ] Password reset tokens stored SHA-256-hashed with expiry.
- [ ] Passwords hashed with `Bun.password`.