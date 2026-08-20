# Fonts

## Primary: Rubik

Rubik is the default sans-serif font across LeiCraftMC apps and sites. Load it in one of these ways:

1. **Self-host the variable font** in `public/fonts/rubik-var.woff2` and declare it in
   `app/assets/css/main.css`:

   ```css
   @font-face {
     font-family: "Rubik";
     src: url("/fonts/rubik-var.woff2") format("woff2-variations");
     font-weight: 300 900;
     font-style: normal;
     font-display: swap;
   }
   ```

2. **Google Fonts** via `nuxt.config.ts` `app.head.link` (only if self-hosting is impractical):

   ```ts
   app: {
     head: {
       link: [
         { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap" },
       ],
     },
   },
   ```

## Fallback

Always include a system sans fallback:

```css
@theme {
  --font-sans: "Rubik", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

## Monospace

For code blocks and inline code, use the system monospace stack (`ui-monospace`, `SFMono-Regular`,
`Menlo`, `Consolas`, `monospace`). NuxtUI handles this automatically in `<UCode>` / `<UProse>`.
