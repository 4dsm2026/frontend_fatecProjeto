# ---- Base ----
FROM node:22-alpine AS base
# pnpm fixado: o pnpm 11 exige Node 22.
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
# O pnpm-workspace.yaml traz o allowBuilds; sem ele o pnpm recusa os builds nativos (sharp, esbuild).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* precisam estar disponíveis em BUILD TIME para serem
# embutidas no bundle pelo Next.js. Passe via --build-arg no docker build.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- Production ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Variáveis server-side (JWT_ACCESS_SECRET, JWT_ISSUER, etc.) são lidas
# em runtime — basta passá-las no docker run -e ou no docker-compose.yml.
CMD ["node", "server.js"]
