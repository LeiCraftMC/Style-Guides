# 05 — API contract

Every LeiCraftMC service speaks the same envelope. The backend emits it, the OpenAPI spec describes
it, and the generated client consumes it.

## The envelope

```json
{
  "success": true,
  "code": 200,
  "message": "Login successful",
  "data": {
    "token": "appprefix_sess_<id>:<base>",
    "user_id": 1,
    "user_role": "user",
    "created_at": 1790000000000,
    "expires_at": 1790604800000
  }
}
```

Errors use a shape **without `data`** — the field is omitted, not `null`:

```json
{
  "success": false,
  "code": 404,
  "message": "User not found"
}
```

Rules:

- `code` is the HTTP status code and always matches the response status. `message` is a
  human-readable English string.
- `data` is typed per endpoint on success (`data: null` for the `*NoData` helpers and `/health`);
  **on error it is omitted**. The `APIResponse.*` error helpers, the global `onError` handler, and
  the full-stack catch-all's 503 (`"API is starting, please retry shortly"`) all return
  `{ success, code, message }` only.
- **One exception:** schema-validation failures from `zValidator` return 400 with
  `@hono/standard-validator`'s own body `{ success: false, error: [...], data: <input> }`, not the
  envelope (malformed JSON does return the envelope). See
  [04 — Error handling](04-backend-hono.md#error-handling).
- On the frontend, `useAPI` turns thrown exceptions into `{ success: false, code: 500, message,
  data: null }`, so client code can always branch on `result.success` and read `result.data`.

## `APIResponse` helpers

Backend routes never build the envelope by hand. Use the static helpers from
[`shared/backend/src/api/utils/api-res.ts`](../shared/backend/src/api/utils/api-res.ts):

```ts
return APIResponse.success(c, "Login successful", session);
return APIResponse.created(c, "User created successfully", sanitizeUser(createdUser));
return APIResponse.successNoData(c, "Logout successful");
return APIResponse.unauthorized(c, "Invalid username or password");
return APIResponse.conflict(c, "Email already in use");
```

Available helpers map to HTTP codes: `success` 200, `created` 201, `accepted` 202, `badRequest` 400,
`unauthorized` 401, `forbidden` 403, `notFound` 404, `conflict` 409, `tooManyRequests` 429,
`serverError` 500. `successNoData` / `createdNoData` send `data: null`. `data` must be an object or
an array (`APIResponse.Types.RequiredReturnData`).

## `APIResponse.Schema.*` factories

`hono-openapi` needs a Zod schema for each documented response. The factories in
`APIResponse.Schema.*` mirror the runtime helpers exactly, and the `APIResponseSpec` builders wrap
them. From the admin users router:

```ts
APIRouteSpec.authenticated({
	summary: "Create user",
	description: "Provision a new user account with the desired role.",
	tags: [DOCS_TAGS.ADMIN_API.USERS],

	responses: APIResponseSpec.describeWithWrongInputs(
		APIResponseSpec.created("User created successfully", AdminUsersModel.Create.Response),
		APIResponseSpec.conflict("Conflict: Username or email already exists"),
	),
}),
```

Under the hood `APIResponseSpec.created(...)` produces:

```ts
{
	201: {
		description: "User created successfully",
		content: {
			"application/json": {
				schema: resolver(
					APIResponse.Schema.created("User created successfully", AdminUsersModel.Create.Response),
				),
			},
		},
	},
}
```

`resolver` (from `hono-openapi`) converts the Zod schema into an OpenAPI schema object; always go
through it (the builders do) rather than passing raw Zod schemas to `describeRoute`.

The description doubles as the schema's `message` **literal** (`z.literal(message)`). For success
responses, pass the same string to the spec and to the runtime helper (`"User created
successfully"` in both places) so the generated types are exact. Error descriptions are often more
generic than the runtime message — client code branches on `code`, never on error message text.

## Documenting responses

Use the builders from
[`shared/backend/src/api/utils/specHelpers.ts`](../shared/backend/src/api/utils/specHelpers.ts):

- `APIResponseSpec.success(description, dataSchema)` / `created(...)` / `accepted(...)`
- `APIResponseSpec.successNoData(description)` / `createdNoData(description)`
- `APIResponseSpec.badRequest(...)` / `unauthorized(...)` / `forbidden(...)` / `notFound(...)` /
  `conflict(...)` / `tooManyRequests(...)` / `serverError(...)` — each has a default message
- `APIRouteSpec.authenticated(spec)` (adds `bearerAuth` security), `unauthenticated(spec)`
  (`security: []`), `custom(spec)`; `APIRouteSpec.basic` and `APIResponseSpec.genericError` are
  deprecated.

Combine with `describeBasic` (just the listed responses) or `describeWithWrongInputs` (listed
responses + `badRequest("Bad Request: Syntax or validation error in request")`). Routes with a body,
query, or path params use `describeWithWrongInputs`; routes without input use `describeBasic`:

```ts
responses: APIResponseSpec.describeBasic(
	APIResponseSpec.successNoData("Logout successful"),
	APIResponseSpec.unauthorized(
		"Unauthorized: Invalid or missing session token / Your Auth Context is not a session",
	),
),
```

`describeWithWrongInputs` merges its generic 400 **last**, so it replaces a `badRequest(...)` you
pass yourself. For a route that also returns a domain-specific 400, use `describeBasic(...)` with an
explicit `APIResponseSpec.badRequest("…")`.

## Generating the frontend client

The frontend never hand-writes API client types. It generates them from the backend's OpenAPI JSON
with `@hey-api/openapi-ts`, configured in `openapi-ts.config.ts` at the project root. Both Nuxt
templates use the same plugins (plain strings) and output folder, with two different generation
flows ([17 — Decisions](17-decisions.md#15-one-api-client-plugin-set-two-generation-flows)):

```ts
plugins: ["@hey-api/client-nuxt", "@hey-api/typescript", "@hey-api/sdk", "zod"],
```

> **Known issue (temporary divergence):** `client-nuxt`'s generated code currently fails
> `vue-tsc` under Windows/Bun (both LAVIAC and login-ui hit it on fresh installs). While it's
> unfixed, projects can switch the plugin to `"@hey-api/client-fetch"` — `useAPI` then unwraps the
> `{ data, error }` result to the envelope, as in those repos — and migrate back once the upstream
> type errors are fixed. The templates stay on `client-nuxt` as the standard.

Output in `app/api-client/`: `client.gen.ts` (the `client` instance), `sdk.gen.ts` (one function per
operation, e.g. `getAccount`, `postAuthLogin`, `getAdminUsersByUserId`), `types.gen.ts`
(`*Data` / `*Responses` / `*Errors` types), `zod.gen.ts` (Zod schemas), `index.ts`, and the runtime
folders `client/` and `core/`. The generated files are committed — they are the source of truth for
type-checking the app — and never edited by hand. Biome ignores them (`!**/api-client`,
`!**/*.gen.ts`).

### Standalone frontend (`nuxt-app`)

The spec comes from the running backend over HTTP:

```ts
// openapi-ts.config.ts
export default defineConfig({
	input: "http://localhost:12500/docs/v1/openapi",
	output: "app/api-client",
	plugins: ["@hey-api/client-nuxt", "@hey-api/typescript", "@hey-api/sdk", "zod"],
});
```

```json
"api-client:generate": "openapi-ts"
```

- Start the backend first, with docs enabled (`APPPREFIX_API_DISABLE_DOCS` empty/unset).
- Hand-editing generated files is forbidden; regenerate with `bun run api-client:generate`.

### Full-stack (`fullstack-nuxt-app`)

The spec is produced **in-process** — no server needs to be running:

```json
"api-client:generate": "bun scripts/api-client-generate.ts"
```

[`scripts/api-client-generate.ts`](../shared/frontend/scripts/api-client-generate.ts) imports the
`API` class, calls `API.init([], false)`, requests `/docs/v1/openapi` from `API.getApp()`, writes
the JSON to `./data/temp-api-openapi.json`, runs `bunx openapi-ts` (whose config has
`input: "./data/temp-api-openapi.json"`), and deletes the temp file.

## `updateAPIClient` and `useAPI`

`updateAPIClient(token)` points the generated `client` at the API and attaches
`Authorization: Bearer <token>` (or no header for `null`). It always sets
`ignoreResponseError: true`, so non-2xx responses return the envelope instead of throwing.

| Template | File | `baseURL` |
| --- | --- | --- |
| `nuxt-app` | [`updateAPIClient.ts`](../shared/frontend/app/composables/updateAPIClient.ts) | `<apiUrl>/v1` — `runtimeConfig.public.apiUrl` (from `APPPREFIX_API_URL`; default `http://localhost:12500`) |
| `fullstack-nuxt-app` | [`updateAPIClient.fullstack.ts`](../shared/frontend/app/composables/updateAPIClient.fullstack.ts) (copy as `updateAPIClient.ts`) | `<appUrl>/api/v1` — `runtimeConfig.public.appUrl` (from `APPPREFIX_APP_URL`; the Nitro banner maps it to `NUXT_PUBLIC_APP_URL` at server start) |

[`useAPI(handler, disableAuthRedirect = false)`](../shared/frontend/app/composables/useAPI.ts) is
the single gateway for calling the generated SDK:

- **Server (SSR):** applies the session cookie's token (or none) and calls the SDK. It does not wrap
  anything in `useAsyncData` — do that yourself with `useAPIAsyncData` (see below).
- **Client:** applies the cookie's token; with no cookie it navigates to
  `/auth/login?url=<current path>` (unless `disableAuthRedirect`) and still makes the call. If the
  result has `code === 401` it clears the client token and the cookie and redirects the same way
  (again unless `disableAuthRedirect`).
- **Never throws:** exceptions become `{ success: false, code: 500, message, data: null }`.

A page calls it like this (from `pages/dashboard/apikeys/[api_key_id].vue`, trimmed):

```vue
<script setup lang="ts">
const route = useRoute();
const apiKeyId = safeDecodeURIComponent(route.params.api_key_id as string);

const { data: result } = await useAPIAsyncData(
	`account-apikey-${apiKeyId}`,
	async () =>
		await useAPI((api) => api.getAccountApikeysByApiKeyId({ path: { apiKeyID: apiKeyId } })),
);

if (!result.value?.success) {
	// result.value?.code, result.value?.message
}
</script>
```

Use `useAPIAsyncData` / `useAPILazyAsyncData` for SSR-hydrated page data and
`useAPIAsyncRequestTask` / `useAPILazyAsyncRequest` for button-triggered calls. Pass `true` as the
second argument where the page handles 401 itself (login form, stores that probe the session). See
[07 — State & data](07-state-and-data.md).

## Route models

Each route folder has a `model.ts` exporting Zod 4 schemas and their inferred types, **one
namespace per operation** (`AdminUsersModel.GetAll.Query`, `AdminUsersModel.Create.Body`,
`AuthModel.Login.Body`, `AuthModel.Login.Response`). From
[`routes/admin/users/model.ts`](../templates/backend-service/src/api/versions/v1/routes/admin/users/model.ts)
(trimmed):

```ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";
import { DB } from "../../../../../../db";
import {
	UserAccountSettings,
	UserDataPolicies,
} from "../../../../../utils/shared-models/accountData";

export namespace AdminUsersModel {
	const BaseUser = createSelectSchema(DB.Tables.users);

	export const SafeUser = BaseUser.omit({ password_hash: true });
	export type SafeUser = z.infer<typeof SafeUser>;
}

export namespace AdminUsersModel.GetAll {
	export const Query = z.object({
		role: UserAccountSettings.Role.optional(),
		search: z.string().min(1).max(64).optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		offset: z.coerce.number().int().min(0).optional(),
	});
	export type Query = z.infer<typeof Query>;

	export const Response = z.array(SafeUser);
	export type Response = z.infer<typeof Response>;
}

export namespace AdminUsersModel.Create {
	const InsertSchema = createInsertSchema(DB.Tables.users, {
		username: UserDataPolicies.Username,
		display_name: z.string().min(1).max(64),
		email: z.email(),
	}).omit({
		id: true,
		password_hash: true,
		created_at: true,
	});

	export const Body = InsertSchema.extend({
		password: z.string().min(8).max(128),
	});
	export type Body = z.infer<typeof Body>;

	export const Response = SafeUser;
	export type Response = z.infer<typeof Response>;
}

export namespace AdminUsersModel.UserId {
	export const Params = z.object({
		userId: z.coerce.number().int().positive(),
	});
	export type Params = z.infer<typeof Params>;
}
```

- Zod 4 API: `z.email()`, not `z.string().email()`.
- Path and query values arrive as strings: use `z.coerce.number().int().positive()` for numeric ids.
- Derive response schemas from the table (`createSelectSchema`) and `.omit(...)` secrets such as
  `password_hash` and `hashed_token`. The `Response` schema is what appears inside `data`; pass it
  to `APIResponseSpec.success(...)` so the generated client types are accurate.
- Reuse the shared policies (`UserDataPolicies.*`, `UserAccountSettings.Role`) instead of repeating
  regexes and enums.

## Versioning

Add a new `APIVersionRouter` subclass for a new major version. Keep v1 running while v2 is being
developed. Do not break v1 paths until you are ready to deprecate and communicate the change.

## Checklist

- [ ] Every route response uses `APIResponse.*` helpers.
- [ ] The OpenAPI spec matches the runtime envelope (`APIResponseSpec.*` builders over
  `APIResponse.Schema.*`); success descriptions equal the runtime messages.
- [ ] Error responses set `success: false` and **omit `data`**.
- [ ] Frontend client is generated (`bun run api-client:generate`) into `app/api-client/`, committed,
  and never hand-edited.
- [ ] `openapi-ts.config.ts` uses the plugins `@hey-api/client-nuxt`, `@hey-api/typescript`,
  `@hey-api/sdk`, `zod`.
- [ ] `updateAPIClient` sets `ignoreResponseError: true` and the right `baseURL` for the shape.
- [ ] Route models export one namespace per operation with `Body` / `Query` / `Params` /
  `Response` schemas and paired `z.infer` types.
