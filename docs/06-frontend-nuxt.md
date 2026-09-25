# 06 — Frontend architecture (Nuxt)

There are three Nuxt shapes, each with a template:

- **Standalone app** — [`templates/nuxt-app/`](../templates/nuxt-app/) (port 12510), talks to a
  separate backend-service over HTTP.
- **Full-stack app** — [`templates/fullstack-nuxt-app/`](../templates/fullstack-nuxt-app/) (port
  12520), Hono API mounted inside Nitro. Its `app/` directory is identical to the standalone one
  except `composables/updateAPIClient.ts`.
- **Static site** — [`templates/static-site/`](../templates/static-site/) (12530) and
  [`templates/static-site-with-docs/`](../templates/static-site-with-docs/) (12531). No API, no
  auth. See [Static content sites](#static-content-sites).

Everything before "Static content sites" applies to the two app shapes.

## Nuxt 4 `app/` directory

All Nuxt apps are on **Nuxt 4** (`nuxt: ^4.4.x`) + **NuxtUI v4** (`@nuxt/ui: ^4.9.x`). With Nuxt 4,
`app/` is the default srcDir — root-level `pages/`, `components/`, `composables/` are gone. You do
**not** need `future: { compatibilityVersion: 4 }` or `srcDir: "app/"`.

The standalone template's
[`nuxt.config.ts`](../templates/nuxt-app/nuxt.config.ts):

```ts
export default defineNuxtConfig({
	compatibilityDate: "2026-08-20",
	devtools: { enabled: true },
	modules: ["@nuxt/ui"],
	colorMode: {
		preference: "dark",
		fallback: "dark",
		classSuffix: "",
	},
	ssr: true,
	css: ["~/assets/css/main.css"],

	nitro: {
		esbuild: {
			options: {
				target: "esnext",
			},
		},
	},

	runtimeConfig: {
		public: {
			apiUrl: process.env.NUXT_PUBLIC_API_URL || "http://localhost:12500",
			appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:12510",
		},
	},

	telemetry: false,
});
```

The full-stack [`nuxt.config.ts`](../templates/fullstack-nuxt-app/nuxt.config.ts) differs in:

```ts
	compatibilityDate: "2026-09-01",

	nitro: {
		rollupConfig: { external: ["bun:sqlite"] }, // the embedded API uses bun:sqlite
		esbuild: { options: { target: "esnext" } },
	},

	runtimeConfig: {
		public: {
			// no apiUrl — the API is on the same origin
			//@ts-ignore
			appUrl: process.env.APPPREFIX_APP_URL || "http://localhost:12520",
		},
	},

	routeRules: {
		"/dashboard/**": { ssr: false }, // app pages render client-side
		"/auth/**": { ssr: false },
		"/**": { ssr: true }, // public pages stay SSR
	},
```

- **No `nitro.preset` in app configs.** The server preset comes from the build script
  (`"build": "nuxt build --preset bun"`, output `.output/`). Static sites set
  `nitro.preset: "static"` in the config (and build with `--preset static`).
- **`compatibilityDate`** is pinned to the scaffold date (`2026-08-20` in nuxt-app, `2026-09-01`
  in the other templates). Bump it deliberately, not in passing.
- **Modules:** `@nuxt/ui` is the only registered module (static-site-with-docs adds
  `@nuxt/content`). Lucide icons come from `@iconify-json/lucide` (devDependency). The generated
  API client (`@hey-api/client-nuxt` plugin, see [05](05-api-contract.md)) is self-contained — it
  imports only `nuxt/app` and `vue`. `@hey-api/nuxt` is listed in the templates' `package.json` but
  is not registered in `modules` and nothing imports it.

### `app.vue`, `error.vue`, loading indicator

[`app/app.vue`](../templates/nuxt-app/app/app.vue) — `<NuxtRouteAnnouncer />` for a11y, then
`<UApp>` wrapping the layout and page:

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

The loading bar is not in `app.vue`; the `auth` and `dashboard` layouts render
`<NuxtLoadingIndicator color="var(--ui-primary)" position="top" />` themselves.

[`app/error.vue`](../templates/nuxt-app/app/error.vue) keeps the public header and footer around
NuxtUI's error component:

```vue
<script setup lang="ts">
import type { NuxtError } from "#app";

defineProps<{
	error: NuxtError;
}>();
</script>

<template>
	<div class="main-bg-color flex min-h-screen flex-col text-slate-100">
		<LayoutHeader />

		<UMain class="flex-1">
			<UError :error="error" />
		</UMain>

		<LayoutFooter />
	</div>
</template>
```

## NuxtUI v4 + Tailwind v4 (CSS-first)

There is no `tailwind.config.js`. Styling lives in `app/assets/css/main.css` (canonical copy:
[`shared/frontend/app/assets/css/main.css`](../shared/frontend/app/assets/css/main.css)), referenced
by `css: ["~/assets/css/main.css"]` in `nuxt.config.ts`:

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

/* slate-950 — the default app background; per-project. */
.main-bg-color {
	background-color: rgb(2 6 23);
}
```

Colors and theme live in `app.config.ts` (canonical copy:
[`shared/frontend/app/app.config.ts`](../shared/frontend/app/app.config.ts)):

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

Use Lucide icons through NuxtUI's icon naming: `i-lucide-house`, `i-lucide-settings`,
`i-lucide-trash-2`. `UButton`, `UInput`, `UNavigationMenu` items, `UBadge` and `UIcon` accept them
via `icon` / `trailing-icon` / `name`.

## Public runtime config

Put URLs the client needs in `runtimeConfig.public` (see the configs above) and read them through
[`useRuntimeAppConfigs`](../shared/frontend/app/composables/useRuntimeAppConfigs.ts):

```ts
const { apiUrl, appUrl } = useRuntimeAppConfigs(); // "" when unset
```

`updateAPIClient` builds the SDK's `baseURL` from them — copy the variant for your shape into
`app/composables/updateAPIClient.ts`:

| Shape | Source | `baseURL` |
| --- | --- | --- |
| Standalone | [`updateAPIClient.ts`](../shared/frontend/app/composables/updateAPIClient.ts) | `<apiUrl>/v1` (backend-service has no `/api` prefix) |
| Full-stack | [`updateAPIClient.fullstack.ts`](../shared/frontend/app/composables/updateAPIClient.fullstack.ts) | `<appUrl>/api/v1` (Hono mounted at `/api`) |

`process.env` in `nuxt.config.ts` is read when Nuxt builds (or starts `dev`). At runtime Nuxt
overrides public values only from `NUXT_PUBLIC_*` variables: `NUXT_PUBLIC_API_URL` /
`NUXT_PUBLIC_APP_URL`. The full-stack default reads `APPPREFIX_APP_URL`, so for a production image
either set it at build time or set `NUXT_PUBLIC_APP_URL` on the container.

Use the project's own 12xxx ports — never `3000` (see
[02 — Ports](02-tooling.md#ports--one-unique-port-per-app-dev--prod)).

## Directory conventions

The real `app/` tree of both app templates:

```
app/
  app.vue  app.config.ts  error.vue
  assets/css/main.css
  api-client/                     # GENERATED (bun run api-client:generate) — never hand-edit
    client.gen.ts  sdk.gen.ts  types.gen.ts  zod.gen.ts  index.ts  client/  core/
  components/
    Gravatar.vue                  # <Gravatar>
    dashboard/                    # <DashboardPageHeader> <DashboardPageBody> <DashboardModal>
                                  # <DashboardDeleteModal> <DashboardDataTable> <DashboardUserMenu>
    form/DateRangePicker.vue      # <FormDateRangePicker>
    img/{AppLogo,AppIcon}.vue     # <ImgAppLogo> <ImgAppIcon>
    layout/{Header,Footer}.vue    # <LayoutHeader> <LayoutFooter>
  composables/
    stores/{useUserStore,useOnboardingStore}.ts    # NOT auto-imported — import explicitly
    useAPI.ts  updateAPIClient.ts  useAppCookies.ts  useRuntimeAppConfigs.ts
    useAwaitedComputed.ts  usePageSeo.ts  useSubrouterInjectedData.ts
    useSubrouterPathDynamics.ts  useDefaultOnFormError.ts  useGravatarURL.ts
  layouts/{default,auth,onboarding,dashboard}.vue
  middleware/{auth.global,rewrites.global}.ts
  pages/
    index.vue  welcome.vue
    auth/{login,signup,forgot-password,reset-password}.vue
    dashboard/
      index.vue
      settings.vue                # parent route: toolbar + <NuxtPage />
      settings/{index,security}.vue
      apikeys/index.vue
      apikeys/[api_key_id].vue    # parent route: loads the key, provides it to children
      apikeys/[api_key_id]/index.vue
      admin/users.vue
  utils/{abstractStore,routeMatcher,types,format,roles,url}.ts
public/{favicon.ico, robots.txt, static/logo/icon.{svg,png}, static/utils/sitemap.xml}
```

The canonical copies of the core files live under
[`shared/frontend/app/`](../shared/frontend/app/) in the same layout (copy
`shared/frontend/app/composables/useAPI.ts` to `app/composables/useAPI.ts`, etc.). Pages, layouts,
`dashboard/UserMenu.vue`, `Gravatar.vue`, `img/`, `layout/`, `useDefaultOnFormError`,
`useGravatarURL` and `utils/{types,format,roles,url}.ts` are template-only — copy them from
[`templates/nuxt-app/app/`](../templates/nuxt-app/app/).

- **Components** are PascalCase, grouped by domain folder, and used by Nuxt's auto-import name:
  folder prefix + file name (`layout/Header.vue` → `<LayoutHeader>`, `dashboard/DataTable.vue` →
  `<DashboardDataTable>`; a file that already starts with its folder name keeps it once:
  `dashboard/DashboardModal.vue` → `<DashboardModal>`). Don't `import` components in
  `<script setup>` (see the Biome notes below).
- **Composables** are camelCase `useXxx.ts`. Nuxt auto-imports only top-level `composables/*.ts`
  and `utils/*.ts` exports (`useAPI`, `formatDate`, `SimpleRouteMatcher`, …).
- **Stores** live in `composables/stores/` and export a `useXxxStore()` factory. Being in a
  subfolder they are **not** auto-imported:

  ```ts
  import { useUserInfoStore } from "~/composables/stores/useUserStore";
  ```

- **Nested routes** use a parent page file next to a folder of the same name
  (`settings.vue` + `settings/`, `[api_key_id].vue` + `[api_key_id]/`). The parent renders the
  shared chrome and `<NuxtPage />`; see [07](07-state-and-data.md#nested-routes-parent--child-data).

### Biome and `.vue` files

Biome lints only the `<script>` block — it cannot see `<template>`:

- Imports and variables used only in the template are reported as unused **warnings**. They are
  expected (the app templates show dozens); `bun run check:ci` passes with them. **Never** run
  `biome check --write --unsafe` (or `lint --unsafe`) on `.vue` files — the unsafe fix deletes those
  bindings and breaks the template. Using auto-imported component names avoids the component case.
- A value that is used as a **type** in `<script>` and as a **value** only in the template (e.g. a
  generated Zod schema) must also be referenced as a value in `<script>`, or `useImportType`
  rewrites it to `import type` and the template breaks:

  ```ts
  import { zPostAdminUsersBody } from "~/api-client/zod.gen";

  // Referenced here (not only in the template) so Biome keeps it a value import.
  const createSchema = zPostAdminUsersBody;
  type CreateSchema = z.output<typeof createSchema>;
  ```

static-site-with-docs sets `noUnusedImports`/`noUnusedVariables` to `"off"` for this reason.

## What the templates ship

Both app templates ship a complete app shell (mirrors the template README's "Frontend" section).
Delete whatever your project doesn't need.

| Route | Layout | What it is |
| --- | --- | --- |
| `/` | `default` | Marketing landing page (hero, features, how-it-works, CTA) |
| `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | `auth` | Login and password reset |
| `/auth/signup` | `auth` | Signup form, **UI only** — the backend has no register route yet |
| `/welcome` | `onboarding` | One-time onboarding after the first login |
| `/dashboard` | `dashboard` | Overview (stat cards, quick actions) |
| `/dashboard/settings`, `/dashboard/settings/security` | `dashboard` | Profile; password + account deletion |
| `/dashboard/apikeys`, `/dashboard/apikeys/new`, `/dashboard/apikeys/<id>` | `dashboard` | API key list, create, detail/delete |
| `/dashboard/admin/users` | `dashboard` | Admin-only user management |

Trimming it down:

- **Everything behind login (no public landing page):** set `PROTECTED_PREFIXES = ["/"]` and
  `HOME_ROUTE = "/"` in the guard, and replace `pages/index.vue` with your app's home (for example
  the dashboard overview).
- **No dashboard:** delete `layouts/dashboard.vue`, `pages/dashboard/` and `components/dashboard/`,
  remove the Dashboard links from `components/layout/Header.vue` and `Footer.vue`, and point
  `PROTECTED_PREFIXES` at your protected pages.
- **No onboarding:** set `REQUIRE_ONBOARDING = false`, or delete `pages/welcome.vue`,
  `layouts/onboarding.vue`, `composables/stores/useOnboardingStore.ts` and the onboarding block in
  the guard.
- **No signup:** delete `pages/auth/signup.vue` and its link in `pages/auth/login.vue`.
- **No admin area:** delete `pages/dashboard/admin/`, the Admin group in `layouts/dashboard.vue` and
  the "Manage Users" entry in `components/dashboard/UserMenu.vue`.

Placeholders to replace: `ProjectName` (texts, SEO titles, `img/AppLogo.vue`), `<PREFIX>` (session
cookie name in `composables/useAppCookies.ts`), the links in `components/layout/Footer.vue`, and the
domain in `public/robots.txt` / `public/static/utils/sitemap.xml`.

## Route middleware

Use `.global.ts` for middleware that runs on every navigation.

[`rewrites.global.ts`](../shared/frontend/app/middleware/rewrites.global.ts) strips trailing
slashes:

```ts
export default defineNuxtRouteMiddleware((to) => {
	if (to.path.endsWith("/") && to.path !== "/") {
		return navigateTo(to.path.slice(0, -1), { replace: true });
	}
});
```

[`auth.global.ts`](../shared/frontend/app/middleware/auth.global.ts) is a session-aware guard
driven by the user store. Tune the constants per project:

```ts
import { useOnboardingStore } from "~/composables/stores/useOnboardingStore";
import { useUserInfoStore } from "~/composables/stores/useUserStore";

const HOME_ROUTE = "/dashboard";
const PROTECTED_PREFIXES = ["/dashboard"];
const ADMIN_PREFIXES = ["/dashboard/admin"];
const PUBLIC_ROUTES: string[] = [];
const ONBOARDING_ROUTE = "/welcome";
const REQUIRE_ONBOARDING = true;

function hasPrefix(path: string, prefixes: string[]) {
	return prefixes.some(
		(prefix) => prefix === "/" || path === prefix || path.startsWith(`${prefix}/`),
	);
}

export default defineNuxtRouteMiddleware(async (to) => {
	const sessionToken = useAppCookies().sessionToken;
	const token = sessionToken.get().value;
	const store = useUserInfoStore();

	if (hasPrefix(to.path, ["/auth"])) {
		if (!token) return;
		if (store.isValid(await store.use())) return navigateTo(HOME_ROUTE);

		// Token exists but is invalid or expired: clear it and stay on the auth page.
		sessionToken.set(null);
		return;
	}

	if (!hasPrefix(to.path, [...PROTECTED_PREFIXES, ONBOARDING_ROUTE])) return;
	if (SimpleRouteMatcher.match(to.path, PUBLIC_ROUTES)) return;

	const loginRoute = `/auth/login?url=${encodeURIComponent(to.fullPath)}`;
	if (!token) return navigateTo(loginRoute);

	const user = await store.use();
	if (!store.isValid(user)) {
		sessionToken.set(null);
		return navigateTo(loginRoute);
	}

	if (REQUIRE_ONBOARDING && to.path !== ONBOARDING_ROUTE) {
		const onboardingStore = useOnboardingStore();
		await onboardingStore.refreshIfNeeded();
		if (!onboardingStore.completed.value) {
			return navigateTo(ONBOARDING_ROUTE);
		}
	}

	if (hasPrefix(to.path, ADMIN_PREFIXES) && user.value.role !== "admin") {
		return navigateTo(HOME_ROUTE);
	}
});
```

- **`/auth/*`** is for signed-out users: a valid session is sent on to `HOME_ROUTE`; a stale token
  is cleared and the user stays on the auth page.
- **`PROTECTED_PREFIXES`** (and `ONBOARDING_ROUTE`) need a valid session, else
  `/auth/login?url=<fullPath>`. Everything else (landing, marketing pages) is public.
- **`PUBLIC_ROUTES`** are exceptions inside a protected prefix, matched with
  [`SimpleRouteMatcher`](../shared/frontend/app/utils/routeMatcher.ts) (`[param]` segments work:
  `"/dashboard/share/[id]"`).
- **Onboarding gate:** with `REQUIRE_ONBOARDING`, signed-in users who haven't completed onboarding
  are sent to `/welcome` first (`/welcome` itself is excluded, so it never loops).
- **Admin gate:** `ADMIN_PREFIXES` additionally need `role === "admin"`, else `HOME_ROUTE`. This is
  UX only — the backend enforces roles (see [10](10-auth.md)).
- **Everything behind login:** `PROTECTED_PREFIXES = ["/"]` (`hasPrefix` treats `"/"` as
  match-all) and `HOME_ROUTE = "/"`; list any public pages in `PUBLIC_ROUTES`.

The login page follows `?url=` only for internal paths (`/…`, not `//…`) and defaults to
`/dashboard`. Signup lives at `/auth/signup` (UI only in the templates).

## API access

Frontend code never calls `$fetch` or the generated SDK directly. Always go through `useAPI` from
[`shared/frontend/app/composables/useAPI.ts`](../shared/frontend/app/composables/useAPI.ts). It
handles server/client differences, the session cookie, 401 redirects, and turns exceptions into the
envelope — it never throws. Branch on `result.success` and report errors with NuxtUI's toast:

```ts
const toast = useToast();

const res = await useAPI((api) => api.deleteAdminUsersByUserId({ path: { userId: target.id } }));
if (!res.success) {
	toast.add({ title: "Delete failed", description: res.message, color: "error" });
	return;
}
toast.add({ title: "User deleted", color: "success" });
```

SDK functions take one options object — pass `{}` when there is nothing to send
(`api.getAccount({})`). See [05 — API contract](05-api-contract.md) and
[07 — State & data](07-state-and-data.md).

## State

Global state must be SSR-safe. Use `AbstractStore` over `useState` (see
[`shared/frontend/app/utils/abstractStore.ts`](../shared/frontend/app/utils/abstractStore.ts) and
[07](07-state-and-data.md)). Never use a static `reactive()` object or static class fields for
per-request state — they leak across requests on the server.

## SEO / metadata

- **App pages** set their own meta with `useSeoMeta` — every template page does:

  ```ts
  useSeoMeta({
  	title: "API Keys | ProjectName",
  	description: "Manage your API keys",
  });
  ```

- **Landing page and static sites** use
  [`usePageSeo`](../shared/frontend/app/composables/usePageSeo.ts), which wraps `useSeoMeta`
  (title, description, OpenGraph, `robots`) + a canonical `<link>` + optional JSON-LD
  (`SoftwareApplication`, `Person`, `BreadcrumbList`, …):

  ```ts
  usePageSeo({
  	title: "ProjectName — One-line pitch for your project",
  	description: "A short description of what ProjectName does and who it is for.",
  });
  ```

- **Nested routes** compute title and breadcrumbs in the parent page with
  `useSubrouterPathDynamics` and call `useSeoMeta(values.seoSettings)` (titles become
  `"<page> | <baseTitle>"`); see [07](07-state-and-data.md#usesubrouterpathdynamics).
- `public/robots.txt` in the app templates disallows `/dashboard`.

## Type checking and known limitations

`bun run typecheck` = `nuxt typecheck` (vue-tsc, covers `app/`) + `tsc -p
./tsconfig/tsconfig.typecheck.json` (tests, plus `server/` in full-stack). Known limitations — see
[02 — TypeScript](02-tooling.md#typescript):

- Run under Bun, `nuxt typecheck` does **not** type-check `.vue` files — vue-tsc patches TypeScript
  through a `fs.readFileSync` hook that Bun's module loader bypasses — so only `.ts` files are
  checked. Rely on your editor's Vue language tools for `.vue` diagnostics.
- `bunx --bun nuxt dev` fails on Windows (Bun treats the Nuxt CLI worker path as a package spec);
  use WSL, Linux or macOS.
- `@unhead/vue` 3.4.1 ships a broken `.d.ts` that fresh installs pick up.
- `@hey-api/openapi-ts` 0.99 emits typing bugs in the generated client (see
  [05](05-api-contract.md)).

## Static content sites

Marketing, legal, portfolio and docs sites are a different breed: **no API, no auth, no stores, no
`useAPI`, no `api-client/`, no middleware**. Two templates:
[`static-site`](../templates/static-site/) and
[`static-site-with-docs`](../templates/static-site-with-docs/) (below). What they share with the
apps: Nuxt 4 + NuxtUI v4 + Tailwind v4, the same `app/` srcDir, `app.config.ts`
(`primary`/`neutral`/`radius`/`blackAsPrimary`) and dark-only `main.css`.

- **Config** ([`nuxt.config.ts`](../templates/static-site/nuxt.config.ts)): `nitro.preset: "static"`
  plus prerender settings, and an `app.head` baseline:

  ```ts
  	app: {
  		head: {
  			htmlAttrs: { lang: "en-US" },
  			charset: "utf-8",
  			viewport: "width=device-width, initial-scale=1",
  			meta: [
  				{ name: "author", content: "LeiCraft_MC" },
  				{ name: "robots", content: "index, follow, max-image-preview:large" },
  				{ name: "theme-color", content: "#0b0c1b" },
  			],
  			link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
  		},
  	},

  	nitro: {
  		preset: "static",
  		prerender: {
  			routes: ["/projects/example"], // dynamic routes the crawler might miss
  		},
  	},
  ```

  List every dynamic route (e.g. one `/projects/<id>` per `app/data` entry) in `prerender.routes`
  if the crawler can't reach it through links. Match `theme-color` to your background.
- **Prose:** `@tailwindcss/typography` is a dependency, enabled in `main.css`. Biome requires
  `@import`s first, so the plugin goes **after** both imports:

  ```css
  @import "tailwindcss";
  @import "@nuxt/ui";
  @plugin "@tailwindcss/typography";
  ```

  Render legal/blog/docs text with `prose prose-invert max-w-none`.
- **SEO:** `usePageSeo` on **every** page, never inline `useSeoMeta`:

  ```ts
  usePageSeo({
  	title: `${project.value.title} — Projects - <ProjectName>`,
  	description: project.value.shortDescription,
  });
  ```

- **Static data:** typed content that isn't worth a backend lives in `app/data/<thing>.ts` as
  exported interfaces + an array + lookup helpers — see
  [`app/data/projects.ts`](../templates/static-site/app/data/projects.ts) (`Project`, `projects`,
  `getProjectById`, `getAllProjectIds`). Pages consume it via `computed` and 404 on a miss:

  ```ts
  import { getProjectById } from "~/data/projects";

  const route = useRoute();
  const project = computed(() => getProjectById(route.params.id as string));

  if (!project.value) {
  	throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }
  ```

- **Layout:** `layouts/default.vue` = `Header` + `UMain` (+ `UContainer` in static-site) + `Footer`.
  `UHeader` has the logo `NuxtLink` in `#title`, `UNavigationMenu :items` in the default slot, a
  vertical menu (links + socials) in `#body`, and social `UButton`s in `#right`. The footer is a
  simple `UFooter` with the copyright line and Impressum / Datenschutz links (legal.leicraftmc.de).
  See [15](15-design-system.md#static-site-styling). The static templates still `import` `Header`,
  `Footer`, `LCMCIcon` and `ProjectCard` explicitly, which static-site reports as unused-import
  warnings; the auto-import names (`<LayoutHeader>`, `<ImgLCMCIcon>`, `<ProjectCard>`) avoid that.
- **SEO infra is hand-written:** `public/robots.txt` and `public/static/utils/sitemap.xml` (served
  at `/static/utils/sitemap.xml` — point robots' `sitemap:` line there). Update the sitemap when you
  add pages. `@nuxtjs/sitemap` / `@nuxtjs/robots` are optional for larger sites; the templates don't
  use them.
- **Deploy:** `bun run generate` → `.output/public/`, rsynced by GitLab CI; `public/.htaccess`
  configures Apache (clean URLs, trailing-slash redirect, `.well-known` bypass, `404.html`). See
  [14](14-deployment.md).

A static site may grow into a dynamic one; when it does, add `useAPI` + `api-client/` + `auth.global`
then — don't scaffold them up front.

### Static site with docs

Choose [`static-site-with-docs`](../templates/static-site-with-docs/) when a project site also needs
Markdown documentation — a landing page plus a sidebar-navigated docs section, still fully static.
It is `static-site` plus:

- **`@nuxt/content`** in `modules`, with one `page` collection in
  [`content.config.ts`](../templates/static-site-with-docs/content.config.ts):

  ```ts
  import { defineCollection, defineContentConfig } from "@nuxt/content";

  export default defineContentConfig({
  	collections: {
  		docs: defineCollection({
  			type: "page",
  			source: "docs/**/*.md",
  		}),
  	},
  });
  ```

  Pages are `content/docs/**/*.md` with `title`, `description` and `navigation.title` frontmatter.
- **One renderer**, [`app/pages/docs/[...slug].vue`](../templates/static-site-with-docs/app/pages/docs/[...slug].vue):

  ```vue
  <script setup lang="ts">
  const route = useRoute();
  const { data: page } = await useAsyncData(route.path, () =>
  	queryCollection("docs")
  		.path(`/docs/${route.params.slug?.toString() || ""}`)
  		.first(),
  );

  if (!page.value) {
  	throw createError({ statusCode: 404, statusMessage: "Page not found", fatal: true });
  }

  usePageSeo({
  	title: `${page.value.title} — <ProjectName> Docs`,
  	description: page.value.description,
  });
  </script>

  <template>
  	<DocsPage>
  		<ContentRenderer v-if="page" :value="page" class="prose prose-invert max-w-none" />
  	</DocsPage>
  </template>
  ```

- **`components/docs/DocsPage.vue`** — the docs shell: sticky sidebar (sections + active link) and
  prev/next cards, both driven by [`app/data/docs.ts`](../templates/static-site-with-docs/app/data/docs.ts).
- **Register every page in `app/data/docs.ts`** (`docsSections` → `{ to, title, description, icon }`).
  The sidebar and prev/next read only this file, not the content collection — a Markdown file that
  isn't registered is unreachable from the navigation and, since prerendering crawls links, is not
  generated unless another page links to it.
- **MDC components** go in `components/content/` and are usable from Markdown. The template ships
  `IconCardGrid.vue`, used as `::icon-card-grid` with YAML props (`cards:`); it wraps itself in
  `not-prose` so typography styles don't leak in.
- **Prerender:** `crawlLinks: true` from `routes: ["/"]`, with `/__nuxt_content/**` ignored and
  `routeRules: { "/__nuxt_content/**": { prerender: false } }` so Nitro doesn't try to prerender
  `@nuxt/content`'s internal query endpoints.
- **Layout:** `layouts/default.vue` has no `UContainer`; marketing pages wrap themselves in
  `<UContainer>`, and `DocsPage` has its own `max-w-7xl` container.
- **Deliberately absent:** search, i18n and sitemap modules. Add them when a project needs them.
- **Biome:** `noUnusedImports` / `noUnusedVariables` are `"off"` in this template's `biome.json`
  (template-only bindings, see above).

## Checklist

- [ ] Nuxt 4 `app/` srcDir; no `compatibilityVersion`/`srcDir` settings; `compatibilityDate` pinned.
- [ ] Tailwind v4 via CSS import; no `tailwind.config.js`.
- [ ] `app.config.ts` sets `primary`, `neutral: slate`, `radius: 0.5`, `blackAsPrimary: false`.
- [ ] Lucide icons only (`i-lucide-*`).
- [ ] Server preset from the build script (`--preset bun`); static sites `nitro.preset: "static"`.
- [ ] Public URLs via `runtimeConfig.public` + `useRuntimeAppConfigs`; the right `updateAPIClient`
      variant for the shape (`<apiUrl>/v1` or `<appUrl>/api/v1`).
- [ ] `auth.global.ts` constants tuned; `rewrites.global.ts` in `app/middleware/`.
- [ ] Unused template routes, layouts and components deleted; placeholders replaced.
- [ ] Components used by auto-import names; stores imported explicitly from `composables/stores/`.
- [ ] No `biome --unsafe` fixes on `.vue` files.
- [ ] `useAPI` is the only API call path; no raw `$fetch`; errors via `useToast().add(...)`.
- [ ] Global state uses `AbstractStore` over `useState`.
- [ ] Every page sets SEO meta (`useSeoMeta` in app pages, `usePageSeo` on landing/static pages).
- [ ] Generated client in `app/api-client/` is committed but never hand-edited.
- [ ] Static sites: `usePageSeo` everywhere, typography `@plugin` after the imports, data in
      `app/data/`, robots/sitemap maintained; docs pages registered in `app/data/docs.ts`.
