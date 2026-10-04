# Production image: the full-stack server bundle (.output/ — Nuxt + the Hono API, Bun preset) on
# the Bun runtime. Build it first (CI does this): `bun run build`. .output/ is self-contained;
# only the Drizzle migrations are copied next to it — DB.init applies them on startup
# (APPPREFIX_DB_AUTO_MIGRATE) from APPPREFIX_DB_MIGRATION_DIR. Layout: app under app/, data/
# and config/ are volumes beside it.
# Runtime config comes from env: set the public app URL twice — `APPPREFIX_APP_URL` (API side:
# CORS, links in emails) and `NUXT_PUBLIC_APP_URL` (the URL the browser's API client calls).
FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /opt/leicraftmc/my-project

COPY ./.output /opt/leicraftmc/my-project/app/.output
COPY ./drizzle/migrations /opt/leicraftmc/my-project/app/drizzle/migrations

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
