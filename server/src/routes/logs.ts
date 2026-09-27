import { Router } from 'express'
import { z } from 'zod'
import { logActions, queryLogs } from '../lib/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

export const logsRouter = Router()
logsRouter.use(requireAuth, requireRole('admin'))

const querySchema = z.object({
  level: z.enum(['info', 'warn', 'error']).optional(),
  action: z.string().max(80).optional(),
  actor: z.string().max(200).optional(),
  widgetId: z.string().max(64).optional(),
  q: z.string().max(200).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

logsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Blank query-string values mean "no filter", not "match the empty string".
    const cleaned = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== '' && v !== undefined))
    const input = querySchema.parse(cleaned)
    const { items, total, available } = await queryLogs(input)
    res.json({ logs: items, total, page: input.page, perPage: input.perPage, available })
  }),
)

logsRouter.get(
  '/actions',
  asyncHandler(async (_req, res) => res.json({ actions: await logActions() })),
)
