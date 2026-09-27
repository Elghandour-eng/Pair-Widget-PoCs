import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../middleware/error.js'
import { resolveConfig } from '../services/widgets.js'

/**
 * Public, unauthenticated endpoint consumed by the widget itself.
 * Mirrors Pair's `GET /v1/widget/:id/config` shape so the widget can point here instead of Pair.
 */
export const publicRouter = Router()

publicRouter.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }))

publicRouter.get(
  '/widget/:widgetId/config',
  asyncHandler(async (req, res) => {
    const { source, cached, config } = await resolveConfig(req.params.widgetId)
    res.setHeader('X-Config-Source', source)
    res.setHeader('X-Config-Cached', String(cached))
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(config)
  }),
)
