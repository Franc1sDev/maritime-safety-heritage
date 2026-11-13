# Maritime Safety Heritage Archive: API and website in one image.
# Build:  docker build -t maritime-heritage .
FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000 STORAGE_LOCAL_DIR=/data/storage TRUST_PROXY=true
RUN apk add --no-cache tini && mkdir -p /data/storage && chown -R node:node /data
WORKDIR /app/backend
COPY --from=build --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/package.json ./
COPY --chown=node:node web/ /app/web/
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Applies any new database migrations, creates the first admin if needed, then starts the server.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/database/seed.js && node dist/main.js"]
