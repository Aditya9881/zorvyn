# ═══════════════════════════════════════════════════════════════
# Zorvyn Financial Dashboard — Multi-Stage Dockerfile
#
# Security: Final image runs as non-root user (zorvyn, UID 1001)
# Base: node:20-alpine for minimal attack surface
# Native: better-sqlite3 compiled in prod-deps stage
# ═══════════════════════════════════════════════════════════════

# ─── Stage 1: Full Dependencies (for future build steps) ─────
FROM node:20-alpine AS deps

# better-sqlite3 requires build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Production Dependencies Only ───────────────────
FROM node:20-alpine AS prod-deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 3: Production Image — Minimal, Non-Root ───────────
FROM node:20-alpine AS production

# Security: create non-root user for financial compliance
RUN addgroup -S zorvyn && adduser -S zorvyn -G zorvyn -u 1001

WORKDIR /app

# Copy production node_modules (with compiled better-sqlite3 native addon)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src/ ./src/
COPY vitest.config.js ./

# Create data directory for SQLite and set ownership
RUN mkdir -p /app/data && chown -R zorvyn:zorvyn /app

# Switch to non-root user — container never runs as root
USER zorvyn

# Environment defaults (overridable via docker-compose or -e flags)
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/zorvyn.db

EXPOSE 3000

# Built-in health check (alpine uses wget, not curl)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "src/index.js"]
