# ---- widget SDK ----
# The widget itself, built here so this deployment serves the SDK it was built
# against. Without it the server hands every embed WIDGET_SDK_BASE_URL: a
# separately deployed copy of the widget that can be older than the config it is
# given. That failure is silent — pages load, the program is just the wrong one —
# which is exactly how a staging deployment ran an old widget against new config
# with no error anywhere.
#
# CI checks the widget repository out into sdk-src/. A build context without it
# (any plain local `docker build`) ships no SDK, and the server then logs the
# fallback loudly instead of mounting a /sdk that 404s.
FROM ghcr.io/taha2samy-3/node:22-dev AS sdk
WORKDIR /src
# Vite inlines these at build time, and the widget's env module throws on a
# missing VITE_BASE_URL or VITE_PUSHER_APP_KEY, so they are build inputs rather
# than runtime configuration. The Pusher app key is a client key, public by
# design — the widget ships it to every browser either way.
ARG VITE_BASE_URL=""
ARG VITE_PUSHER_APP_KEY=""
ARG VITE_PUSHER_CLUSTER=""
ARG VITE_PUSHER_HOST=""
ARG VITE_PUSHER_PORT=""
ARG VITE_PUSHER_FORCE_TLS=""
COPY --chown=node:node . .
RUN set -eu; \
    if [ -f sdk-src/package.json ]; then \
      if [ -z "$VITE_BASE_URL" ] || [ -z "$VITE_PUSHER_APP_KEY" ]; then \
        echo 'sdk: VITE_BASE_URL and VITE_PUSHER_APP_KEY must be passed as build args' >&2; \
        exit 1; \
      fi; \
      cd sdk-src; \
      npm ci --no-audit --no-fund; \
      npx vite build --base=/sdk/ --outDir dist; \
    else \
      echo 'sdk: no sdk-src/package.json in the build context; this image ships no SDK'; \
      mkdir -p sdk-src/dist; \
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