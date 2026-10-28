/**
 * Boutiqaat's commerce cards without the studio around them: how each one travels to
 * the widget (its widget type, the envelope fields, the default display config) and
 * how a card the agent sent with raw catalogue products is tidied into the widget's
 * shape. Pure: no imports, so the studio and the templates render SDK (in a browser)
 * share this one copy.
 */

export type Row = Record<string, unknown>

export const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)

/** Deep merge for config: the agent's switches over the template's defaults. */
export function merge(base: Row, over: unknown): Row {
  if (!isObj(over)) return base
  const out: Row = { ...base }
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k] as Row, v) : v
  return out
}

export const list = (v: unknown, cap: number): Row[] => (Array.isArray(v) ? v.filter(isObj).slice(0, cap) : [])


export const TEXT_STYLES = {
  action: { color: '#1A1A1A', font_size: 13, font_family: 'inherit', font_weight: 500 },
  section_title: { color: '#1A1A1A', font_size: 16, font_family: 'inherit', font_weight: 600, line_height: 22 },
  primary_action: { color: '#FFFFFF', font_size: 13, font_family: 'inherit', font_weight: 500, line_height: 18 },
  offer_title: { color: '#1A1A1A', font_size: 15, font_family: 'inherit', font_weight: 600 },
  offer_description: { color: '#616161', font_size: 13, font_family: 'inherit', font_weight: 400 },
  offer_code: { color: '#1A1A1A', font_size: 11, font_family: 'inherit', font_weight: 600, text_transform: 'uppercase' },
  copy_code: { color: '#616161', font_size: 12, font_family: 'inherit', font_weight: 500 },
}

export const CAROUSEL_CONFIG = {
  style: { text_styles: TEXT_STYLES },
  layout: { scroll_type: 'horizontal', visible_items: 1, show_pagination_dots: true },
  carousel: { scrollable: true, visible_items: 2 },
  visibility: { show_code: true, show_title: true, show_actions: true, show_copy_code: true, show_description: true },
  product_card: { show_image: true, show_action: true },
}

/**
 * A product as Boutiqaat's catalogue returns it (Search PLP: id, name, brand,
 * thumbnail, price, selling_price, currency_code, is_sellable, qty_available),
 * turned into the card's shape. An agent can pass its search results straight
 * through. The discount is worked out from the two prices: the catalogue's own
 * `discount` field can disagree with them, so it is never shown.
 * A product already in the card's shape is kept as it came.
 */
const CDN = 'https://gamacdn.boutiqaat.com/media/catalog/product'
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}
export function catalogueProduct(p: Row): Row {
  if (isObj(p.price) || (p.selling_price === undefined && p.thumbnail === undefined)) return p
  const was = num(p.price)
  const now = num(p.selling_price) ?? was ?? 0
  const pct = was && was > now ? Math.round(((was - now) / was) * 100) : 0
  const id = String(p.id ?? p.product_id ?? '')
  const raw = String(p.image ?? p.thumbnail ?? '')
  const image = !raw || /^https?:\/\//.test(raw) ? raw : `${CDN}/${raw.replace(/^\/+/, '')}`
  const brand = isObj(p.brand) ? String(p.brand.name ?? '') : String(p.brand ?? '')
  const sellable = p.is_sellable === undefined || p.is_sellable === true || p.is_sellable === 'true' || p.is_sellable === '1'
  const stock = num(p.qty_available)
  const out: Row = {
    id,
    name: String(p.name ?? ''),
    brand,
    image,
    price: { current: now, ...(pct > 0 ? { old: was } : {}), currency: String(p.currency_code ?? p.currency ?? 'KWD') },
    availability: sellable && (stock === undefined || stock > 0) ? 'in_stock' : 'out_of_stock',
    // No label: the widget writes "Add to cart" / "أضف للسلة" in the card's language.
    actions: [{ id: `ADD${id}`, type: 'add_to_cart', label: '', payload: { product_id: id } }],
  }
  if (pct > 0) out.discount = { label: `${pct}% OFF`, percentage: pct }
  return out
}
/** A bundle from catalogue products: each line priced, the total worked out, and Add all to cart. */
export function catalogueCollection(d: Row): Row {
  const col = isObj(d.collection) ? d.collection : {}
  const raw = list(col.products, 10)
  if (!raw.some((p) => p.selling_price !== undefined || p.thumbnail !== undefined)) return d
  const fmt = (v: number, c: string) => `${v.toFixed(3)} ${c}`
  const products = raw.map((p) => {
    const c = catalogueProduct(p)
    const price = c.price as { current: number; currency: string }
    return { id: c.id, name: c.name, brand: c.brand, specs: String(p.specs ?? ''), note: String(p.note ?? ''), image: { url: c.image }, price: { value: price.current, currency: price.currency, formatted: fmt(price.current, price.currency) } }
  })
  const currency = products[0]?.price.currency ?? 'KWD'
  const total = products.reduce((t, p) => t + p.price.value, 0)
  return {
    ...d,
    collection: {
      id: 'collection',
      ...col,
      items_count: products.length,
      products,
      collection_total: { label: 'Total', value: total, currency, formatted: fmt(total, currency) },
      actions: [{ id: 'ADDCOLLECTION', type: 'add_collection_to_cart', label: 'Add Collection to Cart', payload: { products: products.map((p) => ({ product_id: p.id, quantity: 1 })) } }],
    },
  }
}
/** A comparison's product photos: a catalogue path becomes a full address. */
export function comparisonImages(d: Row): Row {
  const products = list(d.products, 4).map((p) => {
    const raw = isObj(p.image) ? String(p.image.url ?? '') : String(p.image ?? p.thumbnail ?? '')
    const url = !raw || /^https?:\/\//.test(raw) ? raw : `${CDN}/${raw.replace(/^\/+/, '')}`
    return { ...p, image: { url } }
  })
  // Rows keyed by product id; an agent that wrote the values as a list means the products' order.
  const ids = products.map((p) => String((p as Row).id ?? ''))
  const rows = list(d.rows, 30).map((r, i) => {
    const values = Array.isArray(r.values) ? Object.fromEntries(ids.map((id, j) => [id, (r.values as unknown[])[j] ?? '—'])) : r.values
    return { key: String(r.key ?? `row_${i + 1}`), ...r, values }
  })
  return { ...d, products, rows }
}
/** The carousel's View All: shown, with the catalogue's total, only past five products (the first five are the cards). */
export function catalogueCarousel(d: Row, cap: number): Row {
  const products = list(d.products, 12).map(catalogueProduct)
  const total = num(d.total_items)
  if (total === undefined) return { ...d, products }
  const { total_items: _t, ...rest } = d
  const header = isObj(d.header) ? d.header : {}
  const more = total > 5
  return {
    ...rest,
    // No label: the widget writes "View All" / "عرض الكل" in the card's language, with the count beside it.
    header: { icon: 'sparkles', ...header, view_all: { ...(isObj(header.view_all) ? header.view_all : {}), visible: more, count: total } },
    products: products.slice(0, Math.min(cap, 5)),
  }
}


export interface CommerceCard {
  widgetType: string
  /** Fields that travel beside `content` (carousel_type). */
  envelope?: Row
  /** The display switches the renderer reads; the agent's own `config` is laid over it. */
  config: Row
  /** Tidies the content the agent sent; the default keeps it as it came. */
  tidy?: (d: Row) => Row
}

const NO_CONFIG: Row = {}

export const COMMERCE_CARDS: Record<string, CommerceCard> = {
  product_carousel: { widgetType: 'carousel', envelope: { carousel_type: 'products' }, config: CAROUSEL_CONFIG, tidy: (d) => catalogueCarousel(d, 12) },
  product_card: { widgetType: 'carousel', envelope: { carousel_type: 'products' }, config: CAROUSEL_CONFIG, tidy: (d) => ({ ...d, products: list(d.products, 1).map(catalogueProduct) }) },
  product_routine: {
    widgetType: 'product_slots',
    config: {
    slot: {
      show_goal: true, show_order: true, show_action: true, show_category: true,
      timing_badges: { enabled: true, supported_values: ['AM', 'PM'] },
      show_how_to_use: true, show_description: true, show_when_to_use: true,
      recommended_product: { label: 'Recommended Product', show_name: true, show_brand: true, show_image: true, show_label: true, show_action: true, show_discount: true, show_old_price: true },
    },
    },
    tidy: (d) => ({
      ...d,
      slots: list(d.slots, 8).map((slot, i) => {
        const rp = isObj(slot.recommended_product) ? catalogueProduct(slot.recommended_product) : undefined
        if (!rp) return slot
        const sid = String(slot.id ?? `slot_${i + 1}`)
        const pid = String(rp.id ?? '')
        return { ...slot, id: sid, recommended_product: { ...rp, actions: [{ id: `ADD${sid}`, type: 'add_product', label: 'Add', payload: { slot_id: sid, product_id: pid } }] } }
      }),
    }),
  },
  product_collection: { widgetType: 'product_collection_suggestions', config: { layout: { variant: 'default' }, item_actions: { enabled: true, allowed_actions: ['remove'], display: 'inline' } }, tidy: catalogueCollection },
  product_info: { widgetType: 'informative', config: NO_CONFIG },
  product_comparison: {
    widgetType: 'product_comparison',
    config: { comparison: { max_visible_rows: 5, enable_expand_collapse: true, see_more_label: 'See more', see_less_label: 'See less', missing_value_fallback: '—' }, actions: { enabled: true, allowed_actions: ['add_product'] } },
    tidy: comparisonImages,
  },
  order_status: { widgetType: 'order_status', config: NO_CONFIG },
  wishlist: { widgetType: 'wishlist_products', config: NO_CONFIG },
  offers_carousel: { widgetType: 'carousel', envelope: { carousel_type: 'offers' }, config: CAROUSEL_CONFIG, tidy: (d) => ({ ...d, items: list(d.items, 8) }) },
  product_error: { widgetType: 'error_card', config: { style: { variant: 'warning' }, actions: { enabled: true } } },
}

/** The content the widget gets for a commerce card: tidied, with `config` merged over the default. */
export function commerceContent(name: string, data: Row): Row {
  const def = COMMERCE_CARDS[name]
  const { config: own, ...content } = data
  return { ...(def.tidy ? def.tidy(content) : content), config: merge(def.config, own) }
}

/** The widget_template for a commerce card, as the studio's render path builds it. */
export function commerceTemplate(name: string, data: Row, lang: 'ar' | 'en'): Row {
  const def = COMMERCE_CARDS[name]
  const { config, ...content } = commerceContent(name, data)
  return { type: def.widgetType, ...(def.envelope ?? {}), content: { lang, ...content }, ...(config ? { config } : {}) }
}
