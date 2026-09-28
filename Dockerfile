# ---- dependencies ----
FROM ghcr.io/taha2samy-3/node:22-dev AS deps
WORKDIR /app
# Use --chown=node:node because the base image runs as the non-root 'node' user
COPY --chown=node:node package*.json ./
COPY --chown=node:node server/package.json server/
COPY --chown=node:node web/package.json web/
RUN npm ci --omit=dev -w server && npm cache clean --force

# ---- build ----
FROM ghcr.io/taha2samy-3/node:22-dev AS build
WORKDIR /app
COPY --chown=node:node package*.json ./
COPY --chown=node:node server/package.json server/
COPY --chown=node:node web/package.json web/
RUN npm ci
COPY --chown=node:node . .
RUN npm run build

# ---- runtime ----
FROM ghcr.io/taha2samy-3/node:22
ENV NODE_ENV=production
WORKDIR /app

# 1. Copy production dependencies
COPY --from=deps --chown=node:node /app ./

# 2. Copy built application assets
COPY --from=build --chown=node:node /app/server/dist server/dist
COPY --from=build --chown=node:node /app/web/dist web/dist

USER node
EXPOSE 4100

# Since the minimal production runtime lacks a shell and tools like `wget` or `curl`, 
# we execute a native Node.js script using the array syntax for the HEALTHCHECK.
HEALTHCHECK --interval=30s --timeout=3s \
    CMD ["node", "-e", "require('http').get('http://127.0.0.1:4100/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"]

CMD ["node", "server/dist/index.js"]