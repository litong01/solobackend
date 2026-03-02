FROM node:20-alpine AS base

# ------- Dependencies -------
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ------- Build -------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ------- Production -------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/openapi.yaml ./openapi.yaml
COPY --from=builder /app/openapi.json ./openapi.json

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN chown nextjs:nodejs /app/openapi.yaml /app/openapi.json && \
    chmod +x /app/scripts/docker-entrypoint.sh

# Stripe CLI (~8 MB) for dev/test: when STRIPE_SECRET_KEY starts with sk_test_, entrypoint runs stripe listen
RUN apk add --no-cache curl && \
  mkdir -p /app/bin && \
  curl -sL "https://github.com/stripe/stripe-cli/releases/download/v1.37.1/stripe_1.37.1_linux_x86_64.tar.gz" | tar xz -C /app/bin stripe && \
  chown nextjs:nodejs /app/bin/stripe

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
