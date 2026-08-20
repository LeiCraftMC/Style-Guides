# 07 — State and data

## Why `useState`, not `reactive`

Nuxt apps run on the server during SSR. A static `reactive()` object or a class with static state
persists across requests and leaks data between users. Nuxt's `useState` is request-scoped on the
server and reactive on the client, so it is the only safe place for per-request global state.

The `AbstractStore` pattern wraps `useState` with fetch/refresh/clear semantics so you don't create
stores by hand each time.

## `AbstractStore`

Copy [`shared/frontend/abstractStore.ts`](../shared/frontend/abstractStore.ts) into
`app/utils/abstractStore.ts` and build concrete subclasses in `app/composables/stores/`.

Basic read-only store:

```ts
import { BasicAbstractStore } from "~/utils/abstractStore";

class UserStore extends BasicAbstractStore<UserModel.Response> {
	protected async fetchData() {
		const result = await useAPI((api) => api.getMe(), true);
		return result.success ? result.data : null;
	}
}

export function useUserStore() {
	return new UserStore("user");
}
```

Store with metadata (e.g. a loading flag):

```ts
class UsersStore extends BasicAbstractStoreWithMetadata<UserModel.Response[], { loading: boolean }> {
	constructor() {
		super("users", { defaultMetadata: { loading: false } });
	}

	protected async fetchData() {
		this.useMetadataRaw().value.loading = true;
		const result = await useAPI((api) => api.listUsers());
		this.useMetadataRaw().value.loading = false;
		return result.success ? result.data : null;
	}
}
```

Editable store:

```ts
class UserStore extends ModifiableAbstractStore<UserModel.Response, Partial<UserModel.Body>> {
	protected async fetchData() { /* … */ }
	async update(updates) {
		const result = await useAPI((api) => api.updateUser({ body: updates }));
		if (result.success) await this.refresh();
	}
}
```

Usage in a page:

```vue
<script setup lang="ts">
const store = useUserStore();
const user = await store.use();       // auto-fetch if empty when enabled
await store.refresh();                // explicit re-fetch
await store.clear();                  // clear state

const meta = await store.useMetadata();
</script>
```

## `useAPI` helpers

[`shared/frontend/useAPI.ts`](../shared/frontend/useAPI.ts) provides several wrappers:

- `useAPI(handler, disableAuthRedirect?)` — raw SDK call. On 401, redirects to `/auth/login` unless
  `disableAuthRedirect` is `true`. Catches exceptions and returns them in the envelope.
- `useAPIAsyncData(name, handler)` — wraps the handler in Nuxt's `useAsyncData`.
- `useAPILazyAsyncData(name, handler)` — wraps in `useLazyAsyncData`.
- `useAPIAsyncRequestTask(handler)` — returns an object with `.execute()` and `.loading` ref.
- `useAPILazyAsyncRequest(name, handler, immediateFNInit?)` — lazy, manually triggered
  `useLazyAsyncData` wrapper.

For most pages you want `useAPIAsyncData` or `useAPILazyAsyncData` so Nuxt handles SSR hydration:

```vue
<script setup lang="ts">
const { data: user, loading, refresh } = await useAPIAsyncData("user", async () => {
	const result = await useAPI((api) => api.getMe());
	return result.success ? result.data : null;
});
</script>
```

## Cookies

Use [`shared/frontend/useAppCookies.ts`](../shared/frontend/useAppCookies.ts) for the session cookie:

```ts
const cookies = useAppCookies();
cookies.sessionToken.set(token);
const token = cookies.sessionToken.get().value;
```

The cookie name is `<prefix>_session_token` (e.g. `dla_session_token`, `mindcode_session_token`). Keep
the prefix in sync with the backend.

## `useAwaitedComputed`

For values that depend on async reactive inputs, copy
[`shared/frontend/useAwaitedComputed.ts`](../shared/frontend/useAwaitedComputed.ts):

```ts
const userCount = await useAwaitedComputed(async () => {
	const result = await useAPI((api) => api.countUsers());
	return result.success ? result.data.total : 0;
});
```

It returns a `ComputedRef` that updates as dependencies change, awaiting the first evaluation.

## Data flow summary

```
Nuxt page
  ├─ server: useAPI() reads runtimeConfig + cookie, calls generated SDK
  ├─ client: useAPI() reads cookie, updates client, redirects on 401
  ├─ useAPIAsyncData/useAPILazyAsyncData hydrates state
  ├─ AbstractStore holds long-lived state over useState
  └─ Components read from stores / refs, never from static globals
```

## Don't do this

- ❌ Static `export const store = reactive({ user: null })` — leaks across SSR requests.
- ❌ `const result = await $fetch(...)` — bypasses auth, envelope handling, and generated types.
- ❌ Catching `useAPI` errors and throwing a generic `Error` — the envelope already carries the
  message; branch on `result.success`.

## Checklist

- [ ] Global state is stored via `useState` through `AbstractStore`.
- [ ] Stores are created by `useXxxStore()` factories, not as singleton imports.
- [ ] Server data fetching uses `useAPIAsyncData` / `useAPILazyAsyncData`.
- [ ] Client-triggered actions use `useAPIAsyncRequestTask` or plain `useAPI`.
- [ ] Session cookie name matches backend prefix.
- [ ] No static `reactive()` or class static fields for request-scoped state.
