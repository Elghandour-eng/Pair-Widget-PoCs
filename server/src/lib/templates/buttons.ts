import { componentsToTemplate, hydrateComponents } from './hydrate.js'

/**
 * The buttons a template draws, read off the template itself: its sample is drawn the way the widget draws it, and
 * every `actions` list in it is a button the widget dispatches (the same contract every card renderer follows). Each
 * button says what kind it is, where it sits (once per product, per slot, or once for the card) and the fields of the
 * item it sits on, so an agent's action can be put behind it and fed from that item ({{item.<path>}}).
 */
export interface TemplateButton {
  /** the button's kind, e.g. add_to_cart — what an agent's action is put behind */
  kind: string
  /** its label in the sample */
  label: string
  /** where it sits in the card: "products[]" (one per product), "collection" (one for the card)… */
  where: string
  /** one per item of a list (true) or one for the card (false) */
  perItem: boolean
  /** what the button already sends by itself (its payload's keys) */
  sends: string[]
  /** the fields of the item it sits on, with the sample's value: what {{item.<path>}} can read */
  fields: Array<{ path: string; example: string }>
}

type Row = Record<string, unknown>
const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)

/** An item's readable fields: its scalars, nested objects followed a few levels down, lists left out. */
function fieldsOf(item: Row): TemplateButton['fields'] {
  const out: TemplateButton['fields'] = []
  const walk = (v: Row, prefix: string, depth: number) => {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'actions' || k === 'action' || out.length >= 24) continue
      const path = prefix ? `${prefix}.${k}` : k
      if (isObj(x)) {
        if (depth < 3) walk(x, path, depth + 1)
      } else if (x !== null && x !== undefined && !Array.isArray(x) && String(x).trim() !== '') {
        out.push({ path, example: String(x).slice(0, 40) })
      }
    }
  }
  walk(item, '', 0)
  return out
}

export function templateButtons(name: string, sample: unknown): TemplateButton[] {
  let drawn: unknown
  try {
    drawn = componentsToTemplate(hydrateComponents([{ type: 'template', template: name, data: sample ?? {} }]) as Row[], 'a')
  } catch {
    return []
  }
  const content = isObj(drawn) ? drawn.content : undefined
  const out: TemplateButton[] = []
  const seen = new Set<string>()
  const walk = (v: unknown, where: string, perItem: boolean) => {
    if (Array.isArray(v)) {
      // a list's items look alike: the first one tells what each carries
      if (v.length) walk(v[0], `${where}[]`, true)
      return
    }
    if (!isObj(v)) return
    if (Array.isArray(v.actions)) {
      for (const a of v.actions) {
        if (!isObj(a) || typeof a.type !== 'string' || seen.has(a.type)) continue
        seen.add(a.type)
        out.push({
          kind: a.type,
          label: typeof a.label === 'string' ? a.label : '',
          where: where || 'card',
          perItem,
          sends: isObj(a.payload) ? Object.keys(a.payload) : [],
          fields: fieldsOf(v),
        })
      }
    }
    for (const [k, x] of Object.entries(v)) if (k !== 'actions') walk(x, where ? `${where}.${k}` : k, perItem)
  }
  walk(content, '', false)
  return out
}
