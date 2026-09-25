# Production image: the Nuxt server bundle (.output/, Bun preset) on the Bun runtime.
# Build it first (CI does this): `bun run build`. .output/ is self-contained — no node_modules.
# Runtime config comes from env, e.g. `-e NUXT_PUBLIC_API_URL=https://api.example.com`.
FROM oven/bun:1-slim

WORKDIR /app

COPY ./.output ./.output

ENV PORT=12510

EXPOSE 12510/tcp

CMD ["bun", "run", ".output/server/index.mjs"]
