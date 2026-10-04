import type { Row } from '../dataSource.js'
import type { TemplateDef } from './registry.js'

/**
 * Component templates for the Pair plugin.
 *
 * Every other template is something the agent chooses to emit. These are not:
 * they are what a Pair plugin tool call *looks like* in the widget. When an
 * agent with the plugin installed opens a ticket, the customer should see the
 * ticket — its number, title and status — and not a sentence claiming one was
 * opened. So each template here names the plugin tool it mirrors, and the chat
 * route turns that tool's call (its arguments plus what the tool returned)
 * into the component, with no prompt change and nothing for the model to copy.
 *
 * The plugin's tool groups map onto them directly: `tickets` gives the ticket
 * card and the ticket list, `messaging` gives the link and image cards. An
 * agent without that group installed never calls the tool, so its widgets never
 * render the card; the dashboard reads the agent's plugins to say which apply.
 */
export interface PluginRef {
  /** The plugin in the orchestrator's catalogue. */
  id: 'pair'
  /** Its tool group there — what an agent installs. */
  group: 'tickets' | 'messaging'
  /** The tool whose call this template renders. */
  tool: string
}

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])

const card = { design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize'], designDefaults: { radius: 16, padding: 14, titleSize: 14 } }

export const PAIR_PLUGIN_TEMPLATES: TemplateDef[] = [
  {
    name: 'pair_ticket',
    ...card,
    title: 'Ticket card',
    description: 'The ticket the agent just opened for the human team: its number, title, priority and status. Rendered from the pair_create_ticket call itself.',
    widgetType: 'ticket_card',
    passthrough: true,
    plugin: { id: 'pair', group: 'tickets', tool: 'pair_create_ticket' },
    emits: [
      { key: 'title', type: 'string', required: true, description: 'Short title, as passed to the tool.' },
      { key: 'description', type: 'string', description: 'What happened.' },
      { key: 'priority', type: 'string', description: 'low | medium | high.' },
      { key: 'ticket_id', type: 'string', description: 'Filled from the tool result; never written by the agent.' },
    ],
    sample: { ticket_id: 'TCK-1042', title: 'Refund for a cancelled show', description: 'Charged twice for the 9 PM booking.', priority: 'high', status: 'open' },
    seed: () => [],
    hydrate: (data) => ({
      ticket_id: s(data.ticket_id),
      title: s(data.title),
      description: s(data.description),
      priority: PRIORITIES.has(s(data.priority).toLowerCase()) ? s(data.priority).toLowerCase() : 'medium',
      status: s(data.status) || 'open',
    }),
  },
  {
    name: 'pair_tickets',
    ...card,
    design: [...card.design, 'divider'],
    title: 'Ticket list',
    description: 'The tickets already open on this conversation, when the customer asks where a case stands. Rendered from pair_list_tickets.',
    widgetType: 'ticket_list',
    passthrough: true,
    plugin: { id: 'pair', group: 'tickets', tool: 'pair_list_tickets' },
    emits: [{ key: 'items', type: 'array', required: true, description: 'Each {ticket_id, title, status, priority}, from the tool result.' }],
    sample: { items: [{ ticket_id: 'TCK-1042', title: 'Refund for a cancelled show', status: 'open', priority: 'high' }, { ticket_id: 'TCK-0998', title: 'Lost item at Avenues', status: 'resolved', priority: 'low' }] },
    seed: () => [],
    hydrate: (data) => ({
      items: (Array.isArray(data.items) ? (data.items as Row[]) : [])
        .map((t) => ({ ticket_id: s(t.ticket_id ?? t.ulid ?? t.id ?? t.number), title: s(t.title ?? t.subject), status: s(t.status) || 'open', priority: s(t.priority).toLowerCase() }))
        .filter((t) => t.title || t.ticket_id),
    }),
  },
  {
    name: 'pair_link',
    ...card,
    design: [...card.design, 'buttonStyle'],
    designDefaults: { ...card.designDefaults, buttonStyle: 'filled' },
    title: 'Link button',
    description: 'One link as a card with a button — a payment page, a booking page — instead of a URL pasted into the text. Rendered from pair_send_link.',
    widgetType: 'link_card',
    passthrough: true,
    plugin: { id: 'pair', group: 'messaging', tool: 'pair_send_link' },
    emits: [
      { key: 'url', type: 'string', required: true, description: 'The link.' },
      { key: 'cta_text', type: 'string', required: true, description: 'Button label.' },
      { key: 'header', type: 'string', description: 'Short header.' },
      { key: 'text', type: 'string', description: 'One line explaining the link.' },
    ],
    sample: { header: 'الدفع · ٩٥ د.ك', text: 'ادفع من الرابط وأكد لي لما تخلص', cta_text: 'ادفع الحين', url: 'https://example.com/pay/abc' },
    seed: () => [],
    hydrate: (data) => ({ header: s(data.header), text: s(data.text), cta_text: s(data.cta_text), url: /^https?:\/\//i.test(s(data.url)) ? s(data.url) : '' }),
  },
  {
    name: 'pair_image',
    design: ['surface', 'border', 'radius', 'padding', 'imageRatio'],
    designDefaults: { radius: 16, padding: 0, imageRatio: '4:3' },
    title: 'Image',
    description: 'A picture with an optional caption — a product, a label, a seating map. Rendered from pair_send_image.',
    widgetType: 'image_card',
    passthrough: true,
    plugin: { id: 'pair', group: 'messaging', tool: 'pair_send_image' },
    emits: [
      { key: 'url', type: 'string', required: true, description: 'Public image URL.' },
      { key: 'caption', type: 'string', description: 'Caption.' },
    ],
    sample: { url: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000008.jpg?v=741', caption: 'Cinescape Avenues' },
    seed: () => [],
    hydrate: (data) => ({ url: /^https?:\/\//i.test(s(data.url)) ? s(data.url) : '', caption: s(data.caption) }),
  },
]

const BY_TOOL = new Map(PAIR_PLUGIN_TEMPLATES.map((t) => [t.plugin!.tool, t]))

const parse = (v: unknown): unknown => {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return undefined
  }
}
const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {})

/** Pair answers with the record, sometimes wrapped in `data`; the id has gone by several names. */
function ticketId(result: unknown): string {
  const r = obj(result)
  const d = obj(r.data)
  return s(d.number ?? d.ulid ?? d.id ?? d.ticket_id ?? r.number ?? r.ulid ?? r.id ?? r.ticket_id)
}

/**
 * The component a plugin tool call stands for, or null when the tool is not one
 * of ours or the call carried nothing to show.
 *
 * `toolInput` is the arguments the model passed and `observation` what the tool
 * returned, both as the engine streams them on `agent_thought` — JSON text in
 * the normal case, anything at all when the tool failed. A failed send still
 * yields the card: in the widget the card *is* the delivery, and the Pair
 * conversation the tool would have posted to does not exist for an SSE widget.
 * A ticket is the exception that matters — without an id from the result it is
 * shown as pending, never as open, because no human team can see it.
 */
export function componentFromTool(tool: string, toolInput: unknown, observation: unknown): Row | null {
  const def = BY_TOOL.get(tool)
  if (!def) return null
  const args = obj(parse(toolInput))
  const result = parse(observation)
  if (tool === 'pair_create_ticket') {
    if (!s(args.title)) return null
    const id = ticketId(result)
    return { type: 'template', template: def.name, data: { ...args, ticket_id: id, status: id ? 'open' : 'pending' } }
  }
  if (tool === 'pair_list_tickets') {
    const r = obj(result)
    const items = Array.isArray(result) ? result : Array.isArray(r.data) ? r.data : Array.isArray(r.tickets) ? r.tickets : []
    return items.length > 0 ? { type: 'template', template: def.name, data: { items } } : null
  }
  if (!s(args.url)) return null
  return { type: 'template', template: def.name, data: args }
}

/** pair_send_buttons has no card of its own: its buttons are the widget's existing single-choice question. */
export function questionFromButtons(tool: string, toolInput: unknown): Row | null {
  if (tool !== 'pair_send_buttons') return null
  const args = obj(parse(toolInput))
  const buttons = (Array.isArray(args.buttons) ? args.buttons : []).map(s).filter(Boolean)
  if (buttons.length < 2) return null
  return { type: 'question', text: s(args.text), select: 'single', options: buttons.map((b) => ({ id: b, label: b })) }
}
