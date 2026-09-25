# 14 — Deployment

## Ports

Every app keeps its own 12xxx port in dev and prod, never `3000` (see
[02 — Ports](02-tooling.md#ports--one-unique-port-per-app-dev--prod)). Template defaults:

| Template | Port | Set in |
| --- | --- | --- |
| backend-service | 12500 | `APPPREFIX_API_PORT` (default), `docker/Dockerfile` `EXPOSE`, compose |
| nuxt-app | 12510 | `dev` / `start` scripts, `docker/Dockerfile` `ENV PORT` |
| fullstack-nuxt-app | 12520 | `dev` / `start` scripts, `docker/Dockerfile` `ENV PORT` |
| static-site | 12530 | `dev` only (deployed as files) |
| static-site-with-docs | 12531 | `dev` only (deployed as files) |
| cli-tool | — | — |

In production, run HTTP apps behind a reverse proxy (Nginx/Caddy/Traefik) that terminates TLS.

## Backend services

Backend services deploy as a **compiled Bun binary** (migrations embedded), usually inside a small
Docker image. There is no `bun run build` / `dist/` step.

### Compiled binary

Build with the compile script from [11 — CLI & infra](11-cli-and-infra.md#compiling-to-a-single-binary):

```bash
bun run compile linux-x64-baseline --no-version-tag
# → build/bin/my-project-api-linux-x64-baseline  (AppConstants.BINARY_NAME)
```

The binary embeds `drizzle/migrations` (`--asset`) and starts via `scripts/entrypoint.ts`, which
forces `APPPREFIX_DB_AUTO_MIGRATE=true`, so a fresh binary migrates its database on start. It can
run directly under systemd with the `APPPREFIX_*` variables in the unit's environment, or in the
Docker image below.

### Docker image

[`templates/backend-service/docker/Dockerfile`](../templates/backend-service/docker/Dockerfile) —
the binary on `debian:stable-slim`, no Bun runtime, no multi-stage build:

```dockerfile
FROM debian:stable-slim

ARG BINARY_NAME=my-project-api

RUN apt-get update && apt-get install -y curl ca-certificates openssl tar bash gpg

WORKDIR /opt/app

COPY ./build/bin/${BINARY_NAME}-linux-x64-baseline /usr/local/bin/app
RUN chmod u+x /usr/local/bin/app

EXPOSE 12500/tcp

ENTRYPOINT ["app"]
```

`BINARY_NAME` must match `AppConstants.BINARY_NAME`; override with
`--build-arg BINARY_NAME=...` if they differ.

[`docker/docker-compose.yml`](../templates/backend-service/docker/docker-compose.yml) runs it
locally (`docker compose -f docker/docker-compose.yml up --build`, after compiling):

```yaml
services:
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "12500:12500"
    environment:
      APPPREFIX_LOG_LEVEL: info
      APPPREFIX_API_HOST: "::"
      APPPREFIX_API_PORT: "12500"
      APPPREFIX_APP_URL: http://localhost:12510
      APPPREFIX_DB_PATH: /data/db.sqlite
      APPPREFIX_DB_AUTO_MIGRATE: "true"
      APPPREFIX_LOG_DIR: /data/logs
      APPPREFIX_CONFIG_BASE_DIR: /data/config
    volumes:
      - ./data:/data
    restart: unless-stopped
```

- `APPPREFIX_APP_URL` (required) is the **frontend's** public URL — used for CORS and for the
  password-reset links in emails.
- Everything stateful lives under `/data`: the SQLite DB, logs and `CONFIG_BASE_DIR` (the first
  start writes the initial admin's reset link to `/data/config/initial_admin_password_reset_token.txt`
  and logs it).
- The compose file publishes the port on all interfaces. On a server with a reverse proxy on the
  same host, bind loopback instead: `"127.0.0.1:12500:12500"`.

### CI

GitLab's `build.service.yml` compiles `linux-x64-baseline`, builds the image and pushes
`$CI_REGISTRY_IMAGE:latest` — from the **default branch only**, with no version tags and no image
signing ([13](13-git-and-ci.md#ci--gitlab)). Projects that publish images publicly add version tags
and cosign signing themselves (Vault does: `cosign sign --yes <tag>@<digest>`, pre-releases skip
`:latest` — see [11](11-cli-and-infra.md#infrastructure--backup-tools)).

## Nuxt apps

The Bun Nitro preset is selected in the **build script**, not in `nuxt.config.ts`:

```json
{
	"build": "nuxt build --preset bun",
	"start": "PORT=12510 bun run .output/server/index.mjs"
}
```

The Nitro server reads its port from the `PORT` env var — there is no `--port` flag for
`.output/server/index.mjs`. `.output/` is self-contained (no `node_modules` needed at runtime).

[`templates/nuxt-app/docker/Dockerfile`](../templates/nuxt-app/docker/Dockerfile):

```dockerfile
FROM oven/bun:1-slim

WORKDIR /app

COPY ./.output ./.output

ENV PORT=12510

EXPOSE 12510/tcp

CMD ["bun", "run", ".output/server/index.mjs"]
```

Run `bun run build` before `docker build` (GitLab's `build.docker.yml` does both and pushes
`:latest` from the default branch). Point the app at its API at runtime with
`NUXT_PUBLIC_API_URL` / `NUXT_PUBLIC_APP_URL` — Nuxt overrides `runtimeConfig.public` from
`NUXT_PUBLIC_*` env vars.

### Full-stack Nuxt (Hono in `server/`)

The full-stack shape deploys as **one** image: the Hono API ships inside the same `.output/` and
runs in the same Bun process — no separate backend service.
[`templates/fullstack-nuxt-app/docker/Dockerfile`](../templates/fullstack-nuxt-app/docker/Dockerfile)
adds only the migrations, which `DB.init` reads from `./drizzle/migrations`:

```dockerfile
FROM oven/bun:1-slim

WORKDIR /app

COPY ./.output ./.output
COPY ./drizzle/migrations ./drizzle/migrations

ENV PORT=12520

EXPOSE 12520/tcp

CMD ["bun", "run", ".output/server/index.mjs"]
```

`/api/*` is served by Hono (the Nitro catch-all `server/routes/api/[...].ts`); everything else by
Nuxt. Keep `nitro.rollupConfig.external: ["bun:sqlite"]` in `nuxt.config.ts` so the native SQLite
binding isn't bundled. Running it:

```bash
docker run -d -p 127.0.0.1:12520:12520 \
  -e APPPREFIX_APP_URL=https://app.example.com \
  -e NUXT_PUBLIC_APP_URL=https://app.example.com \
  -e APPPREFIX_CONFIG_BASE_DIR=/app/data/config \
  -v "$PWD/data:/app/data" \
  registry.example.com/group/project:latest
```

- `APPPREFIX_APP_URL` configures the API (CORS, reset links). The frontend's
  `runtimeConfig.public.appUrl` is read from `APPPREFIX_APP_URL` **at build time** only — set
  `NUXT_PUBLIC_APP_URL` at runtime too, or the browser calls the build-time default
  (`http://localhost:12520/api/v1`).
- Relative paths resolve against `/app`: DB and logs default to `/app/data/…`; point
  `CONFIG_BASE_DIR` into the same volume.
- The template's `scripts/compile/` + `scripts/entrypoint.ts` do **not** produce a working binary
  (see [11](11-cli-and-infra.md#entrypoint-script)) — deploy `.output/` as above.

### Dual-target (Bun + Cloudflare Pages)

An optional **project pattern** (Status-Page), not a template feature. When the same full-stack app
ships to both Bun and Cloudflare Pages/D1, provide two build scripts and let the pipeline pick one:

```json
{
	"build:bun": "nuxt build --preset bun",
	"build:cf": "nuxt build --preset cloudflare_pages"
}
```

Keep `nitro.rollupConfig.external: ["bun:sqlite", "cloudflare:sockets"]`, branch `DB.init` on
`Runtime.isBun` ([`shared/backend/src/utils/runtime.ts`](../shared/backend/src/utils/runtime.ts),
unused by the templates), and maintain one drizzle-kit config per runtime — see
[08 — Dual-target runtime](08-database.md#dual-target-runtime-bun--cloudflared1).

## Static sites

Both static templates set the static Nitro preset and prerender:

```ts
export default defineNuxtConfig({
	nitro: {
		preset: "static",
		prerender: { routes: ["/projects/example"] }, // static-site-with-docs: crawlLinks: true
	},
});
```

`bun run generate` (`nuxt generate`) writes the site to `.output/public/`. GitLab's
[`build.static.yml`](../shared/config/gitlab-ci/build.static.yml) builds and deploys in one job on
the default branch:

```yaml
build_and_deploy_pages:
  stage: build
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      when: always
      allow_failure: false
    - when: never
  before_script:
    - apt update && apt upgrade -y
    - apt install -y rsync sshpass openssh-client
    - bun install --frozen-lockfile
  script:
    - bun run generate
    - bash .gitlab/ci/deploy.sh
```

[`.gitlab/ci/deploy.sh`](../shared/config/gitlab-ci/deploy.sh) checks `DEPLOY_REMOTE_USER`,
`DEPLOY_REMOTE_PASSWORD`, `DEPLOY_REMOTE_HOST` and `DEPLOY_REMOTE_DIR` (set them as masked CI
variables), then mirrors the output:

```bash
sshpass -p "$DEPLOY_REMOTE_PASSWORD" rsync -avz \
	--delete \
	-e "ssh -o StrictHostKeyChecking=no" \
	"$LOCAL_DIR" \
	"$DEPLOY_REMOTE_USER@$DEPLOY_REMOTE_HOST:$DEPLOY_REMOTE_DIR"
```

`--delete` removes remote files that are no longer generated. rsync exit code 23 (partial transfer,
e.g. no permission on the remote root dir) is tolerated; any other non-zero code fails the job.
The job runs the script via `bash`, so it needs no executable bit.

The target is an Apache host: [`public/.htaccess`](../templates/static-site/public/.htaccess) is
copied into the output and

- lets `/.well-known/` (ACME) through untouched;
- 301-redirects trailing slashes (`/about/` → `/about`) and `…/index.html` to the clean URL;
- serves `/folder/index.html` for `/folder` and `/about.html` for `/about` (clean URLs, with
  `DirectorySlash Off` and no directory listings);
- uses `/404.html` as the 404 page.

Other hosts (S3, GitLab Pages, Nginx) work too — upload `.output/public/` and replicate the
clean-URL rules.

## CLI tools

Distribute compiled binaries via GitHub Releases. The
[`shared/config/github-actions/release.yml`](../shared/config/github-actions/release.yml) workflow
runs on a `v*` tag, compiles every platform with `bun run compile all --no-version-tag` and
attaches `build/bin/*` to the release. The binaries report `package.json`'s `"version"` (templates
ship `0.1.0`), not the tag — bump it first:

```bash
# bump "version" in package.json to 1.2.3, commit, then:
git tag v1.2.3
git push origin v1.2.3
```

## Environment in production

- Pass config as environment variables (container env, systemd unit), never baked into the image.
  The backend and full-stack shapes require `APPPREFIX_APP_URL`; the rest have defaults
  ([09](09-config-and-logging.md)).
- Booleans use `z.coerce.boolean()`: any non-empty value — **including `"false"`** — is true; set
  the variable empty to get false. Unset means the default.
- Keep the SQLite database (and `CONFIG_BASE_DIR`) on a persistent volume.
- **Auto-migration.** `DB_AUTO_MIGRATE` defaults to `true`. The backend's `scripts/entrypoint.ts`
  forces it to `true` for `bun run start` and the compiled binary, and the compose file sets it too;
  the full-stack image runs `.output/` directly, so there the env var (default `true`) decides. That
  is right for the normal single-instance SQLite deployment. Turn it off when migrations must run as
  a separate step — e.g. several processes sharing one database, or a manual `bun run db:migrate`
  before a risky release: set `APPPREFIX_DB_AUTO_MIGRATE=` (empty) and, for the backend binary,
  remove the override from `scripts/entrypoint.ts`.

## Health checks

The backend exposes `/health` with the standard envelope:

```json
{ "success": true, "code": 200, "message": "<ProjectName> API is running", "data": null }
```

In the full-stack app the same route is `/api/health` (bare `/api` is not routed — Nitro's
catch-all needs `/api/...`); while the API is still starting it answers `503` with
`"API is starting, please retry shortly"`. The standalone Nuxt app and static sites have no health
route — probe `/`. Point load balancer / container health checks at these URLs; the templates
define no Docker `HEALTHCHECK` (the backend image has `curl` if you add one).

## Checklist

- [ ] App uses its own 12xxx port everywhere (scripts, Dockerfile, compose, env).
- [ ] Backend: `bun run compile linux-x64-baseline --no-version-tag` + `docker/Dockerfile`
      (`ARG BINARY_NAME` = `AppConstants.BINARY_NAME`); no `dist/` build.
- [ ] Backend compose/env sets `APPPREFIX_APP_URL` and keeps `/data` on a volume.
- [ ] Images pushed as `:latest` from the default branch; version tags + cosign only if the
      project publishes images.
- [ ] Nuxt: `build` = `nuxt build --preset bun`, `start` = `PORT=<port> bun run
      .output/server/index.mjs`; image on `oven/bun:1-slim`.
- [ ] Full-stack: one image with `.output/` + `drizzle/migrations`; `bun:sqlite` external;
      `NUXT_PUBLIC_APP_URL` set at runtime.
- [ ] Static site: `nitro.preset: "static"`, `bun run generate` → `.output/public/`, `deploy.sh`
      with the `DEPLOY_REMOTE_*` variables, `public/.htaccess` for Apache.
- [ ] CLI: `package.json` version bumped, then `v*` tag → GitHub Release.
- [ ] Config injected at runtime via env vars; booleans set empty for false.
- [ ] Auto-migration off (and migrations run separately) if more than one process shares a DB.
- [ ] `/health` (`/api/health` full-stack) monitored.
