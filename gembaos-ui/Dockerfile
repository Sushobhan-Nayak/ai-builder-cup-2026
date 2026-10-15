# Multi-stage Dockerfile for Next.js Standalone on Google Cloud Run

# 1. Dependencies stage
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Builder stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . ./

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# 3. Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Guarantee static files are available if Next.js traces into subfolder
RUN if [ -d "./gembaos-ui" ]; then \
      mkdir -p ./gembaos-ui/.next && \
      cp -r ./.next/static ./gembaos-ui/.next/static 2>/dev/null || true; \
      cp -r ./public ./gembaos-ui/public 2>/dev/null || true; \
    fi

USER nextjs

EXPOSE 8080

CMD ["sh", "-c", "if [ -f ./server.js ]; then exec node server.js; else exec node gembaos-ui/server.js; fi"]
