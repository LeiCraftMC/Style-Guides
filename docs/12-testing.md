# 12 — Testing

## Test runner

All tests run with `bun:test`:

```bash
bun test
```

Test files are named `*.test.ts`. Integration tests live next to the routes they cover or in a
`tests/` directory.

## Backend route tests

Use the in-process Hono helper [`shared/backend/make-api-request.ts`](../shared/backend/make-api-request.ts):

```ts
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { API } from "../src/api";
import { DB } from "../src/db";
import { ConfigHandler } from "../src/utils/config";
import { makeAPIRequest } from "./helpers/make-api-request";
import { z } from "zod";

describe("Auth routes", () => {
	beforeAll(async () => {
		await ConfigHandler.loadConfig();
		DB.init(":memory:", true);
		await API.init(0); // port 0 = random port; tests call app.request directly
	});

	afterAll(async () => {
		await API.stop();
		DB.close();
	});

	test("POST /v1/auth/login succeeds", async () => {
		const { body, data } = await makeAPIRequest(API.app, "/v1/auth/login", {
			method: "POST",
			body: { username: "admin", password: "admin" },
			expectedBodySchema: z.object({ token: z.string() }),
		});

		expect(body.success).toBe(true);
		expect(body.code).toBe(200);
		expect(data.token).toBeTruthy();
	});
});
```

The helper asserts the HTTP status is in `[200, 201, 202, 204]` (or the expected code), parses the
body, and — when `expectedBodySchema` is provided — validates the `data` field with Zod.

## Test harness (`preload.ts`)

For suites that need a booted app, add a `tests/helpers/preload.ts`:

```ts
import { API } from "../../src/api";
import { ConfigHandler } from "../../src/utils/config";
import { DB } from "../../src/db";

export async function setup() {
	await ConfigHandler.loadConfig();
	DB.init(":memory:", true);
	await API.init(0);
}

export async function teardown() {
	await API.stop();
	DB.close();
}
```

Import it in each test file or register it as a global fixture via `bunfig.toml`:

```toml
[test]
preload = ["./tests/helpers/preload.ts"]
```

## Frontend tests

Nuxt frontend logic is tested with `bun:test` plus `happy-dom` or `@nuxt/test-utils` for component
mounting when needed. Prefer testing composables and stores directly over full page renders:

```ts
import { describe, expect, test } from "bun:test";

describe("useAwaitedComputed", () => {
	test("awaits the first value", async () => {
		const c = await useAwaitedComputed(async () => 42);
		expect(c.value).toBe(42);
	});
});
```

For end-to-end coverage, add Playwright separately if the project needs it. The guide does not
mandate Playwright; it is project-specific.

## Schema tests

Test that your Zod schemas and Drizzle select schemas accept expected shapes and reject bad data:

```ts
test("UserModel.Body rejects invalid email", () => {
	const result = UserModel.Body.safeParse({ email: "not-an-email", name: "Ada" });
	expect(result.success).toBe(false);
});
```

## Fixtures

Keep seed utilities in `tests/helpers/fixtures.ts`:

```ts
export async function createUser(overrides = {}) {
	return DB.instance().insert(users).values({
		email: "test@example.com",
		name: "Test User",
		...overrides,
	}).returning();
}
```

## CI

Tests run in `bun test` in CI. See [13 — Git & CI](13-git-and-ci.md).

## Checklist

- [ ] Backend tests boot real `API` + `DB` and use `makeAPIRequest`.
- [ ] `beforeAll`/`afterAll` set up and tear down the harness cleanly.
- [ ] `expectedBodySchema` validates response `data` for contract coverage.
- [ ] Frontend tests target composables/stores first.
- [ ] Schema tests cover happy and error paths.
- [ ] Fixtures are reusable and isolated per test.
