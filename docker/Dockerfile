FROM node:20-alpine AS base
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN NODE_OPTIONS=--max-old-space-size=6144 npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

# Social Engine worker (docker-compose service `worker`) — runs raw TS job
# handlers via tsx (same tool the project already uses for `prisma db seed`),
# so it needs the full, unpruned node_modules from `deps` (pg-boss, the AWS
# SDK, etc.) plus the actual src/ sources, unlike `runner`'s standalone bundle.
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs
CMD ["npx", "tsx", "src/engines/social/queue/worker.ts"]
