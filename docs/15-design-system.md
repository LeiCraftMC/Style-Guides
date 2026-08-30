# 15 — Design system and brand

## Brand assets

Brand assets live in [`assets/`](../assets/):

```
assets/
  logos/
    lcms-logo.svg          # LeiCraftMC pixel-art logo
    lcms-logo-mark.svg     # icon-only mark
    lcms-wordmark.svg      # text-only wordmark
  colors/
    palette.md             # hex values
  fonts/
    rubik/                 # primary sans (variable if available)
```

Use the official assets in apps and sites. Do not recreate the logo with a different font or shape.

## Colors

Primary colors are project-specific, but the neutral palette and dark background are consistent:

| Token | Value | Usage |
| --- | --- | --- |
| `neutral` | `slate` | text, borders, subtle surfaces |
| `background` | `rgb(2 6 23)` (`slate-950`) | main app background |
| `primary` | `sky` / `emerald` / `orange` | CTAs, active states, project identity |

Project primaries:

- **LeiOS / Delivr / LeiCraftMC sites** — `sky`
- **NowIP** — `emerald`
- **MindCode** — `orange`

The `.main-bg-color` utility (the app background) is also per-project — most use `rgb(2 6 23)`
(slate-950), Delivr uses pure black `rgb(0 0 0)`, and Personal-Website uses `#0b0c1b`. Pick one and
apply it consistently to the layout root.

## Typography

Default sans font is **Rubik**. Declare it in `app/assets/css/main.css`:

```css
@theme {
	--font-sans: "Rubik", sans-serif;
}
```

Load the font via `nuxt.config.ts` `app.head.link` or self-host the variable font in
`public/fonts/`.

## NuxtUI configuration

Copy [`shared/frontend/app.config.ts`](../shared/frontend/app.config.ts) and tune only `primary`:

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
that case, add a single-purpose component in `components/img/`.

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
by default. `nuxt.config.ts` may additionally set `app.head.htmlAttrs.class: "dark"`.

## Favicons and PWA icons

Use the SVG mark from `assets/logos/lcms-logo-mark.svg` as the base. Generate `favicon.ico`,
`icon-192.png`, and `icon-512.png` for Nuxt's `app.head.link` / `pwa` module.

## Static site styling

Static sites share the same Tailwind v4 CSS-first setup. Keep layouts minimal; put project-specific
branding (hero gradients, feature cards) in scoped components, not global CSS overrides.

## Component idioms

The real apps share a set of UI idioms built on NuxtUI v4. Canonical copy-paste versions of the
`Dashboard*` and `DataTable` components live in [`shared/frontend/`](../shared/frontend/) (as
`*.example.vue`) — copy them in rather than re-inventing.

### Dashboard shell

`UDashboardGroup` + `UDashboardSidebar` (collapsible, resizable; `:ui` overriding
`header`/`body`/`content`/`footer` to `main-bg-color`; min/default/max 18/20/30) with
`UNavigationMenu` vertical groups and a `UserMenu` (`UDropdownMenu`) in `#footer`. Sidebar items are
`NavigationMenuItem[]` with `i-lucide-*` icons, `to`, `badge`, and `type: "label"`/`"trigger"`
section headers.

### Dashboard page

Every dashboard page uses `UDashboardPanel` with `#header` and `#body` slots:

```vue
<UDashboardPanel>
	<template #header>
		<DashboardPageHeader title="API Keys" icon="i-lucide-key" description="Manage your API keys" />
	</template>
	<template #body>
		<DashboardPageBody> <!-- = <div class="space-y-6"><slot/></div> -->
			<!-- … -->
		</DashboardPageBody>
	</template>
</UDashboardPanel>
```

`DashboardPageHeader` wraps `UDashboardNavbar` (`#leading`/`#title`/`#trailing` slots + optional
`UBreadcrumb`).

### Data table

A generic `DataTable.vue` (`<script setup generic="T extends Record<string, any>">`) wraps `UTable`
(TanStack) in `UCard`, with a `filters` prop (`text` / `select` / `multi-select` / `date` / `number`)
rendered in `#header`, dynamic `${column}-cell` slot passthrough, `UPagination` + a page-size
`USelect` in `#footer`, and a `UEmpty` empty state. Loading = `<UIcon name="i-lucide-loader-2"
class="animate-spin" />`.

### Forms

`UForm` + a zod schema + `UFormField`, with `@submit` typed as `FormSubmitEvent<Schema>`. Use local
`reactive()` for the form state — that is fine (the "no static `reactive()` stores" rule is about
**shared/SSR** state, not component-local form/UI state):

```vue
<UForm :schema="schema" :state="form" @submit="onSubmit" class="divide-y divide-slate-800">
	<UFormField name="username" label="Username" required>
		<UInput v-model="form.username" class="w-full sm:w-96" />
	</UFormField>
	<UButton label="Save" color="primary" type="submit" :loading="loading" icon="i-lucide-save" />
</UForm>
```

### Modals

`DashboardModal` wraps `UModal` (`v-model:open`, `:title`, `:description`, `icon`, `iconColor`,
`loading`); `DashboardDeleteModal` builds on it with a **type-`DELETE`-to-confirm** input and a red
warning panel (`bg-red-950/50 border-red-900/50`).

### Feedback

- **Toasts:** `useToast().add({ title, description, icon: "i-lucide-…", color: "success" | "error" })`.
- **Empty state:** `UEmpty` with `:icon`/`:title`/`:description` and a `#actions` slot.
- **Error page:** `app/error.vue` → `<UError :error="error" />` on a `main-bg-color` background.

### Public site

`UHeader` (`#title` logo NuxtLink, `UNavigationMenu :items` in the default slot, `#body` vertical
mobile menu, `#right` social `UButton`s + CTA) + `UMain`/`UContainer` + `UFooter`/`UFooterColumns`.
Marketing pages use sectioned `UContainer` blocks with gradient-clip headlines
(`bg-linear-to-tr from-sky-400 to-sky-200 bg-clip-text text-transparent`) and `UCard` feature grids.

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

- [ ] Logo assets come from `assets/logos/`.
- [ ] `primary` matches the project identity; `neutral: slate` everywhere; `.main-bg-color` picked and consistent.
- [ ] Rubik is the default sans font.
- [ ] Only Lucide icons (`i-lucide-*`) used.
- [ ] Dark-only — `color-scheme: dark` + `colorMode` pinned to dark, no toggle.
- [ ] Favicons generated from the official mark.
- [ ] `Dashboard*` / `DataTable` components copied from `shared/frontend`, not re-invented.
