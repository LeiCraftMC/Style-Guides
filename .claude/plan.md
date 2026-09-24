# Plan: Update Nuxt frontend templates

## Goal
Bring `templates/nuxt-app/` and `templates/fullstack-nuxt-app/` frontends up to the same richness as the reference projects in `lcmc-refs`, while preserving intentional changes already made in the templates (Biome style, API-client generation differences, etc.).

## Scope
Only the **frontend** side of the two templates (everything under `app/` plus supporting config that affects the frontend). Backend/server code in `fullstack-nuxt-app` is out of scope unless a small config change is needed for consistency.

## Reference projects used
- `leicraftmc/LeiOS/Hub-Website` — dashboard + landing-page pattern, `UDashboardSidebar`, `UAuthForm`, user store, admin sections.
- `github/Delivr-Project/Delivr-Web` — richer dashboard components, route groups `(app)`, mail-specific stores (we will take general patterns only).
- `github/Delivr-Project/Website` — static/marketing site pattern (not used here, already covered by `static-site` templates).

## Current gaps
1. `useAPI.ts` still uses the old message-matching 401 rule; docs + `shared/frontend/useAPI.ts` require **any `code === 401`** redirect.
2. `nuxt-app/app/composables/updateAPIClient.ts` builds the API URL from `appUrl + "/api/v1"`. For a standalone frontend that talks to `backend-service`, it should use `apiUrl` directly (the runtime config already provides both). `fullstack-nuxt-app` correctly keeps `appUrl + "/api/v1"`.
3. `auth.global.ts` only checks `getHealth`. It should:
   - allow public routes (`/auth/*`, `/` landing page, static assets),
   - redirect already-authenticated users away from `/auth/*`,
   - validate the session on protected routes (`/dashboard/*`) via a user store,
   - enforce admin-only sections (`/dashboard/admin/*`).
4. No user store exists.
5. Layouts are minimal: missing `dashboard.vue`, richer `default.vue` with `Header`/`Footer`, richer `auth.vue`.
6. Missing components: `layout/Header.vue`, `layout/Footer.vue`, `dashboard/UserMenu.vue`, `dashboard/DashboardPageHeader.vue`, `dashboard/DashboardPageBody.vue`, `img/AppLogo.vue` variant.
7. Pages are minimal: missing `/dashboard`, `/dashboard/settings`, `/dashboard/admin/users`, richer `/auth/login`, forgot/reset/signup pages.
8. Missing `app/utils/index.ts` with small shared helpers.
9. `nuxt-app` has **no committed `app/api-client/`**, so the existing `useAPI.ts` import cannot type-check. `fullstack-nuxt-app` already has one generated from its own backend.

## Proposed changes

### Phase 1 — Core plumbing (ask before each edit)
1. **`app/composables/useAPI.ts`** (both templates): replace with `shared/frontend/useAPI.ts` (uses any-401 rule). This is a behavioral fix.
2. **`app/composables/updateAPIClient.ts`**:
   - `nuxt-app`: change to use `apiUrl` directly from `useRuntimeAppConfigs()`.
   - `fullstack-nuxt-app`: keep `appUrl + "/api/v1"` but sync style with shared version.
3. **`app/composables/useRuntimeAppConfigs.ts`**:
   - `nuxt-app`: keep `{ apiUrl, appUrl }`.
   - `fullstack-nuxt-app`: currently returns `config.public` (untyped). Propose typed `{ appUrl }` to match docs, or keep `config.public` if you prefer the open shape.
4. **`app/middleware/auth.global.ts`** (both): replace health-check guard with user-store-based guard that handles public routes, `/auth` redirect-when-logged-in, `/dashboard` validation, and `/dashboard/admin` admin checks.
5. **`app/middleware/rewrites.global.ts`**: already matches shared — no change.
6. **`app/utils/abstractStore.ts`** and **`app/utils/routeMatcher.ts`**: already match shared — no change (just formatting sync if needed).

### Phase 2 — Stores and utilities (new files)
7. **`app/composables/stores/useUserStore.ts`** (both): add a `ModifiableAbstractStore` that calls `api.getAccount()` / `api.getAuthSession()` (fullstack shape; for nuxt-app the same endpoints will exist once its api-client is generated from backend-service).
8. **`app/utils/index.ts`** (both): add generic helpers (formatDate, formatDateTime, truncate, hasAdminAccess, hasModeratorAccess, copyToClipboard, formatFileSize). Keep it small and project-agnostic.
9. **`app/composables/useAwaitedComputed.ts`** (both): add from `shared/frontend/useAwaitedComputed.ts` — useful for derived async state.

### Phase 3 — Layouts and components (new + edits)
10. **`app/layouts/default.vue`** (both): replace with Header + UMain + Footer layout (marketing/landing shell). Existing simple header content moves into the new `Header` component.
11. **`app/layouts/auth.vue`** (both): enrich with Header/Footer + centered card (like Hub-Website). Keep `UPageCard` fallback if you prefer a bare card.
12. **`app/layouts/dashboard.vue`** (both): new layout with `UDashboardSidebar`, navigation groups (Overview, Settings, Admin), logo, UserMenu in footer.
13. **`app/components/layout/Header.vue`** (both): new component with logo, nav links (Home, Dashboard), auth-aware right side (Dashboard button / Login button).
14. **`app/components/layout/Footer.vue`** (both): new component with project links/copyright. Keep minimal if you prefer.
15. **`app/components/dashboard/UserMenu.vue`** (both): new component using `UDropdownMenu`, logout action, link to settings.
16. **`app/components/dashboard/DashboardPageHeader.vue`** and **`DashboardPageBody.vue`** (both): new wrappers from `shared/frontend/*.example.vue`.
17. **`app/components/img/AppLogo.vue`**: keep, maybe add an `AppIcon.vue` sibling.
18. **`app/app.vue`**: add `<NuxtLoadingIndicator color="#00bcff" />` (optional — ask).
19. **`app/error.vue`**: keep `UError` but sync typed `NuxtError` prop from fullstack.

### Phase 4 — Pages (new + edits)
20. **`app/pages/index.vue`** (both): replace simple health-card landing with a real marketing landing page (hero, feature cards, CTA). Keep the health demo if wanted, but probably remove it from the landing page.
21. **`app/pages/dashboard/index.vue`** (both): new dashboard overview page (welcome, stats cards placeholder, quick actions).
22. **`app/pages/dashboard/settings.vue`** and **`dashboard/settings/index.vue`**, **`dashboard/settings/security.vue`** (both): new pages for account edit + password change.
23. **`app/pages/dashboard/admin/users.vue`** and **`dashboard/admin/users/[id].vue`** (both): new admin user list + edit pages (role-aware).
24. **`app/pages/auth/login.vue`** (both): replace simple form with `UAuthForm` + Zod schema, remember-me checkbox, forgot-password link, optional signup link.
25. **`app/pages/auth/forgot-password.vue`**, **`auth/reset-password.vue`**, **`auth/signup.vue`** (both): new pages wired to generated auth endpoints.

### Phase 5 — API client for nuxt-app
26. `nuxt-app` currently has **no committed `app/api-client/`**. The template references it in `useAPI.ts` and will not type-check. Propose either:
    - **A.** Run the backend-service template locally and generate the client into `nuxt-app/app/api-client/` (committed, as docs require).
    - **B.** Leave generation to the user and add a prominent README/CLAUDE note that the first step after copying is `bun run api-client:generate`.
    The recommendation is **A** if we can spin up backend-service; otherwise **B** plus a placeholder note.

### Phase 6 — Config, docs, verification
27. Verify `nuxt.config.ts` runtime config matches the shape used by the composables:
    - `nuxt-app`: keep `{ apiUrl, appUrl }`.
    - `fullstack-nuxt-app`: keep `{ appUrl }`; optionally add `apiUrl` for symmetry but it is unused.
28. Add/update `CLAUDE.md` in both templates with the frontend conventions and the “delete what you don’t need” note.
29. Run `/verify` (Biome + typecheck) for both templates and fix issues.

## User decisions
Confirmed during plan review:

1. **`nuxt-app` API URL**: Use `apiUrl` directly (matches backend-service references and docs).
2. **API client for `nuxt-app`**: Generate and commit it now by running backend-service + `openapi-ts`.
3. **Dashboard examples**: Rich — overview, account settings, password change, admin users list/edit, API keys placeholder. Users can delete what they don’t need.
4. **Landing page style**: Marketing/hero landing page inspired by the reference websites (LeiOS, Hub, Personal Website, Delivr).
5. **Still to confirm during implementation**:
   - **Fullstack `useRuntimeAppConfigs`**: Return typed `{ appUrl }` or keep open `config.public`?
   - **Auth page richness**: Include forgot-password, reset-password, and signup pages, or only login?
   - **Onboarding page**: Fullstack backend has an onboarding preference endpoint. Add a `/welcome` onboarding page, or skip it?
   - **Delete-vs-keep policy**: I will ask before deleting any existing file or before editing any file whose current content you might want to preserve. Is that the right cadence, or do you want a batch list first?

## Progress log
- **Session 2 (2026-09-24)** — user approved Phase 1 edits 1–7 ("continue").
  - DONE 1+2: `app/composables/useAPI.ts` in both templates = copy of `shared/frontend/useAPI.ts` (any-401 rule).
  - DONE 3: `nuxt-app` `updateAPIClient.ts` → `baseURL = <apiUrl>/v1` (backend-service mounts versions at `/v1`, no `/api`; `apiUrl` env stays the backend origin).
  - DROPPED 4: both `updateAPIClient.ts` were already identical to shared — nothing to sync.
  - DROPPED 5: fullstack `useRuntimeAppConfigs.ts` already returns typed `{ apiUrl, appUrl }` (the earlier plan misread it).
  - BLOCKED 6+7 (guard): needs `composables/stores/useUserStore.ts` + `utils/types.ts` (`UserInfo`). Fullstack blocked on client question below.
- **Findings**
  - Fullstack `openapi-ts.config.ts` uses `@hey-api/client-fetch` (user commit 78970fb, which also deleted fullstack `scripts/patch-api-client.ts`). client-fetch uses `baseUrl`/`throwOnError`/`responseStyle` and returns `{ data, error, request, response }` — not the envelope. So fullstack `updateAPIClient` (`baseURL`, `ignoreResponseError`) fails typecheck and `result.success` never works. All references (MindCode, Status-Page = fullstack; Hub, Delivr = standalone) use `client-nuxt`. → ASK user.
  - Fullstack typecheck baseline (before any edit): `updateAPIClient.ts` baseURL ×2, `auth.global.ts` `getHealth` missing, backend `server/lib/utils/crypto/{cryptoKeys,signature}.ts` TS4114 missing `override`.
  - `getHealth` is not in either v1 SDK (backend-service `/health` lives outside the versioned router).
  - No signup/register endpoint exists in the backend; forgot/reset (`postAuthResetPasswordRequest`, `postAuthResetPassword`) and onboarding (`get/putAccountPreferencesOnboarding`) do.
  - Fullstack already has `utils/{types,roles,format,url}.ts`; `format.ts` carries Status-Page-specific helpers (incident/maintenance colors).
  - Template `abstractStore.ts`/`routeMatcher.ts` differ from shared only by formatting (4-space, not Biome-formatted); fullstack `routeMatcher.ts` has an unused `createRouterMatcher` import.
  - `nuxt-app` has no `node_modules` yet (needs `bun install` before typecheck / api-client generation).
- **Session 2, later** — user answers: fullstack back to `@hey-api/client-nuxt` (DONE, regenerated in-process); guard as proposed (DONE both); extra pages = forgot+reset, signup (UI only), /welcome; add 2 `override`s in fullstack crypto (DONE); NO patch script in fullstack (upstream 0.99.0 still has the sdk.gen typing bug → 22 errors stay until upstream fix); Phase 3 replacements approved for default.vue, auth.vue, error.vue, AppLogo.vue (DONE both); trim fullstack format.ts to generic helpers + copy to nuxt-app (DONE); plain `ProjectName` placeholder.
  - DONE Phase 2/3 files (both templates, identical): stores/useUserStore.ts, utils/types.ts (nuxt-app new), utils/{format,roles,url}.ts (nuxt-app copies), layouts/dashboard.vue, components/{layout/Header,layout/Footer,dashboard/{UserMenu,DashboardPageHeader,DashboardPageBody,DashboardModal,DashboardDeleteModal,DataTable},form/DateRangePicker,Gravatar,img/AppIcon}.vue, composables/{useGravatarURL,useDefaultOnFormError,useAwaitedComputed}.ts. Components use Nuxt auto-import names (Biome flags template-only imports as unused).
  - DONE Phase 5: nuxt-app `bun install` + api-client generated from backend-service (needed `APPPREFIX_API_DISABLE_DOCS=` override, see below).
  - Findings: backend-service AND fullstack `config.ts` use `z.coerce.boolean()` → "false" parses as true (DISABLE_DOCS=false disables docs). `@unhead/vue` 3.4.1 ships a broken .d.ts (swapped 3.4.0 into nuxt-app node_modules locally for verification). **`vue-tsc` under Bun never checks `.vue` files** (volar's runTsc fs.readFileSync hook is bypassed by Bun's loader) → template `typecheck` scripts only check .ts. Verification helper: scratchpad `vue-tsc-bun.cjs <node_modules> --noEmit -p .nuxt/tsconfig.app.json`. nuxt-app patch-api-client.ts no longer covers client.gen.ts SSE `credentials` getter type (1 error). shared/frontend *.example.vue are broken (nested quotes in :ui, NuxtUI v2 API in DataTable) — not touched (shared is a later step).
  - Current vue-tsc state (both): all new files clean; remaining = old pages/index.vue + pages/auth/login.vue (Phase 4 replacements), client.gen.ts SSE credentials, fullstack +22 upstream sdk.gen.ts.
- **Session 2, Phase 4** — user answers: replace index.vue + login.vue (DONE); /welcome page + guard gate (DONE, `REQUIRE_ONBOARDING`/`ONBOARDING_ROUTE` consts, useOnboardingStore); fix `z.coerce.boolean` in both backends (DONE → `z.union([z.boolean(), z.stringbool()])`, both test suites 56/56); leave nuxt-app SSE `credentials` error (upstream).
  - DONE pages (both templates, identical): index (landing), auth/{login,forgot-password,reset-password,signup(UI only)}, welcome (+layouts/onboarding.vue), dashboard/{index,settings(+settings/index, settings/security),apikeys/{index,[api_key_id],[api_key_id]/index},admin/users}. API keys live at /dashboard/apikeys (settings.vue is a parent route with its own panel). Composables added: useSubrouterInjectedData, useSubrouterPathDynamics (Hub), usePageSeo (shared).
  - Verified: vue-tsc (Bun runner) clean in both except upstream generated-client errors; fullstack `nuxt build --preset bun` OK; prod server smoke test OK (landing SSR anon + signed-in, 404 page, /welcome gate redirects, onboarding completion → /dashboard).
  - Biome gotcha found: `useImportType` safe-fix turns an import used as a type in <script> and as a value in <template> into `import type` (broke admin/users.vue schema). Fixed by referencing such values in <script> (`const createSchema = zPostAdminUsersBody`). Template-only vars/imports show as Biome *warnings* (noUnused*), never errors.
  - Findings for user: fullstack `server/routes/api/[...].ts` caches an empty Hono wrapper if the first /api request arrives before API.init → all /api 404 until restart. `bunx --bun nuxt dev` fails on Windows (Bun treats the CLI worker path as a package spec). Fullstack api-client-generate.ts `Bun.write` not awaited. Pre-existing Biome *format* errors in user files (main.css, useAppCookies.ts, rewrites.global.ts, abstractStore.ts, routeMatcher.ts, utils/{format,roles,url}.ts). Personal-Website not in lcmc-refs.
  - OPEN (ask): fix api catch-all bug; run Biome format on pre-existing files; update template CLAUDE.md/README; Bun-compatible vue-tsc in templates (maybe with shared/docs step).
- **Session 2, wrap-up** — user answers: fix catch-all (DONE: wrapper cached only after `API.getApp()` succeeds, 503 envelope while starting; fullstack tests 56/56); `biome format --write app` in both + drop unused `createRouterMatcher` import (DONE; `biome check app` = 0 errors in both, only template-usage warnings); Frontend section in both README.md + CLAUDE.md (DONE); Bun-compatible vue-tsc → LATER with shared/docs step.
  - Still open for the shared/docs step: vue-tsc under Bun; shared/frontend *.example.vue bugs; docs/06 auth.global example is outdated (health-check guard); docs should mention the Biome/Vue `useImportType` gotcha; README stale bits (port 3000, `db:push`, fullstack api-client "reads localhost:3000"); fullstack api-client-generate `Bun.write` not awaited; `bunx --bun nuxt dev` on Windows; `@unhead/vue` 3.4.1 broken types (upstream); nuxt-app SSE `credentials` + fullstack 22 sdk.gen errors (upstream hey-api).

## Implementation order
1. Phase 1 core plumbing (ask per file).
2. Phase 2 stores/utilities (mostly new files, so low risk).
3. Phase 3 layouts/components (new files first, then edits to existing layouts — ask before edits).
4. Phase 4 pages (new files first, then edits to existing pages — ask before edits).
5. Phase 5 api-client for nuxt-app (depending on your answer).
6. Phase 6 verify and document.
