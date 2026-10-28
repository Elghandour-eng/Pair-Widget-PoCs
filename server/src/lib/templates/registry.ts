import type { Row } from '../dataSource.js'
import type { TemplateDesign } from './design.js'
import { menuItems } from '../../routes/cinescapeMenuSource.js'
import { PAIR_PLUGIN_TEMPLATES, type PluginRef } from './pairPlugin.js'
import { HIRO_TEMPLATES } from './hiro.js'
import { COMMERCE_TEMPLATES } from './commerce.js'
import { APP_LINKS, CINEMA_ROWS, EXPERIENCE_ITEMS, PRICE_ITEMS } from './seeds.js'

/**
 * The template registry — the *shape* half of the template engine.
 *
 * A template is a fixed contract with three sides: what the agent is allowed to
 * emit (`emits`, which is also what the prompt documents), what the server
 * expands that into (`hydrate`), and which SDK renderer draws the result
 * (`widgetType`). Nothing here is per-customer: a template names the rows it
 * needs, and a widget decides at bind time which data source supplies them.
 *
 * Adding a template means an entry here plus a renderer in the SDK. It does not
 * mean touching the chat route, and it does not mean shipping any data to the
 * browser — hydration happens server side and the widget receives only the
 * finished card.
 */

export interface TemplateField {
  key: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  description: string
}

/** The shelf a template sits on in the dashboard's catalog. */
export type TemplateCategory = 'health' | 'ticketing' | 'cinema' | 'media' | 'commerce'

export interface TemplateDef {
  /** What the agent writes in `"template"`. */
  name: string
  /** Which shelf of the catalog it belongs on; unset = `cinema`, where the first templates came from. */
  category?: TemplateCategory
  title: string
  description: string
  /** The SDK renderer that draws it. */
  widgetType: string
  /**
   * Set when the renderer takes Pair's native shape: these fields sit beside
   * `type` (a carousel's `carousel_type`), and the hydrated `config` travels
   * next to `content` instead of inside it.
   */
  envelope?: Record<string, unknown>
  /** True when several of these components in one reply become a single card list. */
  collects?: boolean
  /** What the agent may put in `data`. This is the contract the prompt repeats. */
  emits: TemplateField[]
  /** A worked example, shown in the dashboard catalog and copyable into a prompt. */
  sample: Record<string, unknown>
  /** The same example in Arabic, for the catalog's Arabic preview; unset previews `sample`. */
  sampleAr?: Record<string, unknown>
  /**
   * What the template renders when a widget has bound no source, or the bound
   * source has no good copy yet. A function, so a template whose fallback is
   * itself refreshed (the menu) hands back the current copy rather than a
   * table frozen at import time.
   */
  seed: () => Row[]
  /** True when the rows come from the agent alone and no source applies. */
  passthrough?: boolean
  /**
   * True when one reply may carry several cards of this kind and of other
   * stackable kinds: they are drawn one under the other, in the order the agent
   * sent them, instead of only the first being shown.
   */
  stackable?: boolean
  /**
   * Set on a plugin component: the orchestrator plugin, tool group and tool
   * whose call this template renders (see pairPlugin.ts). The card is produced
   * from the tool call, so it only ever appears for an agent with that group
   * installed.
   */
  plugin?: PluginRef
  /**
   * The design knobs this template honours, as keys of `DESIGN_FIELDS`. A knob
   * that is not listed is never offered for this template, because a control
   * that changes nothing is worse than no control.
   */
  design: string[]
  /** What the card looks like before anyone customises it. */
  designDefaults: TemplateDesign
  hydrate(data: Row, rows: Row[]): Row
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v ? v : fallback)
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((x) => !!x && typeof x === 'object') as Row[]) : [])

/* ------------------------------ menu helpers ------------------------------- */

interface MenuRow { name: string; name_ar: string; category: string; category_ar: string; price: string; image: string; cinemas: string[] }
const asMenu = (rows: Row[]): MenuRow[] => rows as unknown as MenuRow[]

/** Maps whatever the customer called a cinema to that feed's availability columns. */
const CINEMA_COLS: Array<[RegExp, string[]]> = [
  [/360/, ['360', '360 VIP']],
  [/avenue|أفنيوز|افنيوز/, ['Avenues', 'Avenues VIP']],
  [/kout|كوت/, ['Al Kout']],
  [/assima|عاصمة|العاصمه|skyline|سكاي/, ['Assima', 'Assima VIP', 'Skyline']],
  [/khiran|khairan|خيران/, ['Khairan', 'Khairan VIP']],
  [/warehouse|ويرهاوس/, ['Warehouse']],
  [/bairaq|بيرق/, ['Bairaq']],
  [/ajial|أجيال|اجيال/, ['Ajial']],
  [/1954|بيت الأفلام|film house/, ['1954']],
]

/* -------------------------------- templates -------------------------------- */

/** Order matters: `componentsToTemplate` sends the first template a reply matches. */
export const TEMPLATES: TemplateDef[] = [
  // Plugin components first: a ticket the agent just opened is the point of the
  // reply it arrives in, and must not lose its place to a card emitted beside it.
  ...PAIR_PLUGIN_TEMPLATES,
  ...HIRO_TEMPLATES,
  ...COMMERCE_TEMPLATES,
  {
    name: 'location_card',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize', 'imageRatio', 'showImage'],
    designDefaults: { radius: 16, padding: 12, titleSize: 14, imageRatio: '16:9', showImage: true },
    title: 'Location card',
    description: 'One branch: name, address, opening hours, photo and a maps link. Several in a reply become a card list. The agent sends only the id.',
    widgetType: 'location_cards',
    collects: true,
    emits: [
      { key: 'id', type: 'string', required: true, description: 'The branch id, exactly as the locations tool returned it.' },
      { key: 'distance_km', type: 'number', description: 'Optional, only when the customer shared their location.' },
    ],
    sample: { id: '1' },
    seed: () => CINEMA_ROWS,
    hydrate(data, rows) {
      const id = String(data.id ?? '')
      const full = rows.find((r) => String(r.id ?? '') === id)
      // The model's own fields (distance_km) win; the source fills everything else.
      return full ? { ...full, ...data } : data
    },
  },
  {
    name: 'price_list',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize', 'divider'],
    designDefaults: { radius: 16, padding: 16, titleSize: 14, divider: 'dashed' },
    title: 'Price list',
    description: 'A labelled price table in both languages. Sent empty it renders the full list; sent with items it renders just those.',
    widgetType: 'price_list',
    emits: [
      { key: 'items', type: 'array', description: 'Optional subset, each {label, label_en, price}. Omit it for the whole list.' },
      { key: 'title', type: 'string', description: 'Optional heading override.' },
    ],
    sample: { items: [{ label: 'VIP', label_en: 'VIP', price: '8.000' }] },
    seed: () => PRICE_ITEMS as unknown as Row[],
    hydrate(data, rows) {
      const items = arr(data.items).length > 0 ? arr(data.items) : rows
      return { title: str(data.title, 'أسعار التذاكر 🎬'), title_en: 'Ticket prices 🎬', currency: 'د.ك', currency_en: 'KD', items }
    },
  },
  {
    name: 'experiences_list',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize', 'divider'],
    designDefaults: { radius: 16, padding: 16, titleSize: 14, divider: 'dashed' },
    title: 'Experiences list',
    description: 'Every screen type with where it is available and what it costs. The listing answer only — never a follow-up about one experience.',
    widgetType: 'experiences_list',
    emits: [{ key: 'items', type: 'array', description: 'Optional subset. Omit it for the whole list.' }],
    sample: {},
    seed: () => EXPERIENCE_ITEMS as unknown as Row[],
    hydrate(data, rows) {
      const items = arr(data.items).length > 0 ? arr(data.items) : rows
      return { title: 'تجاربنا السينمائية ✨', title_en: 'Our cinema experiences ✨', items }
    },
  },
  {
    name: 'menu_categories',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize', 'columns', 'imageRatio'],
    designDefaults: { radius: 16, padding: 12, titleSize: 14, columns: 2, imageRatio: '1:1' },
    title: 'Menu categories',
    description: 'The concessions menu as category tiles, each with a photo and how many items it holds. Built from the menu source, so it never needs an argument.',
    widgetType: 'menu_categories',
    emits: [],
    sample: {},
    seed: () => menuItems() as unknown as Row[],
    hydrate(_data, rows) {
      const hidden = new Set(['VIP', 'Limited', 'Merchandise'])
      const order: string[] = []
      const byCat = new Map<string, { key: string; label: string; label_en: string; image: string; count: number }>()
      for (const m of asMenu(rows)) {
        if (hidden.has(m.category)) continue
        let c = byCat.get(m.category)
        if (!c) {
          c = { key: m.category, label: m.category_ar || m.category, label_en: m.category, image: '', count: 0 }
          byCat.set(m.category, c)
          order.push(m.category)
        }
        c.count++
        if (!c.image && m.image) c.image = m.image
      }
      return { title: 'المنيو 🍿', title_en: 'Our menu 🍿', items: order.map((k) => byCat.get(k)) }
    },
  },
  {
    name: 'movie_cards',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize', 'columns', 'imageRatio'],
    designDefaults: { radius: 16, padding: 10, titleSize: 13, columns: 2, imageRatio: '2:3' },
    title: 'Movie cards',
    description: 'Posters for what is showing. The rows come from the agent’s own live tool, so no source is bound and nothing is filled in here.',
    widgetType: 'movie_cards',
    passthrough: true,
    emits: [
      { key: 'items', type: 'array', required: true, description: 'Up to eight, each {title, title_ar, image, rating, genre, duration}, copied verbatim from the tool result.' },
    ],
    sample: { items: [{ title: 'The Odyssey', title_ar: 'الأوديسة', image: 'https://…/poster.jpg', rating: 'PG15', genre: 'Adventure, Drama', duration: '2h 35m' }] },
    seed: () => [],
    hydrate: (data) => data,
  },
  {
    name: 'app_links',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'buttonStyle'],
    designDefaults: { radius: 16, padding: 12, buttonStyle: 'filled' },
    title: 'App links',
    description: 'The App Store and Play Store buttons. Always sent empty — the store URLs are never written by the agent.',
    widgetType: 'app_links',
    emits: [],
    sample: {},
    seed: () => [APP_LINKS],
    hydrate: (_data, rows) => ({ ...(rows[0] ?? APP_LINKS) }),
  },
  {
    name: 'menu_list',
    design: ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize', 'columns', 'imageRatio', 'showImage'],
    designDefaults: { radius: 16, padding: 12, titleSize: 14, columns: 2, imageRatio: '1:1', showImage: true },
    title: 'Menu items',
    description: 'Concession items, filtered by branch, category or a name search. Renders as photo cards when the items have images, and as a price list when they do not.',
    widgetType: 'menu_cards',
    emits: [
      { key: 'category', type: 'string', description: 'One menu category, exactly as the categories tile shows it.' },
      { key: 'match', type: 'string', description: 'A name search ("popcorn", "قهوة") when the customer asked for one kind of item.' },
      { key: 'cinema', type: 'string', description: 'Optional branch filter, in the customer’s own words.' },
      { key: 'items', type: 'array', description: 'Named items; price and photo are filled in here from the source.' },
    ],
    sample: { category: 'Drinks' },
    seed: () => menuItems() as unknown as Row[],
    hydrate(data, rows) {
      const MENU = asMenu(rows)
      let items = arr(data.items)
      let title = typeof data.title === 'string' ? data.title : undefined
      let title_en = typeof data.title_en === 'string' ? data.title_en : undefined
      const cat = String(data.category ?? '').trim()
      const cinemaRaw = String(data.cinema ?? '').trim().toLowerCase()
      const cols = cinemaRaw ? CINEMA_COLS.find(([re]) => re.test(cinemaRaw))?.[1] : undefined
      const atCinema = (m: MenuRow) => (cols ? m.cinemas.some((c) => cols.includes(c)) : m.cinemas.length > 0)
      // a specific food type ("popcorn", "قهوة") filters by item name, never a whole category
      const match = String(data.match ?? '').trim()
      if (items.length === 0 && match) {
        const terms = match.toLowerCase().split(/[|,،\s]+/).filter((t) => t.length >= 2)
        const hits = MENU.filter((m) => {
          const hay = `${m.name} ${m.name_ar}`.toLowerCase()
          return terms.some((t) => hay.includes(t)) && atCinema(m)
        })
        items = hits.map((m) => ({ label: m.name_ar || m.name, label_en: m.name, price: m.price, image: m.image }))
        title = title ?? match.split(/[|,،]/)[0]
        title_en = title_en ?? match.split(/[|,،]/)[0]
      }
      if (items.length === 0 && cat) {
        const matched = MENU.filter((m) => m.category.toLowerCase() === cat.toLowerCase() && atCinema(m))
        // the price-list renderer reads label/label_en
        items = matched.map((m) => ({ label: m.name_ar || m.name, label_en: m.name, price: m.price, image: m.image }))
        title = title ?? matched[0]?.category_ar
        title_en = title_en ?? matched[0]?.category
      } else if (items.length > 0) {
        // normalize model-passed items and fill prices from the source by name
        items = items.map((it) => {
          const nm = String(it.name ?? it.label ?? '')
          const m = MENU.find((x) => x.name.toLowerCase() === nm.toLowerCase() || x.name_ar === (it.name_ar ?? it.label))
          return {
            label: (it.name_ar ?? it.label ?? m?.name_ar ?? m?.name ?? nm) as string,
            label_en: (it.name ?? it.label_en ?? m?.name ?? nm) as string,
            price: (it.price ?? m?.price ?? '') as string,
            image: (m?.image ?? '') as string,
          }
        })
      }
      return { title: title ?? 'المنيو 🍿', title_en: title_en ?? 'Menu 🍿', currency: 'د.ك', currency_en: 'KD', items }
    },
  },
]

export const TEMPLATES_BY_NAME = new Map(TEMPLATES.map((t) => [t.name, t]))

/**
 * Templates an operator made in the studio (see customTemplates.ts), kept
 * beside the compiled ones rather than inside them: everything downstream —
 * the catalog, hydration, a widget's bindings — goes through the two helpers
 * below, so a studio template is a first-class template everywhere without
 * the registry having to know how it was authored.
 *
 * They are held in memory because hydration is synchronous by design; Redis is
 * the copy that survives a restart, loaded once at boot.
 */
const CUSTOM = new Map<string, TemplateDef>()

export function registerCustom(def: TemplateDef): void {
  if (TEMPLATES_BY_NAME.has(def.name)) throw new Error(`"${def.name}" is a built-in template`)
  CUSTOM.set(def.name, def)
}

export function unregisterCustom(name: string): void {
  CUSTOM.delete(name)
}

export const isCustom = (name: string): boolean => CUSTOM.has(name)

/** Every template the engine knows, compiled-in first so registry order still decides a reply's card. */
export const allTemplates = (): TemplateDef[] => [...TEMPLATES, ...CUSTOM.values()]

export const templateByName = (name: string): TemplateDef | undefined => TEMPLATES_BY_NAME.get(name) ?? CUSTOM.get(name)

export const templateNames = (): string[] => allTemplates().map((t) => t.name)
