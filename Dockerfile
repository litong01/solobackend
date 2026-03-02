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

# Pass at build time so Next.js can inline: docker build --build-arg ENABLE_SWAGGER_UI=true
ARG ENABLE_SWAGGER_UI
ENV ENABLE_SWAGGER_UI=$ENABLE_SWAGGER_UI

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

RUN chown nextjs:nodejs /app/openapi.yaml /app/openapi.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
