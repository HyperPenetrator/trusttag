# ─────────────────────────────────────────────────────────────────
#  TrustTag Cortex — Dockerfile
#  Multi-stage: build TypeScript → lean production image
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json tsconfig.json ./
RUN npm install --frozen-lockfile

# Copy source
COPY src ./src
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────
FROM node:20-alpine AS runner

# sharp needs native binaries — install build tooling temporarily
RUN apk add --no-cache vips-dev fftw-dev build-base python3

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist

# Install only production deps (sharp rebuilds native bindings here)
RUN npm install --omit=dev --frozen-lockfile

# Remove build tooling after native install
RUN apk del build-base python3

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
