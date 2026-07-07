# ---- Stage 1: 构建前端 ----
FROM node:22-bookworm-slim AS web-builder
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @redesk/web build

# ---- Stage 2: 运行时 ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.9.0
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=8787

RUN addgroup --system --gid 6418 redesk && adduser --system --uid 6418 --ingroup redesk --no-create-home redesk

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --prod --frozen-lockfile

COPY apps/api/src apps/api/src
COPY packages/shared/src packages/shared/src
COPY packages/db/src packages/db/src
COPY packages/db/drizzle packages/db/drizzle
COPY --from=web-builder /app/apps/web/dist apps/web/dist

RUN chown -R redesk:redesk /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

EXPOSE 8787
CMD ["pnpm", "--filter", "@redesk/api", "start"]
