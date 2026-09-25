# 12 — Testing

## Test runner

All tests run with `bun:test`:

```bash
bun run test   # = bun test
```

Test files are named `*.test.ts` and live in the project's root **`tests/`** directory, with
helpers in `tests/helpers/`. Every template ships at least one test so `bun test` and the `tests/`
type-check pass from day one.

| Template | Tests | Preload |
| --- | --- | --- |
| `backend-service`, `fullstack-nuxt-app` | `tests/api-routes-v1.test.ts`, `tests/email.test.ts` + `tests/helpers/{api,preload,seed,memory-transport}.ts` | `bunfig.toml` → `tests/helpers/preload.ts` |
| `nuxt-app`, `static-site`, `static-site-with-docs`, `cli-tool` | placeholder `tests/basic.test.ts` | none |

## Service test harness (`bunfig.toml` preload)

Services register the preload in `bunfig.toml`
([`shared/config/bunfig.toml`](../shared/config/bunfig.toml)):

```toml
[test]
preload = ["./tests/helpers/preload.ts"]
```

[`tests/helpers/preload.ts`](../shared/backend/tests/helpers/preload.ts) registers **module-level**
`beforeAll` / `afterAll` hooks, so they wrap the whole test run (trimmed):

```ts
let TMP_ROOT: string | null = null;

beforeAll(async () => {
	TMP_ROOT = await createIsolatedDataDir(); // fs.mkdtemp("<cwd>/tmp-data-")

	setTestEnv(TMP_ROOT); // APPPREFIX_* env vars, typed `satisfies ENVConfigLike`

	const config = await ConfigHandler.loadConfig();

	await DB.init(path.join(TMP_ROOT, "db.sqlite"), true, TMP_ROOT);

	// EmailService is NOT initialised here — tests that need it call
	// EmailService.init(mockTransport) in their own beforeAll.

	await API.init([config.APP_URL], false);

	await API.start(12500, "::");
});

afterAll(async () => {
	await API.stop();

	await DB.close();

	if (TMP_ROOT) {
		await removeDirWithRetry(TMP_ROOT);
	}
});
```

- Each run gets a fresh `tmp-data-*` directory in the project root with a real SQLite file: the
  real migrations and the initial-admin seed run, and the directory is deleted afterwards
  (`removeDirWithRetry` retries around Windows `EBUSY`). `tmp-data-*` is gitignored; a crashed run
  can leave one behind — delete it.
- `setTestEnv` points `DB_PATH`, `LOG_DIR`, and `CONFIG_BASE_DIR` into the temp directory and sets
  the rest of the config (docs enabled, SMTP pointed at `127.0.0.1:12587`).
- The backend-service preload also calls `API.start(12500, "::")`, so stop a running `bun run dev`
  on port 12500 before `bun test`. The full-stack preload does not start a server (the call is
  commented out) — tests never need one, because requests go through `API.getApp()` in-process.

## `makeAPIRequest`

[`tests/helpers/api.ts`](../shared/backend/tests/helpers/api.ts):

```ts
export async function makeAPIRequest<ReturnBody = any>(
	path: string,
	opts: {
		method?: "GET" | "POST" | "PUT" | "DELETE";
		authToken?: string;
		body?: Record<string, any>;
		expectedBodySchema?: ZodType<ReturnBody>;
		additionalOptions?: RequestInit;
	} = {},
	expectedCode?: number,
) { /* … */ }
```

- Calls `API.getApp().request(path, options)` — in-process, no network. Paths start at `/v1/…`,
  also in the full-stack template (no `/api` prefix).
- Sets `Content-Type: application/json` when `body` is given and `Authorization: Bearer <authToken>`
  when `authToken` is given; `additionalOptions.headers` are merged on top.
- Asserts the status with bun's `expect`: one of `200, 201, 202, 204` when `expectedCode` is
  omitted, otherwise exactly `expectedCode`. On a mismatch it logs the response body first.
- Returns the envelope's **`data`** (not the whole body). With `expectedBodySchema` it asserts that
  `data` parses and returns the parsed value, typed as the schema's output.
- To assert on `success` / `message`, call `API.getApp().request(...)` directly (the `/health` test
  does this).

## Seed helpers

[`tests/helpers/seed.ts`](../shared/backend/tests/helpers/seed.ts):

- `seedUser(role = "user", overrides = {}, password = "TestP@ssw0rd")` inserts a user with a random
  username/email (unless overridden) and a real `Bun.password` hash; returns the row without
  `password_hash`, plus `password`.
- `seedSession(userId)` calls `SessionHandler.createSession` and returns `{ token, user_id,
  user_role, created_at, expires_at }`.

Types: `SeededUser`, `SeededSession`.

## Backend route tests

From [`tests/api-routes-v1.test.ts`](../templates/backend-service/tests/api-routes-v1.test.ts)
(trimmed):

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import { AuthHandler } from "../src/api/utils/authHandler";
import { AuthModel } from "../src/api/versions/v1/routes/auth/model";
import { AppConstants } from "../src/utils/constants";
import { makeAPIRequest } from "./helpers/api";
import { type SeededUser, seedUser } from "./helpers/seed";

let testUser: SeededUser;

beforeAll(async () => {
	testUser = await seedUser("user", { username: "testuser" }, "UserP@ss1");
});

describe("Auth routes and access checks", async () => {
	let session_token: string;

	test("POST /v1/auth/login authenticates and creates session", async () => {
		const data = await makeAPIRequest("/v1/auth/login", {
			method: "POST",
			body: { username: testUser.username, password: testUser.password },
			expectedBodySchema: AuthModel.Login.Response,
		});

		expect(data.token.startsWith(`${AppConstants.APP_KEYS_PREFIX}_sess_`)).toBe(true);

		session_token = data.token;

		const session = await AuthHandler.getAuthContext(data.token);
		expect(session?.user_id).toBe(testUser.id);
	});

	test("GET /v1/auth/session returns current session info", async () => {
		const data = await makeAPIRequest("/v1/auth/session", {
			authToken: session_token,
			expectedBodySchema: AuthModel.Session.Response,
		});

		expect(data.user_id).toBe(testUser.id);
		expect(data.user_role).toBe("user");
	});

	test("GET /v1/admin/users as non-admin fails", async () => {
		// with auth token
		await makeAPIRequest("/v1/admin/users", { authToken: session_token }, 403);

		// without auth token
		await makeAPIRequest("/v1/admin/users", {}, 401);
	});
});
```

Guidelines:

- Validate response `data` with the route's own model (`AuthModel.Login.Response`, …) via
  `expectedBodySchema` — that is the contract coverage.
- Test the failure paths too: wrong credentials (401), wrong role (403), unknown ids (404),
  validation errors (400).
- The in-memory rate limiters (login, password reset) are module-level and persist for the whole
  run. Use a fresh `seedUser(...)` per rate-limit test, as the templates do.
- Tests share one DB per run. Don't depend on another file's rows; seed what you need.

## Email tests

[`tests/helpers/memory-transport.ts`](../templates/backend-service/tests/helpers/memory-transport.ts)
builds a nodemailer transport that pushes every mail into an array. Inject it with
`EmailService.init(transport)` and reset afterwards
([`tests/email.test.ts`](../templates/backend-service/tests/email.test.ts), trimmed):

```ts
const capturedEmails: CapturedEmail[] = [];

describe("Password reset email integration", () => {
	beforeAll(() => {
		EmailService.init(createMemoryTransport(capturedEmails));
	});

	afterAll(() => {
		EmailService.reset();
	});

	test("POST /auth/reset-password/request sends email for existing user", async () => {
		const user = await seedUser("user");
		capturedEmails.length = 0;

		await makeAPIRequest(
			"/v1/auth/reset-password/request",
			{ method: "POST", body: { email: user.email } },
			200,
		);

		expect(capturedEmails).toHaveLength(1);
		expect(capturedEmails[0]!.to).toBe(user.email);
		expect(capturedEmails[0]!.subject).toBe(`${AppConstants.APP_NAME} — Password Reset Request`);
	});
});
```

The preload never initialises `EmailService`, so other files run with email disabled; always call
`EmailService.reset()` in `afterAll`.

## Frontend tests

The Nuxt templates ship only the placeholder test and **no preload**; their
`tsconfig/tsconfig.typecheck.json` type-checks `tests/`. Plain `bun test` has no Nuxt runtime (no
auto-imports, `useState`, `useCookie`), so test framework-free code — `app/utils/*`, pure helpers —
and import it explicitly:

```ts
import { describe, expect, test } from "bun:test";
import { SimpleRouteMatcher } from "../app/utils/routeMatcher";

describe("SimpleRouteMatcher", () => {
	test("matches [param] segments", () => {
		const match = SimpleRouteMatcher.match("/dashboard/apikeys/abc", ["/dashboard/apikeys/[id]"]);

		expect(match).toEqual({ route: "/dashboard/apikeys/[id]", params: { id: "abc" } });
	});
});
```

Composables and components that need the Nuxt runtime require `@nuxt/test-utils` (not set up in the
templates). For end-to-end coverage, add Playwright if the project needs it; the guide does not
mandate it.

## CLI tests

The CLI template has no preload and ships the placeholder `tests/basic.test.ts`. Test commands by
calling their logic directly (keep it in functions/classes the command's handler calls) rather than
spawning the binary.

## Schema tests

Test that shared policies and route models accept expected shapes and reject bad data:

```ts
import { expect, test } from "bun:test";
import { UserDataPolicies } from "../src/api/utils/shared-models/accountData";

test("UserDataPolicies.Password rejects a weak password", () => {
	expect(UserDataPolicies.Password.safeParse("password").success).toBe(false);
	expect(UserDataPolicies.Password.safeParse("TestP@ssw0rd").success).toBe(true);
});
```

## CI

CI runs `bun run test` (plus `check:ci` and `typecheck`). See [13 — Git & CI](13-git-and-ci.md).

## Checklist

- [ ] Tests live in `tests/*.test.ts`; helpers in `tests/helpers/`.
- [ ] Services preload `tests/helpers/preload.ts` via `bunfig.toml` (temp `tmp-data-*` dir, real
  migrations, `API.init`; backend-service also `API.start`).
- [ ] Route tests use `makeAPIRequest(path, opts?, expectedCode?)` and assert failure codes
  explicitly.
- [ ] `expectedBodySchema` validates response `data` with the route's model.
- [ ] Rows come from `seedUser` / `seedSession`; rate-limit tests use fresh users.
- [ ] Email tests inject the memory transport and call `EmailService.reset()` afterwards.
- [ ] Frontend tests target framework-free code unless `@nuxt/test-utils` is set up.
- [ ] Schema tests cover happy and error paths.
