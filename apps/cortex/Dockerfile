# ─────────────────────────────────────────────────────────────────
#  TrustTag Cortex — Dockerfile
#  Multi-stage: build TypeScript → lean production image
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations if any, and workspace manifests
COPY package.json package-lock.json ./
COPY apps/cortex/package.json ./apps/cortex/
COPY packages/cortex-matching/package.json ./packages/cortex-matching/

# Install dependencies for both the root and the workspaces
RUN npm ci

# Copy and build cortex-matching dependency first
COPY packages/cortex-matching ./packages/cortex-matching
RUN npm run build --workspace=cortex-matching || (cd packages/cortex-matching && npm run build)

# Copy and build cortex app
COPY apps/cortex ./apps/cortex
RUN npm run build --workspace=cortex || (cd apps/cortex && npm run build)

# ── Stage 2: Production ───────────────────────────────────────────
FROM node:20-alpine AS runner

# sharp needs native binaries — install build tooling temporarily
RUN apk add --no-cache vips-dev fftw-dev build-base python3

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and package descriptors
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/cortex/package.json ./apps/cortex/
COPY --from=builder /app/packages/cortex-matching ./packages/cortex-matching/
COPY --from=builder /app/apps/cortex/dist ./apps/cortex/dist/

# Install only production dependencies
RUN npm ci --omit=dev

# Remove build tooling after native install
RUN apk del build-base python3

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "apps/cortex/dist/index.js"]

