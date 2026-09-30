# syntax=docker/dockerfile:1
FROM oven/bun:1.4.2 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS builder
ENV BUILD_STANDALONE=1
COPY . .
RUN bun run build

FROM oven/bun:1.4.2-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    LOG_LEVEL=info \
    HISTORY_DB_PATH=/app/data/roll-history.sqlite
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static
COPY --from=builder --chown=bun:bun /app/public ./public
RUN mkdir -p /app/data /app/.next/cache && chown bun:bun /app/data /app/.next /app/.next/cache
USER bun
EXPOSE 3000
CMD ["bun", "server.js"]
