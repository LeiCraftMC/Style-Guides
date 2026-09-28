# 10 — Authentication

The reference implementation is the backend-service template's
[`authHandler.ts`](../templates/backend-service/src/api/utils/authHandler.ts),
[`middleware/auth.ts`](../templates/backend-service/src/api/versions/v1/middleware/auth.ts) and the
`auth` / `account` / `admin` routes, plus the Nuxt templates' `app/` for the frontend half
(`nuxt-app` and `fullstack-nuxt-app` share it). The handler and middleware are mirrored in
[`shared/backend/`](../shared/backend/src/api/utils/authHandler.ts); they need the template's DB
schema and `LCrypt`.

## Model

The ecosystem uses **opaque random bearer tokens** — not JWTs. Browser clients get session tokens;
scripts and integrations get API keys. Both travel in `Authorization: Bearer <token>`. The token
indexes a DB row that stores only a **hash** of the token's secret half. Nothing in the token is
meaningful to a client, and nothing signed is trusted — the server re-resolves the token against the
DB on every request.

There are two token kinds, dispatched by prefix (`AppConstants.APP_KEYS_PREFIX`, placeholder
`appprefix`):

| Kind | Prefix | Table | Lifetime |
| --- | --- | --- | --- |
| Session | `appprefix_sess_` | `sessions` | 7 days; an expired session is deleted when it is next presented |
| API key | `appprefix_apikey_` | `api_keys` | 7 / 30 / 90 / 180 / 365 days or never; an expired key is rejected (the row stays until deleted) |

The full token is `<prefix><id>:<base>`:

- `id` — 32 random bytes as hex; the row's primary key, so the lookup is O(1).
- `base` — 32 random bytes as hex; stored only as `hashed_token = Bun.password.hash(base)` (Bun's
  default, argon2id). The full token is returned to the client **once**, at creation.

The OpenAPI `securitySchemes.bearerAuth` is `type: "http", scheme: "bearer"` (plus a description) —
**no `bearerFormat: "JWT"`**; see [04 — OpenAPI setup](04-backend-hono.md#openapi-setup).

Auth state is a discriminated union whose authenticated members carry the full DB row:

```ts
export namespace AuthHandler {
	export type AuthenticatedAuthContext = SessionAuthContext | ApiKeyAuthContext;
	export type AuthContext = AuthenticatedAuthContext | UnauthenticatedAuthContext;

	export interface SessionAuthContext extends DB.Models.Session {
		readonly type: "session";
	}

	export interface ApiKeyAuthContext extends DB.Models.ApiKey {
		readonly type: "apiKey";
	}

	export interface UnauthenticatedAuthContext {
		readonly type: "unauthenticated";
	}
}
```

So a handler reads `ctx.user_id`, `ctx.user_role`, `ctx.expires_at`, and (API keys)
`ctx.description` straight from the context. There are no permission scopes.

## `authHandler.ts`

`src/api/utils/authHandler.ts` is split into static classes, matching the house style. Every
method that touches the DB takes an optional trailing `tx: DrizzleDB = DB.instance()`, so it can
run inside a caller's transaction.

| Class | Methods |
| --- | --- |
| `AuthUtils` | `getUserRole(userID)`, `createRandomTokenID()`, `createBaseToken()`, `getFullToken(prefix, id, base)`, `getTokenParts(fullToken)` (→ `{ prefix, id, base }` or `null`), `hashTokenBase(base)`, `verifyHashedTokenBase(base, hash)` |
| `SessionHandler` | `SESSION_TOKEN_PREFIX`, `createSession(userID)` (→ `{ token, user_id, user_role, created_at, expires_at }`), `getSession(tokenParts)`, `isValidSession(session)` (deletes it if expired), `inValidateSession(tokenID)`, `inValidateAllSessionsForUser(userID)`, `changeUserRoleInSessions(userID, role)` |
| `APIKeyHandler` | `API_KEY_PREFIX`, `createApiKey(userID, description, expiresInDays?)`, `getApiKey(tokenParts)`, `isValidApiKey(key)`, `deleteApiKey(id)`, `deleteAllApiKeysForUser(userID)`, `changeUserRoleInApiKeys(userID, role)` |
| `AuthHandler` | `getTokenType(token)`, `getAuthContext(fullToken)`, `isValidAuthContext(ctx)`, `invalidateAuthContext(ctx)`, `invalidateAllAuthContextsForUser(userID)` (sessions **and** API keys), `changeUserRoleInAuthContexts(userID, role)` |
| `AuthHandler.AuthContext` | `get(c)`, `getAsSession(c)`, `getAsApiKey(c)`, `set(c, ctx)` — the only way routes touch `c.get("authContext")` |

The DB column is `hashed_token` on both `sessions` and `api_keys`.

## Middleware and guards

`authMiddlewareV1` runs on every `/v1` request. It **resolves** the context; it does not decide
access, except for rejecting bad credentials:

```ts
// Endpoints that stay reachable with a malformed, invalid or expired token (login, signup,
// password reset), so a stale session cookie can never lock a user out of signing in again.
const PUBLIC_AUTH_PATHS = ["/v1/auth/login", "/v1/auth/signup", "/v1/auth/reset-password"];

// `c.req.path` is the full request path. Compare from `/v1/` on, so this also works when the
// API is mounted under a prefix (the full-stack template serves it at `/api/v1/...`).
function isPublicAuthPath(fullPath: string) {
	const path = fullPath.slice(Math.max(fullPath.indexOf("/v1/"), 0));
	return PUBLIC_AUTH_PATHS.some((publicPath) => path.startsWith(publicPath));
}

export const authMiddlewareV1 = createMiddleware(async (c, next) => {
	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		AuthHandler.AuthContext.set(c, {
			type: "unauthenticated",
		} satisfies AuthHandler.UnauthenticatedAuthContext);

		return await next();
	}

	if (!authHeader.startsWith("Bearer ")) {
		if (isPublicAuthPath(c.req.path)) {
			AuthHandler.AuthContext.set(c, { type: "unauthenticated" });
			return await next();
		}

		return APIResponse.unauthorized(c, "Invalid Authorization header");
	}

	const token = authHeader.substring("Bearer ".length);

	const authContext = await AuthHandler.getAuthContext(token);

	if (!authContext || !(await AuthHandler.isValidAuthContext(authContext))) {
		if (isPublicAuthPath(c.req.path)) {
			AuthHandler.AuthContext.set(c, { type: "unauthenticated" });
			return await next();
		}

		return APIResponse.unauthorized(c, "Invalid or expired token");
	}

	AuthHandler.AuthContext.set(c, authContext);

	return await next();
});
```

- No header → `unauthenticated`, continue. A bad header or token → 401, except on the public auth
  paths (prefix match, so `/v1/auth/reset-password/request` is included).
- `/v1/auth/signup` is pre-listed for when a project adds registration; the template has no signup
  route.

**Access is enforced by router guards and handlers:**

| Where | Rule | Failure |
| --- | --- | --- |
| `account` router (`router.use("*", …)`) — includes `apikeys/` and `preferences/` | `type === "session"` | 401 `"Your Auth Context is not a session"` |
| `admin` router guard | authenticated **and** `user_role === "admin"` (sessions or API keys) | 401 `"Authentication required"` / 403 `"This endpoint is restricted to administrators"` |
| `GET /auth/session`, `POST /auth/logout` | `type === "session"` (in the handler) | 401 |
| `POST /auth/login` | `type === "unauthenticated"` | 403 `"You are already authenticated"` |
| `POST /auth/reset-password`, `POST /auth/reset-password/request` | `type === "unauthenticated"` | 401 `"You are already authenticated"` |

There are no `requireSession` / `requireAdmin` helpers — write a guard on the router (see
[04 — Authentication middleware](04-backend-hono.md#authentication-middleware)) or check
`AuthHandler.AuthContext.get(c).type` in the handler.

## Login hardening

`POST /v1/auth/login` ([`routes/auth/index.ts`](../templates/backend-service/src/api/versions/v1/routes/auth/index.ts))
takes `{ username, password }` and does four things:

1. **Rejects authenticated callers** with 403.
2. **In-memory rate limiting.** Two `Map`s count attempts in a 5-minute window: at most **5 per
   client + username** (`LOGIN_MAX_ATTEMPTS`) and **15 per username** across clients
   (`LOGIN_MAX_GLOBAL_ATTEMPTS`). Counters are incremented *before* checking (no TOCTOU race) and
   cleared on a successful login. Over the limit → 429 with `Retry-After: 300` (the window, in
   seconds). An `unref`'d interval purges expired entries.
3. **Timing-safe failure.** For an unknown username it verifies against `DUMMY_PASSWORD_HASH`
   (a real `Bun.password` hash computed at module load), so a missing user costs the same time as a
   wrong password; both return 401 `"Invalid username or password"`.
4. **Session creation** in a transaction:

   ```ts
   const session = await DB.instance().transaction(async (tx: DrizzleDB) => {
   	return await SessionHandler.createSession(user.id, tx);
   });

   return APIResponse.success(c, "Login successful", session satisfies AuthModel.Login.Response);
   ```

   `data` is `{ token, user_id, user_role, created_at, expires_at }` (the token is shown only here).

> **Known limitation:** the client id comes from `c.req.raw.remoteAddr?.hostname`, which Bun's
> `Request` does not provide, so every client falls into one `"unknown"` bucket — in practice the
> limit is 5 failed attempts per username per window, from anywhere. Use `getConnInfo(c)` from
> `hono/bun` (or a header set by your trusted proxy) if you need a real per-client bucket. The
> counters live in process memory; multi-instance deployments need a shared store.

## Authorization

Roles are a simple enum: `UserAccountSettings.Roles = ["admin", "user"]` (type
`UserAccountSettings.Role`) in `shared-models/accountData.ts`, stored on `users.role` and **cached**
as `user_role` on every session and API-key row, so checks never join `users`:

```ts
const authContext = AuthHandler.AuthContext.get(c);
if (authContext.type === "unauthenticated") {
	return APIResponse.unauthorized(c, "Authentication required");
}
if (authContext.user_role !== "admin") {
	return APIResponse.forbidden(c, "This endpoint is restricted to administrators");
}
```

When an admin changes a user's role (`PUT /v1/admin/users/:userId`), the route calls
`AuthHandler.changeUserRoleInAuthContexts(userId, role)` to update the cached copies. Do the same
anywhere you change `users.role`.

Services that need more than two roles use **full RBAC** (API-Server's pattern, not in the
templates): a `PermissionHelper` static class with an `OrgRoles` enum
(`admin / maintainer / developer / viewer`), a per-resource permission matrix, and a
`can({ authContext, … })` check that returns a boolean the handler turns into
`APIResponse.forbidden`. RBAC checks live inside handlers, not in middleware.

## Route-level security

Use `APIRouteSpec.authenticated(...)` so OpenAPI lists `bearerAuth` for the endpoint and
`APIRouteSpec.unauthenticated(...)` for public routes. There is no `/me` endpoint:
`GET /v1/auth/session` returns the current session and `GET /v1/account` the user's profile
(without `password_hash`).

```ts
router.get(
	"/session",

	APIRouteSpec.authenticated({
		summary: "Get Current Session",
		description: "Retrieve the current user's session information",
		tags: [DOCS_TAGS.AUTHENTICATION],

		responses: APIResponseSpec.describeBasic(
			APIResponseSpec.success("Session info retrieved successfully", AuthModel.Session.Response),
			APIResponseSpec.unauthorized(
				"Unauthorized: Invalid or missing session token / Your Auth Context is not a session",
			),
		),
	}),

	async (c) => {
		const authContext = AuthHandler.AuthContext.get(c);
		if (authContext.type !== "session") {
			return APIResponse.unauthorized(c, "Your Auth Context is not a session");
		}

		return APIResponse.success(c, "Session info retrieved successfully", {
			user_id: authContext.user_id,
			user_role: authContext.user_role,
			created_at: authContext.created_at,
			expires_at: authContext.expires_at,
		} satisfies AuthModel.Session.Response);
	},
);
```

Account endpoints (all session-only):

| Endpoint | Notes |
| --- | --- |
| `GET /v1/account` | Profile without `password_hash`. |
| `PUT /v1/account` | Partial profile update (`username`, `display_name`, `email`); requires `current_password`; 409 on a taken username/email. `role` is not part of the body — only admins change roles. |
| `PUT /v1/account/password` | `{ current_password, new_password }`; invalidates **all sessions** of the user (API keys survive). |
| `DELETE /v1/account` | In one transaction: all sessions **and** API keys, reset tokens, preferences, then the user. |

## API keys

API keys use the same `<prefix><id>:<base>` shape and hashed-base storage as sessions.

| Endpoint (session-only) | Body / result |
| --- | --- |
| `GET /v1/account/apikeys` | `[{ id, description, created_at, expires_at }]` |
| `POST /v1/account/apikeys` | body `{ description: string (1–255), expires_at: "7d" \| "30d" \| "90d" \| "180d" \| "365d" \| null }` → **200** `{ id, token }` — the only time the token is returned |
| `GET /v1/account/apikeys/:apiKeyID` | `{ id, description, created_at, expires_at }`; 404 for someone else's key |
| `DELETE /v1/account/apikeys/:apiKeyID` | deletes the key |

- **No scopes.** A key acts as its user, with the role cached at creation (updated by
  `changeUserRoleInAuthContexts`).
- Keys are managed with a session and **used** everywhere the guards allow an API key: in the
  template that is the admin routes (for admin users) and whatever routes you add. The account and
  session routes are session-only.
- Expired keys get a 401 `"Invalid or expired token"`; they are not deleted automatically.

A gateway-style service may instead scope keys by model: an `allowedModels` or `denyModels` list
(mutually exclusive) checked per-route. See the compatibility-proxy note in
[04 — Backend architecture](04-backend-hono.md#compatibility-proxy-backend).

## Password reset

[`routes/auth/reset-password/index.ts`](../templates/backend-service/src/api/versions/v1/routes/auth/reset-password/index.ts)
has two unauthenticated endpoints (authenticated callers get 401):

**`POST /v1/auth/reset-password/request`** — body `{ email }`.

- Always answers 200 `"If the username exists, a password reset has been requested"` — no account
  enumeration.
- Rate limit: 1 request per email per 15 minutes; a limited request gets the same 200 and does
  nothing.
- For a known email, in one transaction: delete the user's existing reset rows, then insert
  `hashResetToken(token)` with a **1-hour** expiry, where `token = randomBytes(64)` as hex and
  `hashResetToken` is `LCrypt.sha256(token).toHex()` — **SHA3-256**.
- Emails `{APP_URL}/auth/reset-password?token=<token>` **only if `EmailService.isEnabled()`**
  (fire-and-forget; failures are logged). Without SMTP no mail is sent.

**`POST /v1/auth/reset-password`** — body `{ reset_token, new_password }` (`new_password` must pass
`UserDataPolicies.Password`).

- At most 3 attempts per token per 15 minutes. Unknown, expired, or rate-limited tokens → 400
  `"Invalid reset token"`.
- On success, in one transaction: set the new `password_hash`, invalidate **all sessions and API
  keys** of the user (`AuthHandler.invalidateAllAuthContextsForUser`), and delete all of the
  user's reset rows.

The initial-admin seed writes a reset token to the same table with the same hash (see
[08 — Database](08-database.md#initial-admin-user)). Never store reset tokens in plaintext.

## Passwords and hashing

| Secret | Hash | Why |
| --- | --- | --- |
| Passwords | `Bun.password.hash` / `Bun.password.verify` (argon2id) | slow, salted |
| Session / API-key `base` | `Bun.password.hash` / `verify` (argon2id) | same; the row is found by `id` |
| Reset tokens | SHA3-256 via `LCrypt.sha256(token).toHex()` | deterministic, so the row can be looked up by hash; tokens are 64 random bytes and short-lived |

The server-side password policy is `UserDataPolicies.Password`: 8–50 characters with an upper-case
letter, a lower-case letter, a digit, and a special character. It applies to reset, change
password, and admin set-password; the admin create-user route only requires 8–128 characters, and
the frontend forms validate 8–128 — the server policy decides. Never store plaintext; test fixtures
hash a known password (`seedUser`).

## Frontend session handling

The session token lives in a cookie named `<prefix>_session_token` (e.g. `dla_session_token`),
accessed only through [`useAppCookies()`](../shared/frontend/app/composables/useAppCookies.ts) —
never raw `useCookie("<prefix>_session_token")`. Its defaults (`SESSION_COOKIE_OPTIONS`) are
`path: "/"`, `secure: true`, `sameSite: "lax"`, `httpOnly: false` — the client must read the token
to hand it to `updateAPIClient`.

**Login** ([`pages/auth/login.vue`](../templates/nuxt-app/app/pages/auth/login.vue), trimmed):

```ts
// Only follow internal redirects (`/…`, not `//evil.example`); default to the dashboard.
const requestedUrl = route.query.url?.toString() ?? "";
const redirectUrl =
	requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/dashboard";

async function onSubmit(payload: FormSubmitEvent<Schema>) {
	const result = await useAPI(
		(api) =>
			api.postAuthLogin({
				body: { username: payload.data.username, password: payload.data.password },
			}),
		true,
	);

	if (!result.success) {
		// 401 → "Invalid Username or Password" toast; anything else → result.message
		return;
	}

	updateAPIClient(result.data.token);
	useAppCookies().sessionToken.set(result.data.token, {
		maxAge: payload.data.remember ? 60 * 60 * 24 * 30 : undefined, // 30 days only with "remember me"
	});

	// Fresh per-user state for the new session.
	await useUserInfoStore().refresh();
	await useOnboardingStore().clear();

	await navigateTo(redirectUrl);
}
```

- `useAPI(..., true)` disables the auth redirect, so a wrong password shows a toast instead of
  bouncing to the login page.
- Without "remember me" the cookie is a browser-session cookie; with it, 30 days. The server session
  always expires after 7 days — the 401 handling below cleans up the stale cookie.

**`useAPI` redirect rules** (client side, unless `disableAuthRedirect`): no cookie → navigate to
`/auth/login?url=<current path>`; any result with `code === 401` → clear the client token and the
cookie, then redirect the same way. The rule is deliberately "any 401", not message matching. See
[05 — API contract](05-api-contract.md#updateapiclient-and-useapi).

**Logout** ([`components/dashboard/UserMenu.vue`](../templates/nuxt-app/app/components/dashboard/UserMenu.vue)):

```ts
async function logout() {
	const result = await useAPI((api) => api.postAuthLogout({}), true);

	// Clear local state regardless of the API result.
	await userInfoStore.clear();
	useAppCookies().sessionToken.set(null);

	// toast: "logged out" (or a warning if the server call failed)

	await navigateTo("/auth/login");
}
```

**Server-ended sessions.** After a successful password change the backend has already invalidated
every session, and after an account deletion the user is gone, so
[`pages/dashboard/settings/security.vue`](../templates/nuxt-app/app/pages/dashboard/settings/security.vue)
drops the local session too:

```ts
/** Drop the local session after the server invalidated it. */
async function endSession(redirectTo: string) {
	await useUserInfoStore().clear();
	useAppCookies().sessionToken.set(null);
	await navigateTo(redirectTo);
}
```

(`endSession("/auth/login")` after a password change, `endSession("/")` after deleting the account.)

The forgot-password and reset-password pages call `postAuthResetPasswordRequest` /
`postAuthResetPassword` with `useAPI(..., true)`; the reset page reads the token from
`?token=…`. The signup page is **UI only** — it shows a "coming soon" toast until you add a backend
registration route.

## Route guard (`auth.global.ts`)

[`app/middleware/auth.global.ts`](../shared/frontend/app/middleware/auth.global.ts) is prefix-based.
Tune the constants per project:

```ts
const HOME_ROUTE = "/dashboard";
const PROTECTED_PREFIXES = ["/dashboard"];
const ADMIN_PREFIXES = ["/dashboard/admin"];
const PUBLIC_ROUTES: string[] = [];
const ONBOARDING_ROUTE = "/welcome";
const REQUIRE_ONBOARDING = true;
```

- `/auth/**` is for signed-out users: with a valid session → `HOME_ROUTE`; with an invalid or
  expired cookie → the cookie is cleared and the page is shown.
- `PROTECTED_PREFIXES` and `ONBOARDING_ROUTE` need a valid session (checked by loading
  `useUserInfoStore()`, i.e. `GET /v1/account`); otherwise the cookie is cleared and the user goes
  to `/auth/login?url=<target>`.
- `PUBLIC_ROUTES` are exceptions inside a protected prefix, matched with `SimpleRouteMatcher`
  (`[param]` segments supported).
- **Onboarding gate:** with `REQUIRE_ONBOARDING`, a signed-in user whose
  `GET /v1/account/preferences/onboarding` says `completed: false` is sent to `/welcome` before any
  other protected page; `/welcome` marks it complete (finish or skip).
- **Admin gate:** `ADMIN_PREFIXES` additionally need `role === "admin"`, otherwise → `HOME_ROUTE`.
  The UI hides admin navigation for non-admins too, but the backend admin guard is the real check.
- Everything else (landing page, marketing pages) is public. For a login-only app use
  `PROTECTED_PREFIXES = ["/"]` and `HOME_ROUTE = "/"`.

## Checklist

- [ ] Tokens are opaque `<prefix>_<sess|apikey>_<id>:<base>`; `base` stored only as a
  `Bun.password` hash in `hashed_token`.
- [ ] `bearerFormat: "JWT"` is **not** set in the OpenAPI security scheme.
- [ ] `AuthContext` is the `session` / `apiKey` / `unauthenticated` union; read it via
  `AuthHandler.AuthContext.*`.
- [ ] `authMiddlewareV1` resolves the context; bad tokens get 401 except on the public auth paths.
- [ ] Access enforced by router guards (account: session-only; admin: `user_role === "admin"`).
- [ ] Login: authenticated callers 403, rate limit (5 per client + user, 15 per user, 5 min,
  `Retry-After`), dummy-hash verify, session created in a transaction.
- [ ] Sessions expire after 7 days (deleted on access); expired API keys rejected.
- [ ] Role changes update the cached `user_role` (`changeUserRoleInAuthContexts`).
- [ ] API keys: no scopes, token returned once, managed from a session.
- [ ] Password reset: enumeration-safe, rate-limited, 64 random bytes, SHA3-256 hash, 1-hour
  expiry, consuming it invalidates sessions **and** API keys; email only when SMTP is configured.
- [ ] `APIRouteSpec.authenticated` / `unauthenticated` used consistently.
- [ ] Session cookie only via `useAppCookies()`; `maxAge` only with "remember me".
- [ ] `useAPI` redirects on a missing cookie or any `code === 401`; login redirects only to
  internal `url`s.
- [ ] Logout, password change, and account deletion clear the store and the cookie.
- [ ] Route guard constants (`PROTECTED_PREFIXES`, `ADMIN_PREFIXES`, `PUBLIC_ROUTES`, onboarding)
  tuned per project.
