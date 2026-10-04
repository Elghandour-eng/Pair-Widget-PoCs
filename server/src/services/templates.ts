import { badRequest } from '../lib/errors.js'
import { getSource } from '../lib/dataSource.js'
import { getSoon, keys, redis } from '../lib/redis.js'
import { cleanDesign, type TemplateDesign } from '../lib/templates/design.js'
import { ALL_TEMPLATES, type TemplateBinding } from '../lib/templates/hydrate.js'
import { TEMPLATES_BY_NAME } from '../lib/templates/registry.js'

/**
 * Which templates a widget may render, and where each one's rows come from.
 *
 * This is the record the dashboard's template catalog writes: enabling a
 * template for a widget and pointing it at a data source is a row in Redis,
 * not a code change. A widget with no record renders every registered template
 * from its seed, which is exactly how things behaved before this existed — so
 * nothing needs migrating.
 */

export interface WidgetTemplatesRecord {
  /** Template names this widget may render. `null` means all of them. */
  enabled: string[] | null
  /** Template name → data source id. */
  sources: Record<string, string>
  /** Template name → this widget's design overrides. This is what makes a shared template look customised. */
  designs: Record<string, TemplateDesign>
  updatedAt: string | null
  updatedBy: string | null
}

const EMPTY: WidgetTemplatesRecord = { enabled: null, sources: {}, designs: {}, updatedAt: null, updatedBy: null }

export async function getWidgetTemplates(widgetId: string): Promise<WidgetTemplatesRecord> {
  const raw = await getSoon(keys.widgetTemplates(widgetId))
  if (!raw) return { ...EMPTY }
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetTemplatesRecord>
    return {
      enabled: Array.isArray(parsed.enabled) ? parsed.enabled : null,
      sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
      designs: parsed.designs && typeof parsed.designs === 'object' ? parsed.designs : {},
      updatedAt: parsed.updatedAt ?? null,
      updatedBy: parsed.updatedBy ?? null,
    }
  } catch {
    return { ...EMPTY }
  }
}

export async function saveWidgetTemplates(
  widgetId: string,
  patch: { enabled?: string[] | null; sources?: Record<string, string>; designs?: Record<string, TemplateDesign> },
  actor: string,
): Promise<WidgetTemplatesRecord> {
  const current = await getWidgetTemplates(widgetId)
  const enabled = patch.enabled === undefined ? current.enabled : patch.enabled
  const sources = patch.sources ?? current.sources
  const designs = patch.designs ?? current.designs
  // A name or source id that does not exist would fail silently at render time,
  // which is the worst place to find out, so it fails on the form instead.
  for (const name of enabled ?? []) {
    if (!TEMPLATES_BY_NAME.has(name)) throw badRequest(`Unknown template "${name}".`)
  }
  for (const [name, sourceId] of Object.entries(sources)) {
    if (!TEMPLATES_BY_NAME.has(name)) throw badRequest(`Unknown template "${name}".`)
    if (sourceId && !getSource(sourceId)) throw badRequest(`Unknown data source "${sourceId}".`)
  }
  // Each design is cleaned against its own template's knobs, so a value that
  // template would ignore is never stored and never shown back as if it applied.
  const cleanedDesigns: Record<string, TemplateDesign> = {}
  for (const [name, design] of Object.entries(designs)) {
    const def = TEMPLATES_BY_NAME.get(name)
    if (!def) throw badRequest(`Unknown template "${name}".`)
    const cleaned = cleanDesign(design, def.design)
    if (Object.keys(cleaned).length > 0) cleanedDesigns[name] = cleaned
  }
  const record: WidgetTemplatesRecord = {
    enabled,
    // A blank source id means "back to the seed", so it is removed rather than stored.
    sources: Object.fromEntries(Object.entries(sources).filter(([, v]) => !!v)),
    designs: cleanedDesigns,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  }
  await redis.set(keys.widgetTemplates(widgetId), JSON.stringify(record))
  cache.delete(widgetId)
  return record
}

/* ------------------------------ render-path cache --------------------------- */

/**
 * Hydration happens inside the streaming loop and must not await Redis, so the
 * binding is read once per turn and held briefly. The window is short enough
 * that a dashboard change shows up on the next message, and a save clears the
 * entry outright.
 */
const CACHE_MS = 30_000
const cache = new Map<string, { at: number; binding: TemplateBinding }>()

export async function bindingFor(widgetId: string): Promise<TemplateBinding> {
  const hit = cache.get(widgetId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.binding
  // A widget with no record, and a Redis that cannot be read, resolve the same
  // way on purpose: every template, from its seed. A chat turn is never held up
  // by this lookup and never fails because of it.
  const record = await getWidgetTemplates(widgetId)
  const binding: TemplateBinding = {
    enabled: record.enabled ? new Set(record.enabled) : null,
    sources: record.sources,
    designs: record.designs,
  }
  cache.set(widgetId, { at: Date.now(), binding })
  return binding
}

export const forgetBinding = (widgetId: string): void => void cache.delete(widgetId)
export { ALL_TEMPLATES }
