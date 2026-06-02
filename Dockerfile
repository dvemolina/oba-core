# =============================================================================
# Multi-stage Dockerfile for OBA Core SvelteKit Application
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN npm install -g pnpm@latest

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy env vars satisfy SvelteKit post-build analysis — not used at runtime
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV DATABASE_URL="postgresql://build:build@localhost/build"
ENV BETTER_AUTH_SECRET="build-time-placeholder-32-chars-xx"
ENV ORIGIN="http://localhost:3000"
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit

# Migration script needs pg (not bundled by adapter-node)
RUN npm install -g pnpm@latest
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built app
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./

# Copy migration files and scripts
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle ./drizzle
COPY --chown=sveltekit:nodejs scripts/migrate.js ./scripts/migrate.js
COPY --chown=sveltekit:nodejs scripts/start.sh ./scripts/start.sh

USER root
RUN chmod +x /app/scripts/start.sh /app/scripts/migrate.js
USER sveltekit

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

CMD ["/app/scripts/start.sh"]
