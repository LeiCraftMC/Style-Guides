# 07 — State and data

## Why `useState`, not `reactive`

Nuxt apps run on the server during SSR. A static `reactive()` object or a class with static state
persists across requests and leaks data between users. Nuxt's `useState` is request-scoped on the
server and reactive on the client, so it is the only safe place for per-request global state.

The `AbstractStore` pattern wraps `useState` with fetch/refresh/clear semantics so you don't create
stores by hand each time.

## `AbstractStore`

Copy [`shared/frontend/app/utils/abstractStore.ts`](../shared/frontend/app/utils/abstractStore.ts)
to `app/utils/abstractStore.ts` and build concrete stores in `app/composables/stores/` (the two
template stores are in [`shared/frontend/app/composables/stores/`](../shared/frontend/app/composables/stores/)).

| Class | Adds |
| --- | --- |
| `BasicAbstractStore<T>` | `useState<T \| null>` slot; abstract `fetchData(): Promise<T \| null>`; `use()`, `refresh()`, `refreshIfNeeded()`, `clear()`, `isValid(ref)`; protected `useRaw()` |
| `BasicAbstractStoreWithMetadata<T, MetaT>` | second slot: `useMetadata()`, protected `useMetadataRaw()`; `clear()` resets it to `defaultMetadata` |
| `ModifiableAbstractStore<T, UpdateT = T>` | abstract `update(updates: UpdateT)` |
| `ModifiableAbstractStoreWithMetadata<T, MetaT, UpdateT = T>` | abstract `update()` + `updateMetadata()` |

- The constructors are **`protected`**: a subclass declares a public constructor that calls
  `super(storeKey, options)`, and a `useXxxStore()` factory does the `new`. The store key is the
  `useState` key — keep it unique.
- `enableAutoFetchIfEmpty: true` makes `use()` call `refreshIfNeeded()` first.
- `null` means "empty": a `fetchData()` that returns `null` is retried on the next auto-fetching
  `use()`. Return `null` early when there is nothing to fetch (both template stores check the
  session cookie first).
- `use()` returns `Readonly<Ref<T | null>>`. Change state only through the store's own methods
  (subclasses write via `useRaw()`).

The template's user store,
[`useUserStore.ts`](../shared/frontend/app/composables/stores/useUserStore.ts). The file exports
`useUserInfoStore`; its `update()` only patches local state (call it after a successful
`PUT /account`) — for a purely read-only store extend `BasicAbstractStore` and drop `update()`:

```ts
import { ModifiableAbstractStore } from "~/utils/abstractStore";
import type { UserInfo } from "~/utils/types";

class UserInfoStore extends ModifiableAbstractStore<UserInfo, Partial<UserInfo>> {
	constructor() {
		super("userInfo", {
			enableAutoFetchIfEmpty: true,
		});
	}

	protected override async fetchData() {
		if (!useAppCookies().sessionToken.get().value) {
			return null;
		}

		// `true` = no auth redirect; auth.global.ts decides where to send the user.
		const response = await useAPI((api) => api.getAccount({}), true);
		if (!response.success) {
			return null;
		}

		return response.data satisfies UserInfo;
	}

	override async update(updates: Partial<UserInfo>) {
		await this.refreshIfNeeded();
		const current = this.useRaw();

		if (!current.value) {
			console.error("Cannot update user info: no user is logged in.");
			return;
		}

		current.value = { ...current.value, ...updates };
	}
}

export function useUserInfoStore() {
	return new UserInfoStore();
}
```

Store with metadata (not in the templates — a sketch against the real SDK). Note that the
`*WithMetadata` options type requires both `enableAutoFetchIfEmpty` and `defaultMetadata`:

```ts
import type { GetAdminUsersResponses } from "~/api-client";
import { BasicAbstractStoreWithMetadata } from "~/utils/abstractStore";

type AdminUser = GetAdminUsersResponses["200"]["data"][number];
type AdminUsersMeta = { fetchedAt: number | null };

class AdminUsersStore extends BasicAbstractStoreWithMetadata<AdminUser[], AdminUsersMeta> {
	constructor() {
		super("adminUsers", {
			enableAutoFetchIfEmpty: true,
			defaultMetadata: { fetchedAt: null },
		});
	}

	protected override async fetchData() {
		const response = await useAPI((api) => api.getAdminUsers({}));
		if (!response.success) {
			return null;
		}

		this.useMetadataRaw().value = { fetchedAt: Date.now() };
		return response.data;
	}
}

export function useAdminUsersStore() {
	return new AdminUsersStore();
}
```

Editable, backend-persisted store — the template's
[`useOnboardingStore.ts`](../shared/frontend/app/composables/stores/useOnboardingStore.ts), which
drives the onboarding gate in `auth.global.ts`:

```ts
import { ModifiableAbstractStore } from "~/utils/abstractStore";

export interface OnboardingData {
	completed: boolean;
}

class OnboardingStore extends ModifiableAbstractStore<OnboardingData, Partial<OnboardingData>> {
	private _completed?: ComputedRef<boolean>;

	constructor() {
		super("onboarding", {
			enableAutoFetchIfEmpty: true,
		});
	}

	protected override async fetchData() {
		if (!useAppCookies().sessionToken.get().value) {
			return null;
		}

		const response = await useAPI((api) => api.getAccountPreferencesOnboarding({}), true);
		if (!response.success) {
			return null;
		}

		return { completed: response.data.completed ?? false } satisfies OnboardingData;
	}

	/** Reactive, synchronously readable flag; `false` until the state has loaded. */
	public get completed(): ComputedRef<boolean> {
		this._completed ??= computed(() => this.useRaw().value?.completed ?? false);
		return this._completed;
	}

	/** Updates the local state and persists it to the backend. */
	override async update(updates: Partial<OnboardingData>) {
		await this.refreshIfNeeded();
		const current = this.useRaw();

		const merged: OnboardingData = {
			completed: updates.completed ?? current.value?.completed ?? false,
		};
		current.value = merged;

		const response = await useAPI((api) => api.putAccountPreferencesOnboarding({ body: merged }));
		if (!response.success) {
			throw new Error(response.message || "Failed to save onboarding state.");
		}
	}
}

export function useOnboardingStore() {
	return new OnboardingStore();
}
```

`update()` throws on failure so the caller (`pages/welcome.vue`) can toast and stay on the page.

### Using stores

Stores live in a subfolder, so they are **imported explicitly** (Nuxt auto-imports only top-level
`composables/*.ts`):

```ts
import { useUserInfoStore } from "~/composables/stores/useUserStore";

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use(); // auto-fetches when empty
if (!userInfoStore.isValid(user)) {
	throw createError({ statusCode: 401, statusMessage: "Not authenticated" });
}
// user.value is UserInfo from here on
```

- `store.isValid(await store.use())` is the one-line "signed in?" check (the guard uses it).
- `refreshIfNeeded()` fetches only when empty; `refresh()` always refetches.
- After a successful mutation, patch the store (`userInfoStore.update({ … })`) or `refresh()` it.
- **Login** refreshes the user store and clears the onboarding store so the new session gets fresh
  per-user state (`pages/auth/login.vue`):

  ```ts
  updateAPIClient(result.data.token);
  useAppCookies().sessionToken.set(result.data.token, {
  	maxAge: payload.data.remember ? 60 * 60 * 24 * 30 : undefined, // 30 days with "remember me"
  });

  await useUserInfoStore().refresh();
  await useOnboardingStore().clear();
  ```

- **Logout** clears local state regardless of the API result (`components/dashboard/UserMenu.vue`):

  ```ts
  const result = await useAPI((api) => api.postAuthLogout({}), true);

  await userInfoStore.clear();
  useAppCookies().sessionToken.set(null);
  ```

## `useAPI` helpers

[`shared/frontend/app/composables/useAPI.ts`](../shared/frontend/app/composables/useAPI.ts) is the
only way to call the generated SDK.

`useAPI(handler, disableAuthRedirect = false)`:

- **Server:** reads the session cookie, applies it with `updateAPIClient(token)`, calls the handler.
  No redirects on the server.
- **Client:** reads the cookie. Without one it resets the client and — unless
  `disableAuthRedirect` — navigates to `/auth/login?url=<current fullPath>` (the call still runs).
  If the result has `code === 401` it clears the cookie and redirects the same way (unless
  disabled).
- **Never throws:** exceptions become `{ success: false, code: 500, message, data: null }`. Branch
  on `result.success`.
- Pass `true` for calls that must not bounce the user: stores, login, forgot/reset password,
  logout.
- SDK functions take one options object — `{}` when there is nothing to send:
  `api.getAccount({})`, `api.getAccountApikeysByApiKeyId({ path: { apiKeyID } })`,
  `api.postAdminUsers({ body })`.

The other wrappers take a handler that usually calls `useAPI` itself:

| Helper | Wraps | Returns |
| --- | --- | --- |
| `useAPIAsyncData(key, handler)` | `useAsyncData` (awaited during SSR) | `{ data, loading, refresh }` |
| `useAPILazyAsyncData(key, handler)` | `useLazyAsyncData` (non-blocking) | `{ data, loading, refresh }` |
| `useAPIAsyncRequestTask(handler)` | nothing (manual) | `.execute()` + `.loading` ref |
| `useAPILazyAsyncRequest(key, handler, immediateFNInit?)` | `useLazyAsyncData({ immediate: false })` | `.fetchData()`, `.clearData()`, `.data`, `.loading` |

Give every `useAsyncData` key a resource-specific name (`account-apikey-${id}`, not `"data"`).

## Data-loading patterns

**List page** — keep the returned object whole, return a fallback on failure
([`apikeys/index.vue`](../templates/nuxt-app/app/pages/dashboard/apikeys/index.vue)):

```ts
const apiKeys = await useAPIAsyncData<APIKey[]>("account-apikeys", async () => {
	const res = await useAPI((api) => api.getAccountApikeys({}));
	if (!res.success) {
		toast.add({ title: "Failed to load API keys", description: res.message, color: "error" });
		return [];
	}
	return res.data;
});
```

```vue
<DashboardDataTable
	:data="apiKeys.data"
	:loading="apiKeys.loading"
	@refresh="apiKeys.refresh()"
/>
```

Refs nested in an object are not unwrapped in templates — that is why `DashboardDataTable` accepts
`T[] | Ref<T[]>` and `boolean | Ref<boolean>`. After a mutation, `await apiKeys.refresh()`.

**Detail page** — store the full envelope so the page can turn a failure into an error
([`apikeys/[api_key_id].vue`](../templates/nuxt-app/app/pages/dashboard/apikeys/[api_key_id].vue)):

```ts
let error: NuxtError | null = null; // import type { NuxtError } from "#app";

const {
	data: result,
	refresh,
	loading,
} = await useAPIAsyncData(
	`account-apikey-${apiKeyId}`,
	async () =>
		await useAPI((api) => api.getAccountApikeysByApiKeyId({ path: { apiKeyID: apiKeyId } })),
);

if (!result.value?.success) {
	error = createError({
		statusCode: result.value?.code || 500,
		statusMessage: result.value?.message || "Failed to load API key",
	});
}
```

**Secondary data** — `useAPILazyAsyncData` so it doesn't block navigation
([`dashboard/index.vue`](../templates/nuxt-app/app/pages/dashboard/index.vue)):

```ts
const { data: apiKeys, loading: loadingApiKeys } = await useAPILazyAsyncData(
	"dashboard-apikeys",
	async () => {
		const res = await useAPI((api) => api.getAccountApikeys({}));
		return res.success ? res.data : [];
	},
);
```

**Mutations** — plain `useAPI` in the handler, a local `loading` ref, a toast, then refresh or
patch state ([`settings/index.vue`](../templates/nuxt-app/app/pages/dashboard/settings/index.vue),
trimmed):

```ts
async function onSubmit(event: FormSubmitEvent<ProfileSchema>) {
	loading.value = true;
	const result = await useAPI((api) =>
		api.putAccount({
			body: {
				display_name: event.data.display_name,
				current_password: event.data.current_password,
			},
		}),
	);
	loading.value = false;

	if (result.success) {
		await userInfoStore.update({ display_name: event.data.display_name });
		toast.add({ title: "Profile updated", icon: "i-lucide-check", color: "success" });
	} else {
		toast.add({
			title: "Error",
			description: result.message || "An error occurred while updating your profile.",
			icon: "i-lucide-alert-circle",
			color: "error",
		});
	}
}
```

Delete handlers passed to `DashboardDeleteModal` **throw** on failure to keep the modal open (see
[15](15-design-system.md#modals)).

## Cookies

Use [`useAppCookies`](../shared/frontend/app/composables/useAppCookies.ts) for the session cookie:

```ts
const cookies = useAppCookies();
const token = cookies.sessionToken.get().value; // get() returns the useCookie ref

cookies.sessionToken.set(result.data.token, { maxAge: 60 * 60 * 24 * 30 }); // merged with defaults
cookies.sessionToken.set(null); // sign out
```

Defaults: `path: "/"`, `secure: true`, `sameSite: "lax"`, `httpOnly: false` (the client must read
the token to feed `updateAPIClient`). The cookie name is `<PREFIX>_session_token` (e.g.
`dla_session_token`, `mindcode_session_token`) — replace `<PREFIX>` and keep it in sync with the
backend's token prefix. See [10](10-auth.md#frontend-session-handling).

## `useAwaitedComputed`

[`useAwaitedComputed`](../shared/frontend/app/composables/useAwaitedComputed.ts) is an async
`computed()`: it awaits the first evaluation, then returns a `ComputedRef` that re-runs when its
reactive dependencies change. The templates use it for route-dependent breadcrumbs and SEO:

```ts
const routePathDynamicValues = await useAwaitedComputed(async () => {
	const values = await subrouterPathDynamics.getPathDynamicValues(route.path);
	useSeoMeta(values.seoSettings);
	return values;
});
```

## Nested routes: parent → child data

A parent page (`pages/dashboard/apikeys/[api_key_id].vue`) renders the shared chrome (header,
breadcrumbs, toolbar) and `<NuxtPage />`; child pages live in the same-named folder
(`[api_key_id]/index.vue`, later `[api_key_id]/<tab>.vue`). Two composables connect them.

### `useSubrouterInjectedData`

[`useSubrouterInjectedData`](../shared/frontend/app/composables/useSubrouterInjectedData.ts) loads
data once in the parent and hands it to every child via Vue `provide`/`inject` under a string key.
The value is the `{ data, loading, refresh }` shape of `useAPIAsyncData`. With `includeNew = true`
it also supports a "create" route: the union gets an `isNew` discriminant, and `/new` provides a
draft of type `NewT` (`loading`/`refresh` are filled with no-op defaults).

Parent:

```ts
const apiKeyId = safeDecodeURIComponent(route.params.api_key_id as string);

if (apiKeyId === "new") {
	useSubrouterInjectedData<APIKey, NewAPIKey>("api_key", true).provide({
		data: ref<NewAPIKey>({ description: "", expires_at: "30d" }),
		isNew: true,
	});
} else {
	const {
		data: result,
		refresh,
		loading,
	} = await useAPIAsyncData(
		`account-apikey-${apiKeyId}`,
		async () =>
			await useAPI((api) => api.getAccountApikeysByApiKeyId({ path: { apiKeyID: apiKeyId } })),
	);

	useSubrouterInjectedData<APIKey, NewAPIKey>("api_key", true).provide({
		data: computed(() => (result.value?.success ? result.value.data : null) as APIKey),
		refresh,
		loading,
		isNew: false,
	});
}
```

Child:

```ts
const apiKey = useSubrouterInjectedData<APIKey, NewAPIKey>("api_key", true).inject();

const formState = ref<NewAPIKey>(
	apiKey.isNew
		? { ...apiKey.data.value } // NewAPIKey
		: { description: apiKey.data.value.description, expires_at: null }, // APIKey
);
```

Without a create route, drop `includeNew`: `useSubrouterInjectedData<T>(key).provide({ data,
loading, refresh })` / `.inject()`.

### `useSubrouterPathDynamics`

[`useSubrouterPathDynamics`](../shared/frontend/app/composables/useSubrouterPathDynamics.ts) maps
each child path to a toolbar link and to per-route breadcrumbs + SEO. Route keys may use `[param]`
segments (matched with `SimpleRouteMatcher`; params are passed to `getDynamicValues`), and `routes`
may be a `Ref` for reactive configs.

```ts
import type { UseSubrouterPathDynamics } from "~/composables/useSubrouterPathDynamics";

function getRoutesConfig(): UseSubrouterPathDynamics.RoutesConfig {
	return {
		[`/dashboard/apikeys/${apiKeyId}`]: {
			isNavLink: true, // include in .links
			label: "General",
			icon: "i-lucide-info",
			exact: true,
			getDynamicValues() {
				return {
					seoSettings: {
						title: `API Key ${apiKeyId}`,
						description: `Manage API key ${apiKeyId}`,
					},
					breadcrumbItems: [{ label: apiKeyId }],
				};
			},
		},
	};
}

const subrouterPathDynamics = useSubrouterPathDynamics({
	baseTitle: "API Keys | ProjectName",
	basebreadcrumbItems: [{ label: "API Keys", to: "/dashboard/apikeys" }],
	routes: getRoutesConfig(),
});
```

`getPathDynamicValues(route.path)` returns the base + route breadcrumbs and `seoSettings` with the
title `"<title> | <baseTitle>"` (combine with `useAwaitedComputed`, above). `.links` is a
`NavigationMenuItem[][]` for the toolbar:

```vue
<DashboardPageHeader icon="i-lucide-key" :breadcrumb-items="routePathDynamicValues.breadcrumbItems" />

<UDashboardToolbar>
	<UNavigationMenu :items="subrouterPathDynamics.links" highlight class="-mx-1 flex-1" />
</UDashboardToolbar>
```

Adding a sub-page = a file in the child folder + an entry in `getRoutesConfig()`.

## `utils/types.ts`

Never hand-write API types. Derive them from the generated types in
[`app/utils/types.ts`](../templates/nuxt-app/app/utils/types.ts):

```ts
import type {
	GetAccountApikeysResponses,
	GetAccountResponses,
	PostAccountApikeysData,
} from "~/api-client";

export namespace UtilityTypes {
	export type SomePartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;
}

export type UserInfo = GetAccountResponses["200"]["data"];

export type APIKey = GetAccountApikeysResponses["200"]["data"][number];
export type NewAPIKey = NonNullable<PostAccountApikeysData["body"]>;
```

Types used by one page can stay local (`admin/users.vue` declares
`type AdminUser = GetAdminUsersResponses["200"]["data"][number]`). In the standalone template `scripts/patch-api-client.ts` widens the SDK
functions' return types to `any`, so `useAPI` results are untyped there — annotate them with these
aliases (`useAPIAsyncData<APIKey[]>(…)`, `satisfies UserInfo`).

## Forms and generated Zod schemas

`~/api-client/zod.gen` exports a schema per request part: `z<Operation>Body`, `…Path`, `…Query`,
`…Response` (`zPostAdminUsersBody`, `zPostAccountApikeysBody`, `zGetAdminUsersQuery`, …). Use them
as the `UForm` schema when the form maps 1:1 to the request body
([`admin/users.vue`](../templates/nuxt-app/app/pages/dashboard/admin/users.vue)):

```ts
import type { FormSubmitEvent } from "@nuxt/ui";
import type { z } from "zod";
import { zPostAdminUsersBody } from "~/api-client/zod.gen";

// Referenced here (not only in the template) so Biome keeps it a value import.
const createSchema = zPostAdminUsersBody;
type CreateSchema = z.output<typeof createSchema>;

const createForm = reactive<CreateSchema>({
	username: "",
	display_name: "",
	email: "",
	password: "",
	role: "user",
});

async function handleCreate(event: FormSubmitEvent<CreateSchema>) {
	const res = await useAPI((api) => api.postAdminUsers({ body: event.data }));
	// …
}
```

```vue
<UForm :schema="createSchema" :state="createForm" @submit="handleCreate">
```

- The `const createSchema = …` line is required: a schema used only in the template would be turned
  into `import type` by Biome (see [06](06-frontend-nuxt.md#biome-and-vue-files)).
- Write a local `z.object(...)` when the form differs from the body (confirm-password fields,
  friendlier messages) and use `:validate` for cross-field rules (see
  [15](15-design-system.md#forms)).
- Component-local form state in `reactive()`/`ref()` is fine — the "no static `reactive()`" rule is
  about shared state.
- [`useDefaultOnFormError()`](../templates/nuxt-app/app/composables/useDefaultOnFormError.ts)
  returns an `@error` handler that focuses and scrolls to the first invalid field:
  `const onError = await useDefaultOnFormError();` → `<UForm @error="onError">`.

## Data flow summary

```
Nuxt page
  ├─ server: useAPI() applies the cookie token, calls the generated SDK
  ├─ client: useAPI() applies the cookie token, redirects on missing cookie / 401
  ├─ useAPIAsyncData / useAPILazyAsyncData hydrate page data (SSR → client)
  ├─ AbstractStore (useState) holds long-lived state: user info, onboarding flag
  ├─ parent routes provide data to children via useSubrouterInjectedData
  └─ components read from stores / refs, never from static globals
```

## Don't do this

- ❌ Static `export const store = reactive({ user: null })` — leaks across SSR requests.
- ❌ `const result = await $fetch(...)` — bypasses auth, envelope handling, and generated types.
- ❌ Catching `useAPI` errors and throwing a generic `Error` — the envelope already carries the
  message; branch on `result.success`. (Throwing *on purpose* from a delete handler to keep
  `DashboardDeleteModal` open is fine.)
- ❌ Calling `useUserInfoStore()` without importing it — stores in `composables/stores/` are not
  auto-imported.
- ❌ Hand-written interfaces for API payloads — derive them from `~/api-client` types.

## Checklist

- [ ] Global state is stored via `useState` through `AbstractStore`.
- [ ] Stores are classes with a public constructor calling `super(key, options)`, created by
      `useXxxStore()` factories and imported explicitly from `~/composables/stores/`.
- [ ] Store `fetchData()` returns `null` early without a session and uses `useAPI(…, true)`.
- [ ] Login refreshes the user store and clears the onboarding store; logout clears the user store
      and the cookie.
- [ ] Server data fetching uses `useAPIAsyncData` / `useAPILazyAsyncData` with unique keys.
- [ ] Client-triggered actions use plain `useAPI` (or `useAPIAsyncRequestTask`) + a toast.
- [ ] Nested routes share data via `useSubrouterInjectedData` and breadcrumbs/SEO/toolbar via
      `useSubrouterPathDynamics`.
- [ ] API types come from `utils/types.ts` / generated types; form schemas from `zod.gen` where
      they match the body, referenced as a value in `<script>`.
- [ ] Session cookie name matches the backend prefix.
- [ ] No static `reactive()` or class static fields for request-scoped state.
