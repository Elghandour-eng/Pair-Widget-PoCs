import cors from 'cors'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { mongoStatus } from './lib/mongo.js'
import { redis } from './lib/redis.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './routes/auth.js'
import { pairProxyRouter } from './routes/pairProxy.js'
import { publicRouter, widgetLangRouter, widgetViewRouter } from './routes/public.js'
import { usersRouter } from './routes/users.js'
import { logsRouter } from './routes/logs.js'
import { uploadsRouter, uploadsStatic } from './routes/uploads.js'
import { widgetsRouter } from './routes/widgets.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  )
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req: { url?: string }) => req.url === '/api/health' } }))

  // Dashboard API: locked to configured origins (same-origin in prod via the Vite proxy / static serving).
  const dashboardCors = cors({
    origin: (origin, cb) => {
      if (!origin || !env.isProd || env.corsOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
  // Public widget endpoint: any site embedding the widget may call it.
  const publicCors = cors({ origin: '*', methods: ['GET'] })

  app.get('/api/health', async (_req, res) => {
    const redisOk = redis.status === 'ready'
    res.status(redisOk ? 200 : 503).json({ status: redisOk ? 'ok' : 'degraded', redis: redis.status, mongo: mongoStatus(), uptime: process.uptime() })
  })

  app.use('/api/public/uploads', publicCors, uploadsStatic)
  app.use('/api/public', publicCors, publicRouter)
  // Alias with Pair's own path shape (GET /v1/widget/:id/config), so the widget's
  // beBaseUrl can point at this server and the design is served per the widget's source.
  // The widget iframe (on the SDK's origin) POSTs chat messages here too, so this
  // mount needs full CORS; whatever the studio doesn't serve itself is proxied to Pair.
  const widgetCors = cors({ origin: '*' })
  app.use('/v1', widgetCors, publicRouter)
  app.use('/v1', widgetCors, pairProxyRouter)
  // Language-forced variant for the test page's widget-language switch: the config
  // arrives already translated, everything else proxies to Pair as usual.
  app.use('/lang/:lng/v1', widgetCors, widgetLangRouter)
  app.use('/lang/:lng/v1', widgetCors, pairProxyRouter)
  // View-forced variant (language AND theme) for the test page's controls;
  // either segment can be `x` to keep that side of the saved design.
  app.use('/pv/:lng/:theme/v1', widgetCors, widgetViewRouter)
  app.use('/pv/:lng/:theme/v1', widgetCors, pairProxyRouter)
  app.use('/api/auth', dashboardCors, authRouter)
  app.use('/api/users', dashboardCors, usersRouter)
  app.use('/api/widgets', dashboardCors, widgetsRouter)
  app.use('/api/logs', dashboardCors, logsRouter)
  app.use('/api/uploads', dashboardCors, uploadsRouter)

  // Serve a local build of the widget SDK, when one is configured. The embed
  // snippet can then point at this origin instead of the hosted SDK, which is
  // the only way a change to the widget itself is visible before it ships.
  if (env.WIDGET_SDK_DIST) {
    const sdkDist = path.resolve(env.WIDGET_SDK_DIST)
    if (existsSync(sdkDist)) {
      app.use('/sdk', publicCors, express.static(sdkDist, { maxAge: '5m' }))
      logger.info({ sdkDist }, 'serving a local widget SDK at /sdk')
    } else {
      logger.warn({ sdkDist }, 'WIDGET_SDK_DIST is set but does not exist; using the hosted SDK')
    }
  }

  // Serve the built dashboard (web/dist) from the same origin in production.
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist')
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') } }))
    // The SPA fallback answers routes, not files. A build asset that is not on
    // disk has to 404: answering it with index.html hands the browser HTML
    // where it asked for JavaScript, which is what turns a stale chunk in an
    // already-open tab into an unexplained "failed to load" instead of a
    // straight 404 the app can recover from.
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (req.path.startsWith('/assets/') || path.extname(req.path)) return next()
      res.sendFile(path.join(webDist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } })
    })
    logger.info({ webDist }, 'serving dashboard static files')
  }

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
