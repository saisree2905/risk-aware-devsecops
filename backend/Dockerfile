# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# Stage 1: Build & Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install only production dependencies (clean install)
RUN npm ci --omit=dev --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Security hardening: upgrade Alpine zlib (CVE-2026-4738) and remove npm/npx tooling from production runtime
RUN apk update && apk upgrade --no-cache zlib && rm -rf /var/cache/apk/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Security: run as non-root user (built into node alpine image)
USER node

# Copy production node_modules from builder stage with proper ownership
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules

# Copy package metadata
COPY --chown=node:node package*.json ./

# Copy application source code and migrations
COPY --chown=node:node src/ ./src/
COPY --chown=node:node migrations/ ./migrations/

# Expose backend API port
EXPOSE 5000

# Start server using the standard backend entry point
CMD ["node", "src/index.js"]
