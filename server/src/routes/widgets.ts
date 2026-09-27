import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { badRequest } from '../lib/errors.js'
import { sdkBaseUrl } from '../lib/sdkBase.js'
import { FEEDBACK_STATUSES, queryFeedback, setFeedbackStatus, type FeedbackStatus } from '../lib/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { assertWidgetAccess, loadWidgetAccess } from '../middleware/widgetAccess.js'
import { fetchPairConfig } from '../services/pairApi.js'
import { grantWidgetAccess } from '../services/users.js'
import {
  createWidget, deleteWidget, getAudit, getStoredConfig, getWidget, importFromApi,
  listWidgets, resolveConfig, saveStoredConfig, sourceSchema, updateWidget,
} from '../services/widgets.js'

export const widgetsRouter = Router()
widgetsRouter.use(requireAuth, loadWidgetAccess)

// Every route addressing one widget goes through the caller's access list.
// /peek/:widgetId is exempt: it previews widgets that are not registered yet.
widgetsRouter.param('widgetId', (req, _res, next, id) => {
  if (req.path.startsWith('/peek/')) return next()
  try {
    assertWidgetAccess(req, id)
    next()
  } catch (err) {
    next(err)
  }
})

const widgetId = z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Widget ID may only contain letters, digits, _ and -')
const apiBaseUrl = z.string().url().optional().or(z.literal(''))
const configBody = z.record(z.unknown()).refine((c) => Object.keys(c).length > 0, 'Config must be a non-empty JSON object')

widgetsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const widgets = await listWidgets()
    res.json({ widgets: req.allowedWidgets ? widgets.filter((w) => req.allowedWidgets!.has(w.widgetId)) : widgets })
  }),
)

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
        importFromApi: z.boolean().default(true),
      })
      .parse(req.body)
    if (body.source === 'redis' && !body.importFromApi) {
      throw badRequest('Source "redis" requires importing the config from the API first (set importFromApi: true).')
    }
    const widget = await createWidget({ ...body, apiBaseUrl: body.apiBaseUrl || undefined }, req.user!.email)
    // A restricted editor must be able to see what they just registered.
    if (req.allowedWidgets) await grantWidgetAccess(req.user!.id, widget.widgetId)
    res.status(201).json({ widget })
  }),
)

widgetsRouter.get(
  '/:widgetId',
  asyncHandler(async (req, res) => {
    const [widget, storedConfig, audit] = await Promise.all([
      getWidget(req.params.widgetId), getStoredConfig(req.params.widgetId), getAudit(req.params.widgetId),
    ])
    res.json({ widget, storedConfig, hasStoredConfig: !!storedConfig, audit, sdkBaseUrl: sdkBaseUrl(req) })
  }),
)

/** Tester notes written on the public embed page: searchable, paginated, with a workflow status. */
widgetsRouter.get(
  '/:widgetId/feedback',
  asyncHandler(async (req, res) => {
    await getWidget(req.params.widgetId)
    const query = z
      .object({
        q: z.string().trim().max(200).optional(),
        status: z.enum(FEEDBACK_STATUSES as [FeedbackStatus, ...FeedbackStatus[]]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(64).default(8),
      })
      .parse(req.query)
    const { items, total, counts } = await queryFeedback({ widgetId: req.params.widgetId, ...query })
    res.json({ available: true, notes: items, total, counts })
  }),
)

widgetsRouter.patch(
  '/:widgetId/feedback/:noteId',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    await getWidget(req.params.widgetId)
    const { status } = z.object({ status: z.enum(FEEDBACK_STATUSES as [FeedbackStatus, ...FeedbackStatus[]]) }).parse(req.body)
    const note = await setFeedbackStatus(req.params.widgetId, req.params.noteId, status, req.user!.email)
    if (!note) throw badRequest('Note not found')
    res.json({ note })
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
    await deleteWidget(req.params.widgetId, req.user!.email)
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
