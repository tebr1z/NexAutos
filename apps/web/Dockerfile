FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=4000
ENV API_HOST=127.0.0.1
ENV INTERNAL_API_URL=http://127.0.0.1:4000/api/v1
ENV API_PROXY_URL=http://127.0.0.1:4000/api/v1
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_SITE_URL=https://nex.autos
ENV CORS_ORIGIN=https://nex.autos
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV NODE_OPTIONS=--max-old-space-size=1536
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/package.json api/package-lock.json ./api/
COPY api/scripts ./api/scripts
COPY api/prisma ./api/prisma
RUN npm ci --prefix api --no-audit --no-fund
COPY . .
RUN npm run build --prefix api
RUN node --max-old-space-size=1536 node_modules/next/dist/bin/next build --webpack
EXPOSE 3000
CMD ["npm", "start"]
