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

All apps are dark-first. `main.css` sets `color-scheme: dark` on `:root`. NuxtUI's `colorMode: true`
adds a toggle if needed. Avoid building separate light themes; components should look correct in
`slate-950` by default.

## Favicons and PWA icons

Use the SVG mark from `assets/logos/lcms-logo-mark.svg` as the base. Generate `favicon.ico`,
`icon-192.png`, and `icon-512.png` for Nuxt's `app.head.link` / `pwa` module.

## Static site styling

Static sites share the same Tailwind v4 CSS-first setup. Keep layouts minimal; put project-specific
branding (hero gradients, feature cards) in scoped components, not global CSS overrides.

## Checklist

- [ ] Logo assets come from `assets/logos/`.
- [ ] `primary` matches the project identity; `neutral: slate` everywhere.
- [ ] Rubik is the default sans font.
- [ ] Only Lucide icons (`i-lucide-*`) used.
- [ ] Dark-first via `color-scheme: dark`.
- [ ] Favicons generated from the official mark.
