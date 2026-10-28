import { rowsOf } from '../dataSource.js'
import { cleanDesign, type TemplateDesign } from './design.js'
import { allTemplates, templateByName, type TemplateDef } from './registry.js'

/**
 * Turning an agent's component list into finished cards.
 *
 * The agent emits references — a branch id, a category name, an empty object —
 * and the rows behind them are resolved here, from whichever data source the
 * widget bound to that template, or the template's own seed when it bound
 * none. That keeps replies short and cheap (the model never spends tokens
 * copying a price table) and it means a card can never drift from its source.
 *
 * Resolution is deliberately synchronous: the bindings are read once per turn,
 * before the stream opens, so nothing inside the SSE loop awaits anything.
 */

export interface TemplateBinding {
  /** Template names this widget may render. `null` means every registered template. */
  enabled: Set<string> | null
  /** Template name → data source id. Anything unlisted falls back to the seed. */
  sources: Record<string, string>
  /** Template name → this widget's design overrides. Unlisted keys use the template's defaults. */
  designs?: Record<string, TemplateDesign>
}

export const ALL_TEMPLATES: TemplateBinding = { enabled: null, sources: {}, designs: {} }

/**
 * The design a card is drawn with: the template's defaults, with this widget's
 * overrides on top. Anything still unset is left for the renderer to take from
 * the widget's own theme, so a card is never given a colour nobody chose.
 */
export function designFor(def: TemplateDef, binding: TemplateBinding): TemplateDesign {
  return { ...def.designDefaults, ...cleanDesign(binding.designs?.[def.name], def.design) }
}

const allows = (binding: TemplateBinding, name: string): boolean => binding.enabled === null || binding.enabled.has(name)

/** The rows a template hydrates from: its bound source when that has a copy, its seed otherwise. */
export function rowsFor(def: TemplateDef, binding: TemplateBinding): Row[] {
  if (def.passthrough) return []
  const sourceId = binding.sources[def.name]
  const rows = sourceId ? rowsOf(sourceId) : []
  return rows.length > 0 ? rows : def.seed()
}

type Row = Record<string, unknown>

/**
 * The widget_template one card travels as. Most renderers read everything
 * from `content`; one in Pair's native shape (an `envelope` on its template)
 * also takes `config` beside it, and the envelope's own fields beside `type`.
 */
export function widgetTemplateOf(def: TemplateDef, data: Row, lang: 'ar' | 'en'): Row {
  if (!def.envelope) return { type: def.widgetType, content: { lang, ...data } }
  const { config, ...content } = data
  return { type: def.widgetType, ...def.envelope, content: { lang, ...content }, ...(config ? { config } : {}) }
}

/**
 * Expands every template component in the list. Non-template components pass
 * through untouched, an unregistered template name passes through so a newer
 * agent is never silently broken by an older server, and a template the widget
 * has not enabled is dropped.
 */
export function hydrateComponents(list: unknown, binding: TemplateBinding = ALL_TEMPLATES): unknown {
  if (!Array.isArray(list)) return list
  const out: unknown[] = []
  for (const c of list) {
    if (!c || typeof c !== 'object') {
      out.push(c)
      continue
    }
    const comp = c as Row
    if (comp.type !== 'template') {
      out.push(comp)
      continue
    }
    const def = templateByName(String(comp.template ?? ''))
    if (!def) {
      out.push(comp)
      continue
    }
    if (!allows(binding, def.name)) continue
    const data = (comp.data && typeof comp.data === 'object' ? comp.data : {}) as Row
    // `design` rides along with the card data: one object for the renderer to read,
    // rather than a second lookup the SDK would have to make.
    out.push({ ...comp, data: { ...def.hydrate(data, rowsFor(def, binding)), design: designFor(def, binding) } })
  }
  return out
}

/**
 * Builds the SDK's native widget_template from hydrated components. The first
 * template in registry order that the reply carries is the one that is sent —
 * a reply shows one card group, not a stack of them.
 *
 * `replyText` decides the language: cards follow the reply, not the widget's
 * view setting.
 */
export function componentsToTemplate(comps: Array<Row>, replyText: string): Row | undefined {
  const lang = /[؀-ۿ]/.test(replyText) ? 'ar' : 'en'
  // Stackable cards (Hiro's) travel together, in the order the agent sent them:
  // a trend and the scan behind it answer one question, and dropping the second
  // would answer half of it.
  const stacked = comps
    .filter((c) => c.type === 'template' && templateByName(String(c.template ?? ''))?.stackable)
    .map((c) => widgetTemplateOf(templateByName(String(c.template))!, (c.data ?? {}) as Row, lang))
  if (stacked.length > 1) return { type: 'stack', content: { lang, items: stacked.slice(0, 4) } }
  if (stacked.length === 1) return stacked[0]
  for (const def of allTemplates()) {
    const matches = comps.filter((c) => c.type === 'template' && c.template === def.name)
    if (matches.length === 0) continue
    if (def.collects) {
      const cards = matches.map((c) => c.data as Row).filter((d) => d && d.name)
      if (cards.length === 0) continue
      return { type: def.widgetType, content: { lang, cards } }
    }
    const data = (matches[0].data ?? {}) as Row
    // The menu renders as photo cards only when it has photos; without them the
    // price-list renderer is the honest one.
    if (def.name === 'menu_list') {
      const items = Array.isArray(data.items) ? (data.items as Array<{ image?: string }>) : []
      return { type: items.some((i) => i.image) ? 'menu_cards' : 'price_list', content: { lang, ...data } }
    }
    return widgetTemplateOf(def, data, lang)
  }
  return undefined
}
