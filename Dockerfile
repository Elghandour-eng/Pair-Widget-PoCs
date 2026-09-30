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
# Vite inlines these at build time, and the widget's env module throws on a
# missing VITE_BASE_URL or VITE_PUSHER_APP_KEY, so they are build inputs rather
# than runtime configuration. The Pusher app key is a client key, public by
# design — the widget ships it to every browser either way.
# Set to 1 to build the widget. Left unset, the image ships without one and the
# server falls back to WIDGET_SDK_BASE_URL — the escape hatch for a deployment
# whose Pusher and Pair values are not configured yet, since a widget built
# without them throws on startup and is worse than no widget at all.
ARG BUILD_SDK=""
ARG VITE_BASE_URL=""
ARG VITE_PUSHER_APP_KEY=""
ARG VITE_PUSHER_CLUSTER=""
ARG VITE_PUSHER_HOST=""
ARG VITE_PUSHER_PORT=""
ARG VITE_PUSHER_FORCE_TLS=""
COPY --chown=node:node . .
RUN set -eu; \
    if [ "$BUILD_SDK" != "1" ]; then \
      echo 'sdk: BUILD_SDK is not 1; this image ships no widget of its own'; \
      mkdir -p sdk-src/dist; \
    else \
      if [ -z "$VITE_BASE_URL" ] || [ -z "$VITE_PUSHER_APP_KEY" ]; then \
        echo 'sdk: VITE_BASE_URL and VITE_PUSHER_APP_KEY must be passed as build args' >&2; \
        exit 1; \
      fi; \
      cd sdk-src; \
      npm ci --no-audit --no-fund; \
      npx vite build --base=/sdk/ --outDir dist; \
    fi

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

# 3. Copy the widget SDK this image serves at /sdk. Empty when the build context
#    carried no widget source; set WIDGET_SDK_DIST=/app/sdk-dist to serve it.
COPY --from=sdk --chown=node:node /src/sdk-src/dist sdk-dist

USER node
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=3s \
    CMD ["node", "-e", "require('http').get('http://127.0.0.1:4100/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"]

# 4. Use tini as PID 1 -> then envoke to load secrets -> then execute node
ENTRYPOINT ["/sbin/tini", "--", "envoke", "--"]
CMD ["node", "server/dist/index.js"]