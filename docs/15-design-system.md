# 15 — Design system and brand

## Brand assets

Brand assets live in [`assets/`](../assets/):

```
assets/
  logos/
    lcms-logo-mark.svg     # LeiCraftMC org mark — 8×8 pixel "LC" (the favicon base)
    leios-logo.svg         # LeiOS — LC mark + "LeiOS" wordmark (primary: sky)
    mindcode-logo.svg      # MindCode — braces-asterisk glyph + wordmark (primary: orange)
    nowip-logo.svg         # NowIP — globe glyph + "NowIP" wordmark (primary: emerald)
  colors/
    palette.md             # hex values
  fonts/
    README.md              # Rubik (primary sans); loaded automatically via @nuxt/fonts
```

Use the official assets in apps and sites. Do not recreate the logo with a different font or shape.

## Colors

Primary colors are project-specific, but the neutral palette and dark background are consistent:

| Token | Value | Usage |
| --- | --- | --- |
| `neutral` | `slate` | text, borders, subtle surfaces |
| `background` | `rgb(2 6 23)` (`slate-950`) | main app background (`.main-bg-color`) |
| `primary` | `sky` / `emerald` / `orange` | CTAs, active states, project identity |

Project primaries:

- **LeiOS / Delivr / LeiCraftMC sites** — `sky`
- **NowIP** — `emerald`
- **MindCode** — `orange`

**Background.** Every template defines `.main-bg-color { background-color: rgb(2 6 23); }` in
`main.css` and applies it to each layout root (`default`, `auth`, `onboarding`, the dashboard's
`UDashboardGroup` and sidebar `:ui` slots, `error.vue`) and to dropdown viewports
(`:ui="{ viewport: 'main-bg-color' }"`). The value is per-project — Delivr uses pure black
`rgb(0 0 0)`, Personal-Website `#0b0c1b` — so change it in one place. The static templates'
`theme-color` meta is `#0b0c1b` while their background is slate-950; set it to your real
background.

**Surfaces and text** used throughout the templates: cards `border-slate-800 bg-slate-900/60`
(landing cards `bg-slate-900/50`), dividers `divide-slate-800`, headings `text-white`, body
`text-slate-100` (layout root), secondary text `text-slate-400`, muted `text-slate-500`. Use
`primary-*` rather than a hard-coded palette color for accents so a project can switch primaries in
`app.config.ts`.

## Typography

Default sans font is **Rubik**. Declare it in `app/assets/css/main.css`:

```css
@theme {
	--font-sans: "Rubik", sans-serif;
}
```

That's the whole setup. Every Nuxt template uses `@nuxt/ui`, which registers `@nuxt/fonts`
automatically; `@nuxt/fonts` scans `--font-*` CSS variables by default, resolves the family, and
self-hosts it locally — no manual `@font-face` or Google Fonts `<link>` required.

## NuxtUI configuration

Copy [`shared/frontend/app/app.config.ts`](../shared/frontend/app/app.config.ts) and tune only
`primary`:

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

## Icons

Use Lucide only. NuxtUI exposes them as `i-lucide-*`:

```vue
<UButton icon="i-lucide-save" label="Save" />
<UInput icon="i-lucide-search" />
```

Do not mix FontAwesome, Heroicons, or custom SVG icons unless the icon does not exist in Lucide — in
that case, add a single-purpose component in `components/img/` (the templates keep their brand
marks there: `AppIcon.vue`, `AppLogo.vue`, and the static sites' inline-SVG `LCMCIcon.vue`).

## Dark mode

All apps are **dark-only** — there is no light theme and no toggle UI. Pin it in `nuxt.config.ts`
and `main.css`:

```ts
colorMode: { preference: "dark", fallback: "dark", classSuffix: "" },
```

```css
:root { color-scheme: dark; }
```

Do not add a `ColorModeButton`/toggle. Components must look correct on the project's dark background
by default.

## Favicons and logos

Every Nuxt template ships the same placeholder icons, based on the 8×8 LeiCraftMC mark
(`assets/logos/lcms-logo-mark.svg`):

- `public/favicon.ico` (32×32 + 48×48) — the static sites link it in `app.head.link`; the app
  templates rely on the browser's default `/favicon.ico` request.
- `public/static/logo/icon.svg` + `icon.png` (460×460) — in the app templates
  `components/img/AppIcon.vue` renders `<img src="/static/logo/icon.svg" alt="ProjectName" />` and
  `AppLogo.vue` = `ImgAppIcon` + the project name in `text-xl font-bold`. The static sites draw the
  mark inline instead (`components/img/LCMCIcon.vue`).

Replace these files (and the name in `AppLogo.vue`) with the project's own mark. No PWA icon set
(`icon-192`/`icon-512`) or PWA module is shipped — add one only if the app becomes a PWA.

## Layouts

The app templates ship four layouts
([`templates/nuxt-app/app/layouts/`](../templates/nuxt-app/app/layouts/)):

| Layout | Used by | Shape |
| --- | --- | --- |
| `default` | `/`, `error.vue` | `div.main-bg-color.flex.min-h-screen.flex-col.text-slate-100` → `<LayoutHeader>` + `<UMain class="flex-1">` + `<LayoutFooter>` |
| `auth` | `/auth/*` | `default` + loading bar + a `via-primary/5` gradient overlay; the page sits in a centered `UPageCard class="w-full max-w-md border-slate-800"` |
| `onboarding` | `/welcome` | no header; centered `ImgAppLogo` (`mb-8 h-8`), a `max-w-2xl` column, and a one-line `UFooter class="bg-neutral-900"` |
| `dashboard` | `/dashboard/**` | `UDashboardGroup` + sidebar (below) + loading bar |

Pages pick a layout with `definePageMeta({ layout: "dashboard" })`; child pages of a nested route
inherit the parent's.

## Component idioms

The canonical copy-paste versions of the dashboard components live in
[`shared/frontend/app/components/`](../shared/frontend/app/components/):
`dashboard/{DashboardPageHeader,DashboardPageBody,DashboardModal,DashboardDeleteModal,DataTable}.vue`
and `form/DateRangePicker.vue`. Copy them to the same paths under `app/components/`. The sidebar
`dashboard/UserMenu.vue`, `Gravatar.vue`, `layout/` and `img/` are template-only
([`templates/nuxt-app/app/components/`](../templates/nuxt-app/app/components/)). Use components by
their auto-import names (`<DashboardDataTable>`, `<FormDateRangePicker>`, `<LayoutHeader>`).

### Dashboard shell

[`layouts/dashboard.vue`](../templates/nuxt-app/app/layouts/dashboard.vue): `UDashboardGroup` +
a collapsible, resizable `UDashboardSidebar` whose `:ui` slots carry the background:

```vue
<UDashboardGroup class="main-bg-color text-slate-100">
	<UDashboardSidebar
		collapsible
		resizable
		:ui="{
			header: 'main-bg-color',
			body: 'main-bg-color',
			content: 'main-bg-color',
			footer: 'border-t border-default main-bg-color',
		}"
		:min-size="18"
		:default-size="20"
		:max-size="30"
	>
		<template #header="{ collapsed }">
			<NuxtLink to="/dashboard" :class="`${!collapsed ? 'ms-2.5' : ''} flex items-center gap-1.5`">
				<ImgAppLogo v-if="!collapsed" class="h-7" />
				<ImgAppIcon v-else class="h-8 w-8" />
			</NuxtLink>
		</template>

		<template #default="{ collapsed }">
			<UNavigationMenu :collapsed="collapsed" :items="mainItems" orientation="vertical" />
			<UNavigationMenu :collapsed="collapsed" :items="settingsItems" orientation="vertical" />
			<UNavigationMenu
				v-if="isAdmin"
				:collapsed="collapsed"
				:items="adminItems"
				orientation="vertical"
			/>
			<UNavigationMenu
				:collapsed="collapsed"
				:items="footerItems"
				orientation="vertical"
				class="mt-auto"
			/>
		</template>

		<template #footer="{ collapsed }">
			<DashboardUserMenu :collapsed="collapsed" />
		</template>
	</UDashboardSidebar>

	<slot />
</UDashboardGroup>
```

- Groups are separate `NavigationMenuItem[]` arrays: **main** (Overview, `exact: true`),
  **settings** (a `type: "label"` header, then General / Security / API Keys), **admin**
  (`v-if="isAdmin"`, from the user store's `role`), and **footer** ("Back to Home", pushed down with
  `mt-auto`). Items use `i-lucide-*` icons and `to`.
- `DashboardUserMenu` is a `UDropdownMenu` (`viewport: 'main-bg-color'`) on a ghost, full-width
  button showing the display name + `i-lucide-chevrons-up-down`; items: name label, Settings,
  Manage Users (admins), Log out.

### Dashboard page

Every dashboard page is a `UDashboardPanel` with `#header` and `#body` slots:

```vue
<UDashboardPanel>
	<template #header>
		<DashboardPageHeader title="API Keys" icon="i-lucide-key" description="Manage your API keys" />
	</template>
	<template #body>
		<DashboardPageBody> <!-- = <div class="space-y-6"><slot /></div> -->
			<!-- … -->
		</DashboardPageBody>
	</template>
</UDashboardPanel>
```

`DashboardPageHeader` wraps `UDashboardNavbar`. Props: `title`, `icon`, `description`,
`breadcrumbItems` (`BreadcrumbItem[]`). When `breadcrumbItems` is non-empty a `UBreadcrumb`
**replaces the title**; `description` renders in `#trailing` (`text-slate-400`, hidden below `sm`).
Slots `leading`, `title`, `trailing`, `left`, default and `right` pass through (put page actions in
`#right`).

**Sub-navigation** (settings, API key detail): a `UDashboardToolbar` under the header with a
highlighted `UNavigationMenu`; `-mx-1` aligns it with the sidebar collapse button:

```vue
<template #header>
	<DashboardPageHeader title="Settings" icon="i-lucide-settings" />

	<UDashboardToolbar>
		<UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
	</UDashboardToolbar>
</template>
```

`links` is a `NavigationMenuItem[][]`, static in `settings.vue` or generated by
`useSubrouterPathDynamics` ([07](07-state-and-data.md#usesubrouterpathdynamics)).

### Data table

[`DataTable.vue`](../shared/frontend/app/components/dashboard/DataTable.vue)
(`<DashboardDataTable>`, `<script setup generic="T extends Record<string, any>">`) wraps `UTable`
(TanStack, client-side filtering and pagination) in a `UCard class="border-slate-800 bg-slate-900/60"`.

- **Props:** `data: T[] | Ref<T[]>` and `loading: boolean | Ref<boolean>` (so a
  `useAPIAsyncData` result can be passed as-is), `columns: TableColumn<T>[]`, `filters`,
  `defaultPageSize` (10), `pageSizeOptions` ([10, 25, 50, 100]), `showRefresh`, `showPagination`,
  `showPageSizeSelector` (all `true`), `emptyTitle` / `emptyDescription` / `emptyIcon`.
- **Filters** (`FilterConfig[]`): `{ column, type?, placeholder?, icon?, class?, options?,
  filterFn?, label? }`. `type` is `"text"` (default), `"number"`, `"date"` (a
  `FormDateRangePicker`, value `{ start, end }`), `"select"`, `"multi-select"` (`options:
  { label, value }[]`) or `"custom"`. A `filterFn` overrides the built-in matcher for any type;
  `"custom"` renders no control — put your own in `#header-left` and drive it through the exposed
  `tableApi`.
- **Refresh:** the Refresh button emits `refresh`; wire it to the data's `refresh()`.
- **Slots:** `header-left`, `header-right` (primary action, e.g. "New API Key"), `empty` (replaces
  the `UEmpty`), `empty-actions`, `footer-left` (replaces the page-size `USelect`), `footer-right`
  (replaces `UPagination`), plus `<column>-cell` / `<column>-header` / `<column>-footer`
  passthrough.
- **States:** loading = `<UIcon name="i-lucide-loader-2" class="animate-spin text-3xl
  text-slate-400" />`; empty = `UEmpty variant="naked"`.

```vue
<DashboardDataTable
	:data="users ?? []"
	:columns="columns"
	:loading="loading"
	:filters="[
		{ column: 'username', type: 'text', placeholder: 'Search users...' },
		{ column: 'role', type: 'select', placeholder: 'All Roles', options: roleOptions },
	]"
	empty-title="No users"
	empty-icon="i-lucide-users"
	@refresh="refresh"
>
	<template #header-right>
		<UButton label="New User" icon="i-lucide-user-plus" @click="showCreateModal = true" />
	</template>
	<template #role-cell="{ row }">
		<UBadge :color="getRoleColor(row.original.role)" variant="soft">
			{{ row.original.role }}
		</UBadge>
	</template>
</DashboardDataTable>
```

### Forms

`UForm` + a Zod schema (generated from `~/api-client/zod.gen` when it matches the request body —
see [07](07-state-and-data.md#forms-and-generated-zod-schemas)) + `UFormField`, with `@submit`
typed as `FormSubmitEvent<Schema>`. Local `reactive()` form state is fine.

**Settings row layout** — label/description left, input right, stacked on mobile:

```vue
<UForm :schema="profileSchema" :state="profile" class="divide-y divide-slate-800" @submit="onSubmit">
	<UFormField
		name="username"
		label="Username"
		description="Your unique username for logging in."
		required
		class="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 max-sm:flex-col"
		:ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
	>
		<UInput v-model="profile.username" placeholder="Enter username" class="w-full sm:w-96" />
	</UFormField>

	<div class="pt-4">
		<UButton label="Save Changes" type="submit" :loading="loading" icon="i-lucide-save" />
	</div>
</UForm>
```

**Section card** — each form or group sits in a card with an icon header:

```vue
<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
	<div class="border-b border-slate-800 px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
				<UIcon name="i-lucide-user" class="h-5 w-5 text-primary-400" />
			</div>
			<div>
				<h3 class="font-medium text-white">Profile Information</h3>
				<p class="text-sm text-slate-400">Update your account profile details</p>
			</div>
		</div>
	</div>
	<div class="p-6"><!-- UForm --></div>
</div>
```

Sub-pages open with `<h2 class="text-xl font-semibold text-white">` + `<p class="mt-1 text-sm
text-slate-400">`.

**Danger zone** — the same card in red: `border-red-900/50 bg-red-950/20`, header
`border-red-900/50`, icon tile `bg-red-500/10` + `text-red-400` `i-lucide-alert-triangle`, title
`text-red-400`, and a `UButton color="error" variant="soft"` that opens a `DashboardDeleteModal`.

**Cross-field rules** (password confirmation, "new ≠ current") go in a `:validate` function
returning `FormError[]`, next to the schema:

```ts
function validate(state: Partial<Schema>): FormError[] {
	const errors: FormError[] = [];
	if (state.password && state.confirm_password && state.password !== state.confirm_password) {
		errors.push({ name: "confirm_password", message: "Passwords do not match" });
	}
	return errors;
}
```

**Auth pages** use `UAuthForm` inside the `auth` layout — fields as `AuthFormField[]`, plus
`:schema`, `:validate`, `:submit="{ label: 'Login', loading }"`, `title`/`description`/`icon`, and
links in `#footer`:

```vue
<UAuthForm
	:schema="schema"
	title="Login"
	description="Enter your credentials to access your account."
	icon="i-lucide-user"
	:fields="fields"
	:submit="{ label: 'Login', loading }"
	@submit="onSubmit"
>
	<template #footer>
		<div class="text-center text-sm">
			Forgot your password?
			<NuxtLink to="/auth/forgot-password" class="text-primary hover:underline">
				Reset here
			</NuxtLink>
		</div>
	</template>
</UAuthForm>
```

### Modals

[`DashboardModal`](../shared/frontend/app/components/dashboard/DashboardModal.vue) wraps `UModal`
(`content: 'sm:max-w-lg'`, footer right-aligned):

- `v-model:open` is **required**.
- Props: `title` (required), `description`, `icon`, `iconColor` (`"primary" | "amber" | "emerald"
  | "error" | "neutral"`, default `primary`), `loading` (spinner replaces the body). Other
  `UModal` props pass through (`:dismissible="false"`, `:close="false"` for a must-acknowledge
  dialog).
- Icon colors come from a static class map (`primary: "text-primary-400"`, `error:
  "text-red-400"`, …) — never interpolate `text-${color}-400`; Tailwind can't see dynamic class
  names.
- Slots: default (body) and `footer`.

[`DashboardDeleteModal`](../shared/frontend/app/components/dashboard/DashboardDeleteModal.vue)
builds on it: description "This action is permanent", `i-lucide-alert-triangle` in `error`, a red
warning panel (`border-red-900/50 bg-red-950/50`, `text-red-300`) showing `warningText`, and a
**type-`DELETE`-to-confirm** input; the confirm button (labelled with `title`) stays disabled until
it matches.

```vue
<DashboardDeleteModal
	v-model:open="deleteConfirmOpen"
	title="Delete API Key"
	warning-text="Anything using this API key will stop working. This action cannot be undone."
	:on-delete="onDeleteApiKey"
/>
```

The `onDelete` contract: resolve → the modal closes (unless `preventAutoClose`); **throw** → it
stays open. The handler shows its own error toast, then throws:

```ts
async function onDeleteApiKey() {
	const apiKeyID = deleteTargetId.value;
	if (!apiKeyID) return;

	const res = await useAPI((api) => api.deleteAccountApikeysByApiKeyId({ path: { apiKeyID } }));
	if (!res.success) {
		toast.add({ title: "Failed to delete API key", description: res.message, color: "error" });
		throw new Error(res.message);
	}
	toast.add({ title: "API key deleted", color: "success" });
	await apiKeys.refresh();
}
```

### Feedback

- **Toasts:** `useToast().add({ title, description, icon: "i-lucide-…", color })` with `color`
  `"success"` / `"error"` / `"warning"`; icons `i-lucide-check`, `i-lucide-alert-circle`.
- **Empty state:** `UEmpty` with `:icon`/`:title`/`:description` and an `#actions` slot.
- **Loading:** `<UIcon name="i-lucide-loader-2" class="animate-spin …" />` in place of content;
  `:loading` on buttons; `NuxtLoadingIndicator color="var(--ui-primary)"` in the `auth` and
  `dashboard` layouts.
- **Error page:** `app/error.vue` → `<LayoutHeader>` + `<UMain class="flex-1"><UError :error="error"
  /></UMain>` + `<LayoutFooter>` on `main-bg-color`. Inside a page (e.g. a parent route that failed
  to load) render `<UError :error="error" />` instead of `<NuxtPage />`.

### Helpers

- **`<Gravatar>`** ([`components/Gravatar.vue`](../templates/nuxt-app/app/components/Gravatar.vue))
  — `UAvatar` props + `email`; resolves the Gravatar URL (`useGravatarURL`: SHA-256 of the trimmed,
  lower-cased address) without blocking render and falls back to the avatar's initials/icon:
  `<Gravatar :email="user.email" :alt="user.display_name" size="xl" />`.
- **`getRoleColor(role)`** ([`utils/roles.ts`](../templates/nuxt-app/app/utils/roles.ts)) — one
  source for role badge colors: `admin` → `error`, `user` → `primary`, else `neutral`. Use as
  `<UBadge :color="getRoleColor(role)" variant="soft">`.
- **`formatDate(ts)`** ([`utils/format.ts`](../templates/nuxt-app/app/utils/format.ts)) — en-US
  "Sep 25, 2026, 10:30 AM" style, `"-"` for empty; `formatDateISO` / `parseDateISO` for
  `datetime-local` inputs; `formatDuration(seconds)` → `45s` / `12m` / `3h` / `2d`.

### Public site

[`components/layout/Header.vue`](../templates/nuxt-app/app/components/layout/Header.vue):
`UHeader class="backdrop-blur-xl"` with `<ImgAppLogo class="h-8" />` in `#title` (UHeader links it
to `/`), `UNavigationMenu :items` in the default slot, a vertical copy in `#body` (mobile), and a
**user-aware `#right`**: signed-in users see their display name + a soft "Dashboard" button,
everyone else a solid "Login" button (`?url=` back to the current page).

[`components/layout/Footer.vue`](../templates/nuxt-app/app/components/layout/Footer.vue):
`USeparator` + `UFooter` with `UFooterColumns` — brand name (gradient), a one-line pitch and the
social ghost `UButton`s in `#left`, link columns (Product, Legal → legal.leicraftmc.de), and the
copyright row in `#bottom`.

Landing page ([`pages/index.vue`](../templates/nuxt-app/app/pages/index.vue)) sections:

- **Hero:** `relative flex min-h-[90vh] items-center overflow-hidden` with a radial top glow and
  two blurred orbs (`bg-primary-500/10 blur-3xl`); a soft `UBadge size="xl"` tagline; an
  `h1` (`text-4xl … md:text-7xl font-bold tracking-tight`) with a gradient word; the lead in
  `text-slate-400`; two `size="xl"` buttons (a user-aware primary CTA — "Open Dashboard" or
  "Get Started" — and an outline "Learn more"); a stats row in `text-primary-400`.
- **Gradient text:** `bg-linear-to-tr from-primary-400 to-primary-200 bg-clip-text
  text-transparent`.
- **Sections** alternate `bg-slate-950/50` with a `bg-linear-to-b from-transparent
  via-primary-500/5 to-transparent` overlay; each opens with a soft `UBadge` + `h2` + lead.
- **Feature cards:** a `UCard` grid (`border-slate-800 bg-slate-900/50 hover:-translate-y-1
  hover:border-primary-400/50`) with a `bg-primary-500/10` icon tile.

The hero's radial glow is hard-coded `rgba(56,189,248,0.15)` (sky-400) — adjust it if your primary
isn't `sky`.

### Static site styling

Static sites share the Tailwind v4 CSS-first setup (plus `@tailwindcss/typography`). Keep layouts
minimal; put project-specific branding (hero gradients, feature cards) in components, not global CSS.
The templates' idioms:

- **Layout:** `layouts/default.vue` is a flex column (`min-height: 100vh` via a scoped
  `.app-layout` class) on `main-bg-color`: `Header` + `UMain` (static-site: `py-8` + `UContainer`;
  with-docs: pages bring their own `UContainer`) + `Footer`.
- **Header:** `UHeader class="backdrop-blur-xl"`; `#title` = `LCMCIcon` (`h-10 w-10`) + the name in
  `text-3xl font-extrabold`; social ghost buttons (`hover:scale-110`) in `#right`, hidden below
  `lg` and repeated in the mobile `#body` menu. static-site-with-docs adds a solid primary "Docs"
  button.
- **Footer:** `UFooter class="mt-8 bg-neutral-900"`, centered `text-sm text-slate-500`:
  `© 2021 - {{ new Date().getFullYear() }} LeiCraft_MC. All rights reserved.` and Impressum |
  Datenschutz links (`hover:text-slate-300`).
- **`ProjectCard`:** a `NuxtLink` card (`bg-[#1a1b2e] rounded-lg p-6`, hover `bg-[#22233a]
  scale-[1.02]`) with logo, a status pill, title, slot text and tag chips (`bg-neutral-800
  text-neutral-300`).
- **Prose:** `prose prose-invert max-w-none` for Markdown/legal text; custom blocks inside prose
  (`IconCardGrid`, the docs prev/next) use `not-prose`.
- **Docs shell** (`DocsPage.vue`): sticky `w-56` sidebar with uppercase `text-xs text-slate-500`
  section labels and an active link `bg-sky-500/10 text-sky-400`; prev/next cards
  `border-slate-800 bg-slate-900/50 hover:border-sky-400/50`.

The static templates hard-code `sky-*` (status pills, docs sidebar, `IconCardGrid`) — switch those
to `primary-*` if the site's primary isn't `sky`.

### Domain-specific examples

- **Status indicators (Status-Page):** `StatusBadge` = `UBadge variant="soft"` + a leading `UIcon`,
  color/icon chosen from status; uptime bars = a row of per-day `UTooltip` buckets colored by
  status (`bg-emerald-500` up / `bg-red-500` down / `bg-amber-500` degraded / `bg-slate-600`
  unknown). Overall banner switches `rounded-2xl border p-6` classes on `overallStatus`.
- **Chat UI (MindCode):** message bubbles (`bg-slate-800/60 border border-slate-700/50 rounded-2xl`),
  collapsible thinking blocks (`<details>` with `i-lucide-brain` + a chevron that rotates on
  `group-open`), `ClaudeToolCall` showing input/output in `<pre>` (Edit diffs with red-removed /
  green-added), inline interactive cards (`ClaudePermissionCard` with Allow/Deny `UButton`), a
  `UTextarea` input whose submit `UButton` swaps to a stop button while processing, and a
  keyboard-navigable slash-command menu `Teleport`-ed to `body`.

## Checklist

- [ ] Logo assets come from `assets/logos/`; `favicon.ico`, `static/logo/icon.{svg,png}` and
      `AppLogo.vue` replaced with the project's mark and name.
- [ ] `primary` matches the project identity; `neutral: slate` everywhere; accents use `primary-*`.
- [ ] `.main-bg-color` value picked once in `main.css` and applied to every layout root;
      `theme-color` (static sites) matches it.
- [ ] Rubik is the default sans font.
- [ ] Only Lucide icons (`i-lucide-*`) used.
- [ ] Dark-only — `color-scheme: dark` + `colorMode` pinned to dark, no toggle.
- [ ] `Dashboard*` / `DataTable` / `DateRangePicker` copied from `shared/frontend/app/components/`,
      not re-invented; used by auto-import names.
- [ ] Dashboard pages = `UDashboardPanel` + `DashboardPageHeader` (+ `UDashboardToolbar` for
      sub-navigation) + `DashboardPageBody`.
- [ ] Forms use the row layout inside section cards; destructive actions in a danger-zone card
      behind `DashboardDeleteModal`, whose `onDelete` throws on failure.
- [ ] Modal icon colors via the static class map, never interpolated class names.
- [ ] Feedback via `useToast().add(...)`, `UEmpty`, `UError`.
