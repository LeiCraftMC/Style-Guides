# Production image: the Nuxt server bundle (.output/, Bun preset) on the Bun runtime.
# Build it first (CI does this): `bun run build`. .output/ is self-contained — no node_modules.
# This shape is stateless: no volumes, and the HEALTHCHECK probes `/` — there is no dedicated
# health route (see docs/14 for the /healthy + /ready pattern should the app grow one).
# Runtime config comes from the prefixed env, e.g. `-e APPPREFIX_API_URL=https://api.example.com` —
# the Nitro banner in nuxt.config.ts maps APPPREFIX_* onto NUXT_PUBLIC_* at server start.
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