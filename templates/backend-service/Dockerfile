FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
COPY drizzle ./drizzle
COPY package.json ./
EXPOSE 12500
CMD ["bun", "run", "src/index.ts"]