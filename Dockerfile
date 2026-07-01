# syntax=docker/dockerfile:1

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
RUN npm install -g pnpm@11.9.0
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=8787

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

EXPOSE 8787
CMD ["pnpm", "--filter", "@redesk/api", "start"]
