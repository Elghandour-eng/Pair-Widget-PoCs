import { Router } from 'express'
import { z } from 'zod'
import {
  SOURCE_KINDS, createSource, deleteSource, getSource, listSources, refreshSource,
  sourceConfigSchema, sourceId, sourceStatus, updateSource,
} from '../lib/dataSource.js'
import { notFound } from '../lib/errors.js'
import { DESIGN_FIELDS, cleanDesign } from '../lib/templates/design.js'
import { designFor, rowsFor } from '../lib/templates/hydrate.js'
import { TEMPLATES, TEMPLATES_BY_NAME } from '../lib/templates/registry.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

/**
 * The template engine's dashboard API.
 *
 * Three things live here: the catalog of registered templates (shape, what the
 * agent may emit, a worked example and a rendered preview), the named data
 * sources that feed them, and — under /api/widgets/:id/templates — which
 * templates a given widget renders and where each one's rows come from.
 */
export const templatesRouter = Router()
templatesRouter.use(requireAuth)

/** The catalog. `hydrate` is not exposed — a template is described by its contract, not its code. */
templatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      // The knob catalog travels with the templates so the dashboard renders
      // the right control per field without hardcoding any of them.
      designFields: DESIGN_FIELDS,
      templates: TEMPLATES.map((t) => ({
        name: t.name,
        category: t.category ?? 'cinema',
        title: t.title,
        description: t.description,
        widgetType: t.widgetType,
        collects: !!t.collects,
        passthrough: !!t.passthrough,
        /** Set on a plugin component: which orchestrator plugin, group and tool produce it. */
        plugin: t.plugin ?? null,
        emits: t.emits,
        sample: t.sample,
        /** What the agent would write to produce the example. */
        snippet: { type: 'template', template: t.name, data: t.sample },
        seedRows: t.passthrough ? 0 : t.seed().length,
        design: t.design,
        designDefaults: t.designDefaults,
      })),
    })
  }),
)

/**
 * One template rendered from its sample, exactly as a widget would receive it:
 * this is what the catalog page previews, so what an operator sees is the real
 * hydrator's output and not a mock-up of it.
 */
const previewBody = z.object({
  source: z.string().max(64).optional(),
  design: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  lang: z.enum(['ar', 'en']).default('ar'),
})

/** GET previews the saved state; POST previews an unsaved design as the editor types. */
const preview = asyncHandler(async (req, res) => {
  const def = TEMPLATES_BY_NAME.get(req.params.name)
  if (!def) throw notFound(`Unknown template "${req.params.name}"`)
  const input = previewBody.parse(req.method === 'POST' ? req.body : req.query)
  const binding = {
    enabled: null,
    sources: input.source ? { [def.name]: input.source } : {},
    designs: input.design ? { [def.name]: cleanDesign(input.design, def.design) } : {},
  }
  const data = def.hydrate({ ...def.sample }, rowsFor(def, binding))
  res.json({
    name: def.name,
    widgetType: def.widgetType,
    content: { lang: input.lang, ...data, design: designFor(def, binding) },
  })
})

templatesRouter.get('/:name/preview', preview)
templatesRouter.post('/:name/preview', preview)

/* ------------------------------- data sources ------------------------------ */

export const dataSourcesRouter = Router()
dataSourcesRouter.use(requireAuth)

const sourceBody = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(SOURCE_KINDS),
  /** 0 keeps the first copy for ever; anything else is a refresh interval in ms. */
  ttlMs: z.coerce.number().int().min(0).max(30 * 24 * 3600 * 1000).default(15 * 60 * 1000),
  config: sourceConfigSchema.default({}),
})

/** A source's token is write-only: it is never read back to the dashboard. */
const publicSource = (id: string) => {
  const def = getSource(id)
  if (!def) return null
  const { token, ...config } = def.config
  return { ...def, config, hasToken: !!token, status: sourceStatus(id) }
}

dataSourcesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ sources: listSources().map((d) => publicSource(d.id)) })
  }),
)

dataSourcesRouter.post(
  '/',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const body = sourceBody.extend({ id: sourceId }).parse(req.body)
    const def = await createSource(body, req.user!.email)
    res.status(201).json({ source: publicSource(def.id) })
  }),
)

dataSourcesRouter.patch(
  '/:id',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const body = sourceBody.partial().pick({ name: true, ttlMs: true, config: true }).parse(req.body)
    await updateSource(req.params.id, body, req.user!.email)
    res.json({ source: publicSource(req.params.id) })
  }),
)

/** Fetch now, rather than waiting for the interval — what an operator reaches for after editing the feed. */
dataSourcesRouter.post(
  '/:id/refresh',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const def = getSource(req.params.id)
    if (!def) throw notFound(`Data source ${req.params.id} not found`)
    await refreshSource(def)
    res.json({ source: publicSource(def.id) })
  }),
)

dataSourcesRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteSource(req.params.id)
    res.status(204).end()
  }),
)
