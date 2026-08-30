# 05 — API contract

Every LeiCraftMC service speaks the same envelope. The backend emits it, the OpenAPI spec describes
it, and the generated client consumes it.

## The envelope

```json
{
  "success": true,
  "code": 200,
  "message": "User created",
  "data": { "id": 1, "name": "Ada" }
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

The `code` is the HTTP status code. It always matches the HTTP response status. `message` is a
human-readable English string. `data` is typed per endpoint on success (including `data: null` for
the `*NoData` helpers); **on error it is omitted**. The `APIResponse.*` error helpers reflect this —
they return `{ success, code, message }` only. The frontend `useAPI` catch synthesizes `data: null`
on thrown exceptions, so client code can always read `result.data` safely.

## `APIResponse` helpers

Backend routes never build the envelope by hand. Use the static helpers from
[`shared/backend/api-response.ts`](../shared/backend/api-response.ts):

```ts
return APIResponse.success(c, "Login successful", result);
return APIResponse.createdNoData(c, "Domain registered");
return APIResponse.unauthorized(c, "Invalid credentials");
return APIResponse.conflict(c, "Email already in use");
```

Available helpers map to HTTP codes: `success` 200, `created` 201, `accepted` 202, `badRequest` 400,
`unauthorized` 401, `forbidden` 403, `notFound` 404, `conflict` 409, `tooManyRequests` 429,
`serverError` 500. `successNoData` / `createdNoData` send `data: null`.

## `APIResponse.Schema.*` factories

`hono-openapi` needs a Zod schema for each documented response. The factories in
`APIResponse.Schema.*` mirror the runtime helpers exactly:

```ts
APIRouteSpec.unauthenticated({
  summary: "Create user",
  tags: ["Users"],
  responses: APIResponseSpec.describeWithWrongInputs(
    APIResponseSpec.created("User created", UserModel.Response),
    APIResponseSpec.conflict("Email already in use"),
  ),
}),
```

Under the hood this produces an OpenAPI `responses` entry whose schema is `resolver(...)` wrapped:

```ts
{
  201: {
    description: "User created",
    content: {
      "application/json": {
        schema: resolver(APIResponse.Schema.created("User created", UserModel.Response)),
      },
    },
  },
}
```

The `resolver` function from `hono-openapi` converts the Zod schema into an OpenAPI-compatible
schema object. Always use it; do not pass raw Zod schemas to `describeRoute`.

## Documenting responses

Use the `APIResponseSpec` builders from
[`shared/backend/spec-helpers.ts`](../shared/backend/spec-helpers.ts):

- `APIResponseSpec.success(description, dataSchema)`
- `APIResponseSpec.created(description, dataSchema)`
- `APIResponseSpec.accepted(description, dataSchema)`
- `APIResponseSpec.successNoData(description)` / `createdNoData(...)`
- `APIResponseSpec.badRequest(...)` / `unauthorized(...)` / `forbidden(...)` / `notFound(...)` /
  `conflict(...)` / `tooManyRequests(...)` / `serverError(...)`

Combine with `describeBasic` (just the listed responses) or `describeWithWrongInputs` (listed
responses + a 400 Bad Request). Routes with a body or query params should use
`describeWithWrongInputs`; pure GETs without params can use `describeBasic`.

```ts
responses: APIResponseSpec.describeBasic(
  APIResponseSpec.successNoData("Logout successful"),
)
```

## Generating the frontend client

The frontend never hand-writes API client types. It generates them from the backend's OpenAPI JSON.

1. The backend serves the spec at `/docs/v1/openapi`.
2. Save it to `app/api-client/openapi.json` using `@hey-api/openapi-ts`.
3. Generate `app/api-client/{client.gen,sdk.gen,types.gen}.ts` into `app/api-client/`.

> **Full-stack Nuxt shape:** the spec is at `/api/docs/v1/openapi` (Hono is mounted at `/api`), and
> `updateAPIClient` sets `baseURL` to `<appUrl>/api/v1` on the same origin. Point `openapi-ts` at
> `http://localhost:<port>/api/docs/v1/openapi` during generation. See
> [04 — Mounting Hono in Nitro](04-backend-hono.md#mounting-hono-in-nitro).

Typical `package.json` scripts in a Nuxt app:

```json
{
  "scripts": {
    "dev": "nuxt dev --port <PORT>",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "api-client:generate": "openapi-ts && bun scripts/patch-api-client.ts"
  }
}
```

Example `openapi-ts.config.ts` (project root) using the Nuxt client + SDK + Zod plugins:

```ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: "http://localhost:<PORT>/docs/v1/openapi", // separate backend, or /api/docs/v1/openapi for full-stack
	output: "app/api-client",
	plugins: [
		"@hey-api/client-nuxt", // baseURL + Authorization via client.setConfig
		"@hey-api/typescript",
		{ name: "@hey-api/sdk", asClass: false },
		"zod",
	],
});
```

> Drop the `&& bun scripts/patch-api-client.ts` suffix if you don't need to patch — see the
> `patch-api-client.ts` exception below.

The generated files are committed (they are build output, but they are also the source of truth for
type-checking the app). Never edit them by hand. Add `app/api-client/*.gen.ts` to `.gitattributes`
with `linguist-generated=true` if you want cleaner diffs.

> **`patch-api-client.ts` exception.** `@hey-api/openapi-ts` occasionally emits typing bugs. An
> **automated, idempotent post-generation script** (`scripts/patch-api-client.ts`, run as
> `api-client:generate: openapi-ts && bun scripts/patch-api-client.ts`) may regex-patch
> `*.gen.ts` — Hub-Website, Status-Page, and MindCode all do this. Hand-editing generated files
> remains forbidden; the patch script is part of the generation pipeline, regenerated from scratch
> every run.

## `updateAPIClient` and `useAPI`

[`shared/frontend/updateAPIClient.ts`](../shared/frontend/updateAPIClient.ts) sets the generated
client's `baseURL` and bearer token. It sets `ignoreResponseError: true` so non-2xx responses return
the envelope instead of throwing.

[`shared/frontend/useAPI.ts`](../shared/frontend/useAPI.ts) is the single gateway for calling the
generated SDK. It:

- On the server, wraps the call in `useAsyncData` semantics where needed; otherwise uses the
  runtime config + session cookie directly.
- On the client, reads the session cookie, applies it via `updateAPIClient`, redirects to
  `/auth/login` on 401, and catches exceptions into the envelope.

A page calls it like this:

```vue
<script setup lang="ts">
import { getUser } from "@/api-client/sdk.gen";

const route = useRoute();
const result = await useAPI((api) => api.getUser({ path: { userId: route.params.userId } }));

if (!result.success) {
	// result.code, result.message, result.data
}
</script>
```

For reactive server-side data use `useAPIAsyncData` or `useAPILazyAsyncData`. For explicit button
triggers use `useAPIAsyncRequestTask` / `useAPILazyAsyncRequest`. See
[07 — State & data](07-state-and-data.md).

## Route models

Each route folder has a `model.ts` exporting Zod schemas and inferred types in a namespace:

```ts
import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";

export namespace UserModel {
	export const Params = z.object({ userId: z.string() });
	export type Params = z.infer<typeof Params>;

	export const Body = z.object({
		email: z.string().email(),
		name: z.string().min(1),
	});
	export type Body = z.infer<typeof Body>;

	export const Response = createSelectSchema(DB.Tables.users).omit({ passwordHash: true });
	export type Response = z.infer<typeof Response>;
}
```

The `Response` schema is what appears inside `data` in the envelope. Pass it to
`APIResponseSpec.success(...)` so the generated client types are accurate.

## Versioning

Add a new `APIVersionRouter` subclass for a new major version. Keep v1 running while v2 is being
developed. Do not break v1 paths until you are ready to deprecate and communicate the change.

## Checklist

- [ ] Every route response uses `APIResponse.*` helpers (or the OpenAPI-equivalent schema).
- [ ] The OpenAPI spec matches the runtime envelope (use `APIResponse.Schema.*` factories).
- [ ] Error responses set `success: false` and **omit `data`** (the `APIResponse.*` error helpers do this).
- [ ] Frontend client is generated from `openapi.json` and never hand-edited.
- [ ] `updateAPIClient` sets `ignoreResponseError: true`.
- [ ] Route models expose `Body`, `Query`, `Params`, `Response` namespaces with `z.infer` types.
