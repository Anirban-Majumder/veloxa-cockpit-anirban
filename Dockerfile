FROM docker.io/oven/bun:1.4.4-slim AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM docker.io/oven/bun:1.4.4-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/web ./apps/web
RUN bun run build

FROM docker.io/oven/bun:1.4.4-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY package.json ./
COPY apps/api ./apps/api
COPY src ./src
COPY scripts/container-init.ts scripts/container-entrypoint.sh scripts/ingest.ts ./scripts/
EXPOSE 8787
ENTRYPOINT ["sh", "scripts/container-entrypoint.sh"]
