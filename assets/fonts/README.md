# Fonts

## Primary: Rubik

Rubik is the default sans-serif font across LeiCraftMC apps and sites.

Every Nuxt template uses `@nuxt/ui`, which **registers `@nuxt/fonts` automatically** (`fonts: true`
by default — no need to add it to `modules`). `@nuxt/fonts` scans `--font-*` CSS variables by
default, so declaring the family in `app/assets/css/main.css` is all that's required:

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme {
  --font-sans: "Rubik", sans-serif;
}
```

`@nuxt/fonts` resolves the family, downloads it from the default provider, and **self-hosts it
locally** — no manual `@font-face`, no Google Fonts `<link>`, and no `processCSSVariables` toggle
needed (not since @nuxt/fonts v0.11). Per-family overrides (provider, weights, subsets) go under
the `fonts` key in `nuxt.config.ts` if a project ever needs them.

## Fallback

A system sans fallback is included via the `sans-serif` keyword above. `@nuxt/fonts` also injects
automatic font-metric fallbacks (fontaine/capsize), so layout shift is minimized out of the box.

## Monospace

For code blocks and inline code, use the system monospace stack (`ui-monospace`, `SFMono-Regular`,
`Menlo`, `Consolas`, `monospace`). NuxtUI handles this automatically in `<UCode>` / `<UProse>`.