import { Router } from 'express'
import { z } from 'zod'
import { badRequest } from '../lib/errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { fetchPairConfig } from '../services/pairApi.js'
import {
  createWidget, deleteWidget, getAudit, getStoredConfig, getWidget, importFromApi,
  listWidgets, resolveConfig, saveStoredConfig, sourceSchema, updateWidget,
} from '../services/widgets.js'

export const widgetsRouter = Router()
widgetsRouter.use(requireAuth)

const widgetId = z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Widget ID may only contain letters, digits, _ and -')
const apiBaseUrl = z.string().url().optional().or(z.literal(''))
const configBody = z.record(z.unknown()).refine((c) => Object.keys(c).length > 0, 'Config must be a non-empty JSON object')

widgetsRouter.get('/', asyncHandler(async (_req, res) => res.json({ widgets: await listWidgets() })))

/** Preview a Pair config before registering a widget (no side effects). */
widgetsRouter.get(
  '/peek/:widgetId',
  asyncHandler(async (req, res) => {
    const id = widgetId.parse(req.params.widgetId)
    const base = typeof req.query.apiBaseUrl === 'string' && req.query.apiBaseUrl ? z.string().url().parse(req.query.apiBaseUrl) : undefined
    res.json({ config: await fetchPairConfig(id, base) })
  }),
)

widgetsRouter.post(
  '/',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        widgetId,
        channelName: z.string().min(1).max(80),
        source: sourceSchema.default('api'),
        apiBaseUrl,
        notes: z.string().max(500).optional(),
        importFromApi: z.boolean().default(false),
      })
      .parse(req.body)
    if (body.source === 'redis' && !body.importFromApi) {
      throw badRequest('Source "redis" requires importing the config from the API first (set importFromApi: true).')
    }
    res.status(201).json({ widget: await createWidget({ ...body, apiBaseUrl: body.apiBaseUrl || undefined }, req.user!.email) })
  }),
)

widgetsRouter.get(
  '/:widgetId',
  asyncHandler(async (req, res) => {
    const [widget, storedConfig, audit] = await Promise.all([
      getWidget(req.params.widgetId), getStoredConfig(req.params.widgetId), getAudit(req.params.widgetId),
    ])
    res.json({ widget, storedConfig, hasStoredConfig: !!storedConfig, audit })
  }),
)

widgetsRouter.patch(
  '/:widgetId',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({ channelName: z.string().min(1).max(80).optional(), source: sourceSchema.optional(), apiBaseUrl, notes: z.string().max(500).optional() })
      .parse(req.body)
    res.json({ widget: await updateWidget(req.params.widgetId, body, req.user!.email) })
  }),
)

widgetsRouter.delete(
  '/:widgetId',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteWidget(req.params.widgetId)
    res.status(204).end()
  }),
)

/** Resolved config: what the widget will actually render. ?source=api|redis overrides for comparison. */
widgetsRouter.get(
  '/:widgetId/config',
  asyncHandler(async (req, res) => {
    const override = req.query.source ? sourceSchema.parse(req.query.source) : undefined
    res.json(await resolveConfig(req.params.widgetId, override))
  }),
)

widgetsRouter.put(
  '/:widgetId/config',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const config = configBody.parse(req.body)
    res.json({ widget: await saveStoredConfig(req.params.widgetId, config, req.user!.email) })
  }),
)

widgetsRouter.post(
  '/:widgetId/import',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const { record, config } = await importFromApi(req.params.widgetId, req.user!.email)
    res.json({ widget: record, storedConfig: config })
  }),
)
