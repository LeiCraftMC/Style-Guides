# 14 — Deployment

## Backend services

Backend services run as a compiled Bun binary or as a Docker container.

### Compiled binary

Use the compile script from [11 — CLI & infra](11-cli-and-infra.md):

```bash
bun run compile auto 1.2.3
```

Deploy the binary with systemd or a container that copies it into `debian:stable-slim`:

```dockerfile
FROM debian:stable-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY build/bin/my-service-v1.2.3 /usr/local/bin/my-service
ENTRYPOINT ["/usr/local/bin/my-service"]
```

### Docker build with Bun

For services that need a build step, use a multi-stage Dockerfile:

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

## Nuxt apps

Nuxt apps deploy via the Bun Nitro preset:

```ts
export default defineNuxtConfig({
	nitro: { preset: "bun" },
});
```

Build and start:

```bash
bun run build
bun run .output/server/index.mjs --port 3000
```

In production, run behind a reverse proxy (Nginx/Caddy/Traefik) that terminates TLS.

### Full-stack Nuxt (Hono in `server/`)

The full-stack Nuxt shape deploys as a **single** Nuxt app — the Hono backend ships inside the same
`.output/` and runs under the same Bun process. No separate backend service or Docker image.

```bash
bun run build
bun run .output/server/index.mjs --port 3000
```

`/api/*` is served by Hono (via the catch-all Nitro route); everything else by Nuxt. Make sure
`nuxt.config.ts` keeps `nitro.rollupConfig.external: ["bun:sqlite"]` so the native SQLite binding
isn't bundled, and mount the database on a persistent volume.

## Static sites

Static sites use `nuxt generate` with the static Nitro preset:

```ts
export default defineNuxtConfig({
	nitro: { preset: "static" },
});
```

```bash
bun run generate
# deploy .output/public/ via rsync, S3, or GitLab Pages
```

Typical GitLab CI deploy stage:

```yaml
deploy:
  stage: deploy
  image: debian:stable-slim
  script:
    - apt-get update && apt-get install -y rsync openssh-client
    - rsync -avz --delete .output/public/ user@host:/var/www/site
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

## CLI tools

Distribute compiled binaries via GitHub Releases. The
[`shared/config/release.yml`](../shared/config/release.yml) workflow attaches all platform binaries
to a tag push (`v*`).

```bash
git tag v1.2.3
git push origin v1.2.3
```

## Environment in production

- Pass config as environment variables in the container/systemd unit, not baked into the image.
- Mount the SQLite database path or use a persistent volume.
- Set `EXAMPLE_DB_AUTO_MIGRATE=true` only on one startup path to avoid migration races in a
  multi-replica setup; otherwise run migrations as a separate init job.

## Health checks

Every backend exposes `/health` and returns the standard envelope:

```json
{ "success": true, "code": 200, "message": "healthy", "data": null }
```

Use this in load balancer / container health checks.

## Checklist

- [ ] Backend service has a production Dockerfile or compile + copy step.
- [ ] Nuxt app uses `nitro: { preset: "bun" }`.
- [ ] Static site uses `nitro: { preset: "static" }` and deploys `.output/public/`.
- [ ] CLI releases binaries via GitHub Releases on `v*` tags.
- [ ] Config is injected at runtime via env vars.
- [ ] `/health` endpoint implemented and monitored.
- [ ] Database migrations are not run by every replica unless safe.
