import { Router } from 'express'
import { z } from 'zod'
import {
  SOURCE_KINDS, createSource, deleteSource, getSource, listSources, refreshSource,
  sourceConfigSchema, sourceId, sourceStatus, updateSource,
} from '../lib/dataSource.js'
import { badRequest, notFound } from '../lib/errors.js'
import { DESIGN_FIELDS, cleanDesign } from '../lib/templates/design.js'
import { designFor, rowsFor, widgetTemplateOf } from '../lib/templates/hydrate.js'
import { sdkBaseUrl } from '../lib/sdkBase.js'
import { allTemplates, isCustom, templateByName } from '../lib/templates/registry.js'
import {
  createCustomTemplate, customTemplateSchema, deleteCustomTemplate, getCustomTemplate,
  listCustomTemplates, render, sanitizeHtml, updateCustomTemplate,
} from '../lib/templates/customTemplates.js'
import { generateTemplate, studioReady } from '../lib/templates/studio.js'
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
      // Cards in Pair's native shape are previewed by the widget itself, from here.
      sdkBaseUrl: sdkBaseUrl(),
      templates: allTemplates().map((t) => ({
        name: t.name,
        category: t.category ?? 'cinema',
        /** True on a studio template: made in the dashboard, editable there, not compiled in. */
        custom: isCustom(t.name),
        title: t.title,
        description: t.description,
        widgetType: t.widgetType,
        /** Previewed by the widget's own renderer rather than a dashboard twin. */
        native: !!t.envelope,
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
  const def = templateByName(req.params.name)
  if (!def) throw notFound(`Unknown template "${req.params.name}"`)
  const input = previewBody.parse(req.method === 'POST' ? req.body : req.query)
  const binding = {
    enabled: null,
    sources: input.source ? { [def.name]: input.source } : {},
    designs: input.design ? { [def.name]: cleanDesign(input.design, def.design) } : {},
  }
  const sample = input.lang === 'ar' && def.sampleAr ? def.sampleAr : def.sample
  const data = def.hydrate({ ...sample }, rowsFor(def, binding))
  const template = widgetTemplateOf(def, { ...data, design: designFor(def, binding) }, input.lang)
  res.json({
    name: def.name,
    widgetType: def.widgetType,
    content: template.content,
    // The exact widget_template a widget would receive.
    template,
  })
})

/* --------------------------------- studio --------------------------------- */

/**
 * Making a template without writing one.
 *
 * `/studio/generate` is the model call: a screenshot, a paste of markup or a
 * sentence goes in and a template spec comes back, unsaved. `/custom` is the
 * ordinary CRUD around what the operator keeps. The split matters — generating
 * costs a model call and saving does not, so the dashboard can let someone
 * iterate on a design and only write to the registry when they are happy.
 */

// The dashboard downscales before it uploads; this is the backstop, and it sits
// under the server's 2mb JSON limit so an oversized image fails with a sentence
// an operator can act on instead of a bare 413.
const MAX_IMAGE_BYTES = 1_400_000

const studioBody = z.object({
  image: z
    .object({
      mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
      data: z.string().min(1),
    })
    .optional(),
  html: z.string().max(40_000).optional(),
  prompt: z.string().max(2000).optional(),
  previous: z
    .object({
      html: z.string().max(40_000),
      fields: z.array(z.object({ key: z.string(), type: z.string(), description: z.string().default('') })).default([]),
    })
    .optional(),
})

templatesRouter.get(
  '/studio/status',
  asyncHandler(async (_req, res) => {
    res.json({ ready: studioReady() })
  }),
)

templatesRouter.post(
  '/studio/generate',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const body = studioBody.parse(req.body)
    if (body.image && Buffer.byteLength(body.image.data, 'base64') > MAX_IMAGE_BYTES) {
      throw badRequest('That image is too large. Shrink it, or paste the markup instead.')
    }
    const spec = await generateTemplate(body)
    // Returned, not saved: the operator previews it and decides.
    res.json({ template: spec })
  }),
)

/**
 * Renders an unsaved body against unsaved values — what the studio's live
 * preview draws while the operator edits. It is the same renderer the engine
 * uses at chat time, so what they are looking at is the card, not a likeness
 * of it.
 */
templatesRouter.post(
  '/studio/preview',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({ html: z.string().max(60_000), sample: z.record(z.unknown()).default({}) })
      .parse(req.body)
    res.json({ html: render(sanitizeHtml(body.html), { ...body.sample, rows: [] }) })
  }),
)

/* ---------------------------- studio templates ----------------------------- */

templatesRouter.get(
  '/custom',
  asyncHandler(async (_req, res) => {
    res.json({ templates: listCustomTemplates() })
  }),
)

templatesRouter.get(
  '/custom/:name',
  asyncHandler(async (req, res) => {
    const def = getCustomTemplate(req.params.name)
    if (!def) throw notFound(`Template "${req.params.name}" not found`)
    res.json({ template: def })
  }),
)

templatesRouter.post(
  '/custom',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const def = await createCustomTemplate(customTemplateSchema.parse(req.body), req.user!.email)
    res.status(201).json({ template: def })
  }),
)

templatesRouter.patch(
  '/custom/:name',
  requireRole('editor'),
  asyncHandler(async (req, res) => {
    const patch = customTemplateSchema.omit({ name: true }).partial().parse(req.body)
    res.json({ template: await updateCustomTemplate(req.params.name, patch, req.user!.email) })
  }),
)

templatesRouter.delete(
  '/custom/:name',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteCustomTemplate(req.params.name)
    res.status(204).end()
  }),
)

/**
 * Registered after the studio's literal paths: `/:name/preview` would otherwise
 * match `/studio/preview` with a template called "studio", and answer 404 for a
 * route that exists.
 */
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
