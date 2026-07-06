# Dockerfile for deploying LinguaRead to Sealos / any container platform.
# Multi-stage build to keep the final image small.

# ---- Stage 1: Install deps ----
FROM oven/bun:1.1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# ---- Stage 2: Build ----
FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build the Next.js standalone output
RUN bun run build

# ---- Stage 3: Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Note: .env is NOT copied. Environment variables are set in the Sealos dashboard.
# The app reads process.env.DEEPSEEK_API_KEY etc. at runtime.

EXPOSE 3000
CMD ["node", "server.js"]
