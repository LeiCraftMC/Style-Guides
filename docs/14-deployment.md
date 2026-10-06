# 14 — Deployment

## Ports

Every app keeps its own 12xxx port in dev and prod, never `3000` (see
[02 — Ports](02-tooling.md#ports--one-unique-port-per-app-dev--prod)). Template defaults:

| Template | Port | Set in |
| --- | --- | --- |
| backend-service | 12500 | `APPPREFIX_API_PORT` (default), `docker/Dockerfile` `EXPOSE` + `ENV`, compose |
| nuxt-app | 12510 | `dev` / `start` scripts, `docker/Dockerfile` `NITRO_PORT` |
| fullstack-nuxt-app | 12520 | `dev` / `start` scripts, `docker/Dockerfile` `NITRO_PORT` |
| static-site | 12530 | `dev` only (deployed as files) |
| static-site-with-docs | 12531 | `dev` only (deployed as files) |
| cli-tool | — | — |

In production, run HTTP apps behind a reverse proxy (Nginx/Caddy/Traefik) that terminates TLS.

## Backend services

Backend services deploy as a **compiled Bun binary** (with the Drizzle migrations embedded via
`--asset`), usually inside a small Docker image. There is no `bun run build` / `dist/` step.

### Compiled binary

Build with the compile script from [11 — CLI & infra](11-cli-and-infra.md#compiling-to-a-single-binary):

```bash
bun run compile linux-x64-baseline --no-version-tag
# → build/bin/my-project-api-linux-x64-baseline  (AppConstants.BINARY_NAME)
```

The binary starts via `scripts/entrypoint.ts`, which forces `APPPREFIX_DB_AUTO_MIGRATE=true`, so a
fresh binary migrates its database on start. The migrations are embedded via
`--asset ./drizzle/migrations` — `DB.init` reads them from the embedded `migrations/` folder when
`Bun.isStandaloneExecutable` is true, so the single file is self-contained and can run directly
under systemd with the `APPPREFIX_*` variables in the unit's environment and nothing else beside
it. For non-compiled runs `DB.init` reads `APPPREFIX_DB_MIGRATION_DIR` instead
(see [08 — Migrations](08-database.md#migrations)); the Docker image below also copies the
migrations next to the binary as a fallback.

### Docker image

All templates use the same container layout: `WORKDIR /opt/leicraftmc/<project>` with the app
under `app/` and everything stateful in `data/` + `config/` volumes beside it (`VOLUME` declares
both, `curl` is installed for the `HEALTHCHECK`, and sensible `APPPREFIX_*` defaults are baked in as
`ENV` — deployments only override what differs). Projects group by area when it helps
(`LAVIAC: /opt/leicraftmc/auth/laviac`); standalone products drop the org level
(`Delivr: /opt/delivr/api`).

[`templates/backend-service/docker/Dockerfile`](../templates/backend-service/docker/Dockerfile) —
the binary on `debian:stable-slim`, no Bun runtime, no multi-stage build:

```dockerfile
FROM debian:stable-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /opt/leicraftmc/my-project

COPY ./build/bin/my-project-api-linux-x64-baseline ./app/my-project-api
COPY ./drizzle/migrations ./app/drizzle/migrations

RUN chmod u+x ./app/my-project-api

EXPOSE 12500/tcp

ENV NODE_ENV=production

ENV APPPREFIX_API_HOST=::
ENV APPPREFIX_API_PORT=12500

ENV APPPREFIX_DB_PATH=/opt/leicraftmc/my-project/data/db.sqlite
ENV APPPREFIX_DB_AUTO_MIGRATE=true
ENV APPPREFIX_DB_MIGRATION_DIR=/opt/leicraftmc/my-project/app/drizzle/migrations

ENV APPPREFIX_LOG_DIR=/opt/leicraftmc/my-project/data/logs
ENV APPPREFIX_CONFIG_BASE_DIR=/opt/leicraftmc/my-project/config

VOLUME /opt/leicraftmc/my-project/data
VOLUME /opt/leicraftmc/my-project/config

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD curl -f http://localhost:12500/health || exit 1

ENTRYPOINT ["/opt/leicraftmc/my-project/app/my-project-api"]
```

The binary name must match `AppConstants.BINARY_NAME` (`src/utils/constants.ts`) — replace
`my-project` / `my-project-api` throughout when scaffolding (see [03](03-naming-and-typescript.md)).
The migrations sit in `app/drizzle/migrations` next to the binary as a fallback for non-embedded
runs; `APPPREFIX_DB_MIGRATION_DIR` points at them explicitly. In the compiled binary the embedded
`--asset` copy wins (see [08](08-database.md#migrations)).

A `.dockerignore` keeps the build context free of `node_modules/`, local `data/`/`config/`, test
temp dirs and `.env` files.

[`docker/docker-compose.yml`](../templates/backend-service/docker/docker-compose.yml) pulls the
registry image — CI builds and pushes `$CI_REGISTRY_IMAGE:latest` from the default branch
(`docker compose -f docker/docker-compose.yml up`, after `docker compose pull`):

```yaml
services:

  my-project-api:
    image: gcr.leicraftmc.de/leicraftmc/my-project:latest
    container_name: my-project-api
    restart: unless-stopped
    ports:
      - "12500:12500"
    environment:
      APPPREFIX_LOG_LEVEL: info

      APPPREFIX_APP_URL: http://localhost:12510

      APPPREFIX_API_DISABLE_DOCS: false

      APPPREFIX_SMTP_HOST: "mail.example.com"
      APPPREFIX_SMTP_PORT: 465
      APPPREFIX_SMTP_USERNAME: "YourSMTPUsernameHere"
      APPPREFIX_SMTP_PASSWORD: "YourSMTPPasswordHere"
      APPPREFIX_SMTP_FROM: '"App" <system@app.example.com>'
      APPPREFIX_SMTP_SECURE: true

    volumes:
      - /opt/leicraftmc/my-project/data:/opt/leicraftmc/my-project/data
      - /opt/leicraftmc/my-project/config:/opt/leicraftmc/my-project/config
```

- `APPPREFIX_APP_URL` (required) is the **frontend's** public URL — used for CORS and for the
  password-reset links in emails.
- Everything stateful lives under the two volumes: the SQLite DB and logs in `data/`,
  `CONFIG_BASE_DIR` in `config/` (the first start writes the initial admin's reset link to
  `config/initial_admin_password_reset_token.txt` and logs it).
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

The Nitro server reads its port from `NITRO_PORT` (or `PORT`) — there is no `--port` flag for
`.output/server/index.mjs`. `.output/` is self-contained (no `node_modules` needed at runtime).
The images bake in `NODE_ENV=production`, `NITRO_HOST=::` and `NITRO_PORT`.

[`templates/nuxt-app/docker/Dockerfile`](../templates/nuxt-app/docker/Dockerfile):

```dockerfile
FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /opt/leicraftmc/my-project

COPY ./.output ./app/.output

EXPOSE 12510/tcp

ENV NODE_ENV=production
ENV NITRO_HOST=::
ENV NITRO_PORT=12510

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD curl -f http://localhost:12510/ || exit 1

CMD ["bun", "run", "/opt/leicraftmc/my-project/app/.output/server/index.mjs"]
```

This shape is stateless — no volumes, and the `HEALTHCHECK` probes `/` because there is no health
route. Run `bun run build` before `docker build` (GitLab's `build.docker.yml` does both and pushes
`:latest` from the default branch). Point the app at its API at runtime with
`APPPREFIX_API_URL` / `APPPREFIX_APP_URL` — the Nitro banner in `nuxt.config.ts` maps them to the
`NUXT_PUBLIC_*` overrides at server start (set `NUXT_PUBLIC_*` directly only to override the
prefixed values). The compose file
([`docker/docker-compose.yml`](../templates/nuxt-app/docker/docker-compose.yml)) pulls the
registry image CI pushed, with the port and the two URLs — `restart: unless-stopped`.

### Full-stack Nuxt (Hono in `server/`)

The full-stack shape deploys as **one** image: the Hono API ships inside the same `.output/` and
runs in the same Bun process — no separate backend service.
[`templates/fullstack-nuxt-app/docker/Dockerfile`](../templates/fullstack-nuxt-app/docker/Dockerfile)
adds only the migrations, which `DB.init` reads from `APPPREFIX_DB_MIGRATION_DIR`:

```dockerfile
FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /opt/leicraftmc/my-project

COPY ./.output ./app/.output
COPY ./drizzle/migrations ./app/drizzle/migrations

EXPOSE 12520/tcp

ENV NODE_ENV=production
ENV NITRO_HOST=::
ENV NITRO_PORT=12520

ENV APPPREFIX_DB_PATH=/opt/leicraftmc/my-project/data/db.sqlite
ENV APPPREFIX_DB_AUTO_MIGRATE=true
ENV APPPREFIX_DB_MIGRATION_DIR=/opt/leicraftmc/my-project/app/drizzle/migrations

ENV APPPREFIX_LOG_DIR=/opt/leicraftmc/my-project/data/logs
ENV APPPREFIX_CONFIG_BASE_DIR=/opt/leicraftmc/my-project/config

VOLUME /opt/leicraftmc/my-project/data
VOLUME /opt/leicraftmc/my-project/config

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD curl -f http://localhost:12520/api/health || exit 1

CMD ["bun", "run", "/opt/leicraftmc/my-project/app/.output/server/index.mjs"]
```

`/api/*` is served by Hono (the Nitro catch-all `server/routes/api/[...].ts`); everything else by
Nuxt. Keep `nitro.rollupConfig.external: ["bun:sqlite"]` in `nuxt.config.ts` so the native SQLite
binding isn't bundled. The template's `scripts/compile/` + `scripts/entrypoint.ts` do **not**
produce a working binary (see [11](11-cli-and-infra.md#entrypoint-script)) — deploy `.output/` as
above. Running it:

```bash
docker run -d -p 127.0.0.1:12520:12520 \
  -e APPPREFIX_APP_URL=https://app.example.com \
  -v "$PWD/data:/opt/leicraftmc/my-project/data" \
  -v "$PWD/config:/opt/leicraftmc/my-project/config" \
  registry.example.com/group/project:latest
```

- One URL suffices: `APPPREFIX_APP_URL` configures the API (CORS, reset links) **and** the
  frontend's `runtimeConfig.public.appUrl` — the Nitro banner in `nuxt.config.ts` copies it to
  `NUXT_PUBLIC_APP_URL` at server start, so the browser calls the right origin without a second
  variable. Set `NUXT_PUBLIC_APP_URL` explicitly only to override the prefixed value.
- Everything stateful lives under the two volumes; `data/` holds the SQLite DB and logs, `config/`
  is `CONFIG_BASE_DIR`. The image's `ENV` block already points all `APPPREFIX_*` vars at those
  locations.
- The compose file
  ([`docker/docker-compose.yml`](../templates/fullstack-nuxt-app/docker/docker-compose.yml)) is
  the same shape as the backend's — it pulls the registry image with the volumes attached.

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
  ([09](09-config-and-logging.md)). The Docker images *do* bake in the deployment-safe defaults
  (ports, absolute `data/`/`config/` paths, `DB_MIGRATION_DIR`) — override per deployment.
- Booleans accept exactly `true` or `false` (case-sensitive); anything else, **including an empty
  value**, fails at startup. Unset means the default.
- Keep the SQLite database (and `CONFIG_BASE_DIR`) on a persistent volume — the images declare
  `VOLUME`s for both.
- **Auto-migration.** `DB_AUTO_MIGRATE` defaults to `true`. The backend's `scripts/entrypoint.ts`
  forces it to `true` for `bun run start` and the compiled binary, and the images set it too; the
  full-stack image runs `.output/` directly, so there the env var (default `true`) decides. That
  is right for the normal single-instance SQLite deployment. Turn it off when migrations must run as
  a separate step — e.g. several processes sharing one database, or a manual `bun run db:migrate`
  before a risky release: set `APPPREFIX_DB_AUTO_MIGRATE=false` and, for the backend binary,
  remove the override from `scripts/entrypoint.ts`.
- `DB_MIGRATION_DIR` is `./drizzle/migrations` by default and applies to non-compiled runs; the
  images set the absolute in-image path, so it never depends on the working directory. Compiled
  binaries embed their migrations (`--asset`) and ignore the variable.

## Health checks

The backend exposes `/health` with the standard envelope:

```json
{ "success": true, "code": 200, "message": "<ProjectName> API is running", "data": null }
```

In the full-stack app the same route is `/api/health` (bare `/api` is not routed — Nitro's
catch-all needs `/api/...`); while the API is still starting it answers `503` with
`"API is starting, please retry shortly"`. The standalone Nuxt app and static sites have no health
route — their `HEALTHCHECK` probes `/`.

All three templates define a Docker `HEALTHCHECK` (`--interval=30s --timeout=5s
--start-period=20s`, `curl` against the URLs above); compose stacks can also gate dependent
services on `condition: service_healthy`. Apps with an upstream dependency that a mere "process is
up" probe misses split it into **liveness** (`/healthy` — is the process alive) and **readiness**
(`/ready` — checks config, secrets and the upstream, answers `503` while not ready) routes and
probe liveness only — e.g. the login UI does.

## Checklist

- [ ] App uses its own 12xxx port everywhere (scripts, Dockerfile, compose, env).
- [ ] Backend: `bun run compile linux-x64-baseline --no-version-tag` + `docker/Dockerfile`
      (binary name = `AppConstants.BINARY_NAME`); no `dist/` build.
- [ ] Backend image: binary (migrations embedded via `--asset`) + the `drizzle/migrations`
      fallback COPY under `app/`, `data/` + `config/` volumes, `HEALTHCHECK` on `/health`.
- [ ] Compose pulls the registry `:latest` image CI pushed; env sets `APPPREFIX_APP_URL` and keeps
      `data/` + `config/` on volumes.
- [ ] Images pushed as `:latest` from the default branch; version tags + cosign only if the
      project publishes images.
- [ ] Nuxt: `build` = `nuxt build --preset bun`, `start` = `PORT=<port> bun run
      .output/server/index.mjs`; image on `oven/bun:1-slim` with `NODE_ENV` / `NITRO_HOST` /
      `NITRO_PORT`.
- [ ] Full-stack: one image with `.output/` + `drizzle/migrations`; `bun:sqlite` external;
      `APPPREFIX_APP_URL` drives both the API side and the browser config (Nitro banner).
- [ ] `.dockerignore` keeps local state, `.env` files and `node_modules/` out of the build context.
- [ ] Static site: `nitro.preset: "static"`, `bun run generate` → `.output/public/`, `deploy.sh`
      with the `DEPLOY_REMOTE_*` variables, `public/.htaccess` for Apache.
- [ ] CLI: `package.json` version bumped, then `v*` tag → GitHub Release.
- [ ] Config injected at runtime via env vars; booleans set to exactly `true`/`false` — empty
      values fail at startup; image ENV defaults only cover deployment-safe values.
- [ ] Auto-migration off (and migrations run separately) if more than one process shares a DB.
- [ ] `/health` (`/api/health` full-stack) monitored via the Docker `HEALTHCHECK`.
