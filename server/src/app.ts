import cors from 'cors'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { redis } from './lib/redis.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './routes/auth.js'
import { publicRouter } from './routes/public.js'
import { usersRouter } from './routes/users.js'
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
    res.status(redisOk ? 200 : 503).json({ status: redisOk ? 'ok' : 'degraded', redis: redis.status, uptime: process.uptime() })
  })

  app.use('/api/public', publicCors, publicRouter)
  app.use('/api/auth', dashboardCors, authRouter)
  app.use('/api/users', dashboardCors, usersRouter)
  app.use('/api/widgets', dashboardCors, widgetsRouter)

  // Serve the built dashboard (web/dist) from the same origin in production.
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist')
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') } }))
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }))
    logger.info({ webDist }, 'serving dashboard static files')
  }

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
