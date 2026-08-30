# 06 — Frontend architecture (Nuxt)

## Nuxt 4 `app/` directory

All Nuxt apps are on **Nuxt 4** (`nuxt: ^4.4.x`) + **NuxtUI v4** (`@nuxt/ui: ^4.x`). With Nuxt 4,
`app/` is the default srcDir — root-level `pages/`, `components/`, `composables/` are gone. You do
**not** need `future: { compatibilityVersion: 4 }` or `srcDir: "app/"`; they are implied. A minimal
`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
	compatibilityDate: "2026-08-20",
	devtools: { enabled: true },
	modules: ["@nuxt/ui"],
	colorMode: { preference: "dark", fallback: "dark", classSuffix: "" },
	ssr: true,
	css: ["~/assets/css/main.css"],
	nitro: { preset: "bun" },
});
```

`@nuxt/ui` is the only UI module. `@hey-api/nuxt` is auto-registered as a dependency for the
generated API client (see [05](05-api-contract.md)). Lucide icons come from `@iconify-json/lucide`
(devDependency) and are used as `i-lucide-*`.

Entry layout in `app/app.vue` — `<NuxtRouteAnnouncer />` for a11y, then `<UApp>` wrapping the
layout and page:

```vue
<template>
  <NuxtRouteAnnouncer />
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

(Some apps also put a `<NuxtLoadingIndicator color="#<primary>" />` inside `<UApp>`; optional.)

`app/error.vue` uses NuxtUI's error component:

```vue
<script setup lang="ts">
const props = defineProps<{ error: any }&gt;();
</script>

<template>
  <UError :error="props.error" />
</template>
```

## NuxtUI v4 + Tailwind v4 (CSS-first)

There is no `tailwind.config.js`. Styling lives in `app/assets/css/main.css`:

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme {
	--font-sans: "Rubik", sans-serif;
}

:root {
	color-scheme: dark;
}

html {
	scroll-behavior: smooth;
}

.main-bg-color {
	background-color: rgb(2 6 23);
}
```

Reference it in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
	css: ["~/assets/css/main.css"],
	modules: ["@nuxt/ui"],
	// ...
});
```

Colors and theme live in `app.config.ts`:

```ts
export default defineAppConfig({
	ui: {
		colors: {
			primary: "sky",
			neutral: "slate",
		},
	},
	theme: {
		radius: 0.5,
		blackAsPrimary: false,
	},
});
```

Pick a project-appropriate `primary`: `sky` for LeiOS/Delivr/sites, `emerald` for NowIP, `orange` for
MindCode. `neutral: slate` is org-wide. See [15 — Design system](15-design-system.md).

## Icon system

Use Lucide icons through NuxtUI's icon naming: `i-lucide-home`, `i-lucide-settings-2`,
`i-lucide-trash`. The `UButton`, `UInput`, `UNavigationMenu` components accept these directly via the
`icon` / `trailing-icon` props.

## Project color and public config

Put the API URL and app URL in `runtimeConfig.public` so they are available on server and client:

```ts
export default defineNuxtConfig({
	runtimeConfig: {
		public: {
			apiUrl: process.env.NUXT_PUBLIC_API_URL || "http://localhost:<BACKEND_PORT>",
			appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:<PORT>",
		},
	},
});
```

Use the project's own 12xxx ports — never `3000` (see [02 — Ports](02-tooling.md#ports--one-unique-port-per-app-dev--prod)).
For the full-stack shape, `apiUrl` is omitted (same origin) and `updateAPIClient` sets `baseURL` to
`<appUrl>/api/v1`.

Access them via [`shared/frontend/useRuntimeAppConfigs.ts`](../shared/frontend/useRuntimeAppConfigs.ts):

```ts
const { apiUrl, appUrl } = useRuntimeAppConfigs();
```

## Directory conventions

```
app/
  app.vue
  app.config.ts
  error.vue
  assets/css/main.css
  components/
    dashboard/        # domain-grouped components
    form/
    img/              # logo components, e.g. LeiOSLogo.vue
    layout/
  composables/
    stores/           # useXxxStore() factories
    useAPI.ts
    updateAPIClient.ts
    useAppCookies.ts
    useRuntimeAppConfigs.ts
    useAwaitedComputed.ts
  layouts/
    default.vue
    dashboard.vue
    auth.vue
  middleware/
    auth.global.ts
    rewrites.global.ts
  pages/              # file-based routing; groups and params supported
    index.vue
    dashboard.vue
    dashboard/
      [id].vue
  utils/
    abstractStore.ts
    routeMatcher.ts
  api-client/         # GENERATED — never hand-edit
    openapi.json
    client.gen.ts
    sdk.gen.ts
    types.gen.ts
```

Components are PascalCase and grouped by domain. Composables are camelCase `useXxx.ts`. Stores are
not composables; keep them in `composables/stores/` and export a `useXxxStore()` factory.

## Route middleware

Use `.global.ts` for middleware that runs on every navigation.

[`shared/frontend/rewrites.global.ts`](../shared/frontend/rewrites.global.ts) strips trailing
slashes:

```ts
export default defineNuxtRouteMiddleware((to) => {
	if (to.path.endsWith("/") && to.path !== "/") {
		return navigateTo(to.path.slice(0, -1), { replace: true });
	}
});
```

`auth.global.ts` resolves the current session, allows public routes, and redirects anonymous users
to `/auth/login`:

```ts
export default defineNuxtRouteMiddleware(async (to) => {
	const publicRoutes = ["/auth/login", "/auth/register", "/docs"];
	const match = SimpleRouteMatcher.match(to.path, publicRoutes);
	if (match) return;

	const result = await useAPI((api) => api.getMe(), true);
	if (!result.success) {
		return navigateTo(`/auth/login?url=${encodeURIComponent(to.fullPath)}`);
	}
});
```

Use [`shared/frontend/routeMatcher.ts`](../shared/frontend/routeMatcher.ts) for dynamic allowlists:
`["/dashboard/[id]"]`.

## API access

Frontend code never calls `$fetch` or the generated SDK directly. Always go through `useAPI` from
[`shared/frontend/useAPI.ts`](../shared/frontend/useAPI.ts). It handles server/client differences,
session cookies, 401 redirects, and envelope normalization.

```vue
<script setup lang="ts">
const route = useRoute();
const user = await useAPI((api) => api.getUser({ path: { userId: route.params.userId } }));

if (!user.success) {
	showToast(user.message);
}
</script>
```

See [05 — API contract](05-api-contract.md) and [07 — State & data](07-state-and-data.md).

## State

Global state must be SSR-safe. Use `AbstractStore` over `useState` (see
[`shared/frontend/abstractStore.ts`](../shared/frontend/abstractStore.ts)). Never use a static
`reactive()` object or static class fields for per-request state — they leak across requests on the
server.

## SEO / metadata

Use `useHead` and `useSeoMeta` in pages or layouts. For static sites, prefer `nuxt generate` with
explicit meta in each page:

```ts
useSeoMeta({
	title: "LeiOS — Next-gen server deployment",
	ogTitle: "LeiOS",
	description: "Deploy, manage, and scale game servers from one dashboard.",
});
```

## Static content sites

Marketing, legal, and portfolio sites (Website, Legal-Website, Personal-Website) are a different
breed: **no API, no auth, no stores, no `useAPI`, no `api-client/`**. The rules above that depend on
a backend simply don't apply. What they do share:

- **Stack:** Nuxt 4 + NuxtUI v4 + Tailwind v4, same `app/` srcDir, same `app.config.ts`
  (`primary`/`neutral`/`radius`/`blackAsPrimary`), same dark-only `main.css`. `nitro.preset: "static"`.
- **Prose:** content-heavy sites add `@tailwindcss/typography` via `@plugin` in `main.css` (after
  `@import "tailwindcss";`, before `@import "@nuxt/ui";`) and render legal/blog text with
  `prose prose-invert max-w-none`.
- **SEO:** prefer a shared `usePageSeo` composable (see
  [`shared/frontend/usePageSeo.ts`](../shared/frontend/usePageSeo.ts)) over per-page inlined
  `useSeoMeta`. It wraps `useSeoMeta` + a canonical `useHead` link + optional JSON-LD
  (`SoftwareApplication`, `Person`, `BreadcrumbList`, …). Per-page inlining works but drifts.
- **Static data:** typed content that isn't worth a backend lives in `app/data/<thing>.ts` as
  exported interfaces + arrays + a `getById` helper, consumed via `computed`. (Personal-Website's
  `app/data/projects.ts` is the reference.)
- **Layout:** `UHeader` (`#title` logo NuxtLink, `UNavigationMenu :items`, `#body` vertical mobile
  menu, `#right` social `UButton`s) + `UMain`/`UContainer` + `UFooter`/`UFooterColumns`. See the
  public-site idiom in [15 — Design system](15-design-system.md).
- **`@nuxtjs/sitemap` + `@nuxtjs/robots`** for SEO infra on larger sites.

A static site may grow into a dynamic one; when it does, add `useAPI` + `api-client/` + `auth.global`
then — don't scaffold them up front.

## Checklist

- [ ] Nuxt 4 `app/` srcDir is configured.
- [ ] Tailwind v4 via CSS import; no `tailwind.config.js`.
- [ ] `app.config.ts` sets `primary`, `neutral: slate`, `radius: 0.5`, `blackAsPrimary: false`.
- [ ] Lucide icons only (`i-lucide-*`).
- [ ] Public API/app URLs via `runtimeConfig.public`.
- [ ] `auth.global.ts` + `rewrites.global.ts` in `app/middleware/`.
- [ ] `useAPI` is the only API call path; no raw `$fetch`.
- [ ] Global state uses `AbstractStore` over `useState`.
- [ ] Generated client in `app/api-client/` is committed but never hand-edited.
