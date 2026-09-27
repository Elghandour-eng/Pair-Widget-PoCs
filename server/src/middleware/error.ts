import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { logEvent } from '../lib/mongo.js'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } })
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'validation_error', message: 'Invalid request', details: err.flatten() } })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  logEvent({
    level: 'error',
    action: 'http.error',
    actor: req.user?.email ?? null,
    message: (err as Error)?.message ?? 'Unhandled error',
    status: 500,
    ip: req.ip,
    meta: { path: req.originalUrl, method: req.method, stack: (err as Error)?.stack?.slice(0, 2000) },
  })
  logger.error({ err }, 'unhandled error')
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } })
}

/** Wrap async route handlers so rejections reach the error handler. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next)
