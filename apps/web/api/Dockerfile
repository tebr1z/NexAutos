FROM node:22-alpine AS deps
WORKDIR /app
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY prisma/engines ./prisma/engines
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node scripts/place-prisma-engines.cjs
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./
EXPOSE 4000
CMD ["sh", "-c", "node scripts/run-prisma.cjs boot && node prisma/seed.cjs && node dist/main.js"]
