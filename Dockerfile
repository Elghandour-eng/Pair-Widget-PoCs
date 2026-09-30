# ---- widget SDK ----
# The widget lives in this repository, under sdk-src/, and is built here so the
# image carries the widget its own configuration was designed against. They ship
# in one commit and one image, which is the only arrangement in which they cannot
# disagree: a deployment pointed at a separately hosted widget runs new config
# against whatever version that host happens to serve, and the page loads either
# way, so nothing reports it.
FROM ghcr.io/taha2samy-3/node:22-dev AS sdk
WORKDIR /src
# husky's prepare script wants a .git directory that is not in the build context.
ENV HUSKY=0
# Built with no settings at all. The widget's VITE_* values are the
# deployment's, not the image's: the server reads them from its environment
# (Vault) and writes them into the widget's page at runtime, so one image runs
# anywhere and a changed value needs a restart, not a rebuild.
COPY --chown=node:node . .
RUN cd sdk-src \
    && npm ci --no-audit --no-fund \
    && npx vite build --base=/sdk/ --outDir dist \
    && test -f dist/sdk.js

# ---- dependencies ----
FROM ghcr.io/taha2samy-3/node:22-dev AS deps
WORKDIR /app
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

# 3. Copy the widget SDK this image serves at /sdk; set WIDGET_SDK_DIST=/app/sdk-dist
#    to serve it.
COPY --from=sdk --chown=node:node /src/sdk-src/dist sdk-dist

USER node
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=3s \
    CMD ["node", "-e", "require('http').get('http://127.0.0.1:4100/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"]

# 4. Use tini as PID 1 -> then envoke to load secrets -> then execute node
ENTRYPOINT ["/sbin/tini", "--", "envoke", "--"]
CMD ["node", "server/dist/index.js"]
