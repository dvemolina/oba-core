# =============================================================================
# Multi-stage Dockerfile for OBA Core SvelteKit Application
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN npm install -g pnpm@latest

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# oba-core uses $env/dynamic/private — no build-time env vars needed
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# adapter-node bundles all dependencies into build/
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./

USER sveltekit

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
