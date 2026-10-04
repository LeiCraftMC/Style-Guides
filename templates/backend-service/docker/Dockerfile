# Production image: the compiled Bun binary on a slim Debian base.
# Build the binary first (CI does this): `bun run compile linux-x64-baseline --no-version-tag`
# → build/bin/my-project-api-linux-x64-baseline. The name must match AppConstants.BINARY_NAME
# (src/utils/constants.ts) — replace `my-project` here when you rename it (see docs/03).
# Layout: binary under app/, data/ and config/ are volumes beside it. The binary embeds the
# Drizzle migrations (--asset); the image additionally copies them next to it as a fallback
# (APPPREFIX_DB_MIGRATION_DIR). Migrations are applied on startup while
# APPPREFIX_DB_AUTO_MIGRATE is true. Runtime config: APPPREFIX_* env (see example.env).
FROM debian:stable-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/leicraftmc/my-project

COPY ./build/bin/my-project-api-linux-x64-baseline /opt/leicraftmc/my-project/app/my-project-api
# migrations are embedded in the binary, we do not need to copy them

RUN chmod u+x /opt/leicraftmc/my-project/app/my-project-api

EXPOSE 12500/tcp

ENV NODE_ENV=production

ENV APPPREFIX_API_HOST=::
ENV APPPREFIX_API_PORT=12500

ENV APPPREFIX_DB_PATH=/opt/leicraftmc/my-project/data/db.sqlite
ENV APPPREFIX_DB_AUTO_MIGRATE=true
# APPPREFIX_DB_MIGRATION_DIR do not need to be set, the binary embeds the migrations

ENV APPPREFIX_LOG_DIR=/opt/leicraftmc/my-project/data/logs
ENV APPPREFIX_CONFIG_BASE_DIR=/opt/leicraftmc/my-project/config


VOLUME /opt/leicraftmc/my-project/data
VOLUME /opt/leicraftmc/my-project/config

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD curl -f http://localhost:12500/health || exit 1

ENTRYPOINT ["/opt/leicraftmc/my-project/app/my-project-api"]
