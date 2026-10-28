import type { TemplateDef } from './registry.js'

/**
 * Boutiqaat's commerce cards: the product carousel, the routine, the bundle,
 * product details, comparison, order tracking, wishlist and offers that Pair's
 * own e-commerce agent sends.
 *
 * The widget already draws every one of them (the Pair-native renderers in the
 * SDK's widget-template folder). These entries put them in the catalog: the
 * agent can name them, a widget can switch them on, and the dashboard shows
 * each with a full example.
 *
 * Each card is `passthrough` — the products are the agent's own search results
 * for this turn — and travels as the SDK expects it: `content` with the card's
 * data, `config` beside it (the display switches the renderer reads), and for
 * the carousels the `carousel_type` that picks the renderer. `config` is the
 * template's default with whatever the agent sent laid over it.
 *
 * `hydrate` keeps the shape and drops what is not an object; it never invents
 * a product.
 */

type Row = Record<string, unknown>

const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)

/** Deep merge for config: the agent's switches over the template's defaults. */
function merge(base: Row, over: unknown): Row {
  if (!isObj(over)) return base
  const out: Row = { ...base }
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k] as Row, v) : v
  return out
}

const list = (v: unknown, cap: number): Row[] => (Array.isArray(v) ? v.filter(isObj).slice(0, cap) : [])

/** Example photos, shipped with the widget under /sdk/samples. */
const IMG = {
  moodi: 'samples/moodi-lady-powder-set.jpg',
  bakhoor: 'samples/maamoul-murshed-bakhoor.jpg',
  serums: 'samples/serum-set.jpg',
  skincare: 'samples/skincare-model.jpg',
}

const TEXT_STYLES = {
  action: { color: '#1A1A1A', font_size: 13, font_family: 'inherit', font_weight: 500 },
  section_title: { color: '#1A1A1A', font_size: 16, font_family: 'inherit', font_weight: 600, line_height: 22 },
  primary_action: { color: '#FFFFFF', font_size: 13, font_family: 'inherit', font_weight: 500, line_height: 18 },
  offer_title: { color: '#1A1A1A', font_size: 15, font_family: 'inherit', font_weight: 600 },
  offer_description: { color: '#616161', font_size: 13, font_family: 'inherit', font_weight: 400 },
  offer_code: { color: '#1A1A1A', font_size: 11, font_family: 'inherit', font_weight: 600, text_transform: 'uppercase' },
  copy_code: { color: '#616161', font_size: 12, font_family: 'inherit', font_weight: 500 },
}

const CAROUSEL_CONFIG = {
  style: { text_styles: TEXT_STYLES },
  layout: { scroll_type: 'horizontal', visible_items: 1, show_pagination_dots: true },
  carousel: { scrollable: true, visible_items: 2 },
  visibility: { show_code: true, show_title: true, show_actions: true, show_copy_code: true, show_description: true },
  product_card: { show_image: true, show_action: true },
}

const add = (id: string, label = 'Add to cart') => [{ id: `ADD${id}`, type: 'add_to_cart', label, payload: { product_id: id } }]

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
function catalogueProduct(p: Row): Row {
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
function catalogueCollection(d: Row): Row {
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
function comparisonImages(d: Row): Row {
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
function catalogueCarousel(d: Row, cap: number): Row {
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

const PRODUCTS = [
  { id: 'P1001', name: 'Lady Powder White Set - 3 pcs', brand: 'Moodi Scent', image: IMG.moodi, price: { old: 23.999, current: 23, currency: 'KWD' }, discount: { label: '30% OFF', percentage: 30 }, availability: 'in_stock', actions: add('P1001') },
  { id: 'P1002', name: 'Brightening Serum Trio', brand: 'Minimalist', image: IMG.serums, price: { current: 25, currency: 'KWD' }, availability: 'in_stock', actions: add('P1002') },
  { id: 'P1003', name: 'Black Bakhoor - Ramadan Edition', brand: "Ma'moul Murshed", image: IMG.bakhoor, price: { old: 12.5, current: 9.75, currency: 'KWD' }, discount: { label: '22% OFF', percentage: 22 }, availability: 'in_stock', actions: add('P1003') },
  { id: 'P1004', name: 'Hydrating Glow Cream - 50ml', brand: 'Rhode', image: IMG.skincare, price: { current: 18.5, currency: 'KWD' }, availability: 'out_of_stock', actions: add('P1004') },
]

/** A commerce card: passthrough, its own shelf, and `config` merged over the template's default. */
function card(
  def: Omit<TemplateDef, 'passthrough' | 'seed' | 'design' | 'designDefaults' | 'category' | 'hydrate'> & {
    config: Row
    envelope?: Row
    /** Tidies the content the agent sent; the default keeps it as it came. */
    tidy?: (d: Row) => Row
  },
): TemplateDef {
  const { config, envelope, tidy, ...rest } = def
  return {
    ...rest,
    category: 'commerce',
    passthrough: true,
    seed: () => [],
    design: [],
    designDefaults: {},
    envelope: envelope ?? {},
    hydrate: (d) => {
      const { config: own, ...content } = d
      return { ...(tidy ? tidy(content) : content), config: merge(config, own) }
    },
  }
}

export const COMMERCE_TEMPLATES: TemplateDef[] = [
  card({
    name: 'product_carousel',
    title: 'Boutiqaat · Products carousel',
    description: 'A sideways row of product cards — photo, brand, name, price with the old price and discount, stock, and Add to cart — under a heading with View all.',
    widgetType: 'carousel',
    envelope: { carousel_type: 'products' },
    config: CAROUSEL_CONFIG,
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the card.' },
      { key: 'header', type: 'object', description: '{icon: "sparkles" | "flame" | "gift" | "heart" | "star" | "tag" | "zap", title, view_all: {label, visible}}.' },
      { key: 'products', type: 'array', required: true, description: 'Up to 12, each {id, name, brand, image, price: {current, old?, currency}, discount?: {label, percentage}, availability: "in_stock" | "out_of_stock", actions: [{type: "add_to_cart", label, payload: {product_id}}]}.' },
      { key: 'description_text', type: 'string', description: 'A line under the card.' },
    ],
    sample: {
      intro_text: 'Here are the top moisturizers from Boutiqaat.',
      header: { icon: 'sparkles', title: 'Top Moisturizers', view_all: { label: 'View All', visible: true } },
      products: PRODUCTS,
      description_text: 'Suitable for daily use.',
    },
    tidy: (d) => catalogueCarousel(d, 12),
  }),
  card({
    name: 'product_card',
    title: 'Boutiqaat · Single product',
    description: 'One product on its own: photo, brand, name, price and Add to cart, with no carousel around it.',
    widgetType: 'carousel',
    envelope: { carousel_type: 'products' },
    config: CAROUSEL_CONFIG,
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the card.' },
      { key: 'header', type: 'object', description: '{icon, title, view_all: {visible: false}}.' },
      { key: 'products', type: 'array', required: true, description: 'Exactly one product, shaped as in product_carousel.' },
      { key: 'description_text', type: 'string', description: 'A line under the card.' },
    ],
    sample: {
      intro_text: 'Here is a pick for you.',
      header: { icon: 'sparkles', title: 'Our pick', view_all: { label: 'View All', visible: false } },
      products: [PRODUCTS[0]],
      description_text: 'Suitable for daily use.',
    },
    tidy: (d) => ({ ...d, products: list(d.products, 1).map(catalogueProduct) }),
  }),
  card({
    name: 'product_routine',
    title: 'Boutiqaat · Routine',
    description: 'A step-by-step routine: each step with its category, goal, how and when to use it (AM / PM), and a recommended product to add.',
    widgetType: 'product_slots',
    config: {
      slot: {
        show_goal: true, show_order: true, show_action: true, show_category: true,
        timing_badges: { enabled: true, supported_values: ['AM', 'PM'] },
        show_how_to_use: true, show_description: true, show_when_to_use: true,
        recommended_product: { label: 'Recommended Product', show_name: true, show_brand: true, show_image: true, show_label: true, show_action: true, show_discount: true, show_old_price: true },
      },
    },
    emits: [
      { key: 'intro_text', type: 'string', description: 'The routine’s opening line.' },
      { key: 'slots', type: 'array', required: true, description: 'Up to 8 steps, each {id, order, title, category, goal, description, how_to_use, when_to_use: ["AM","PM"], recommended_product: {id, name, brand, image, price: {current, old?, currency}, discount?, actions: [{type: "add_product", label, payload: {slot_id, product_id}}]}}.' },
      { key: 'closing_text', type: 'string', description: 'A closing line under the steps.' },
    ],
    sample: {
      intro_text: '✨ Your Glow Routine is Ready! Based on your goal for brightening and oily skin type, I’ve built this custom routine, just for you.',
      slots: [
        ['Cleanse', 'Gentle Foaming Cleanser', 'A refreshing start to clear and prep your skin.', 'Removes impurities while preserving moisture.', 'Massage onto damp skin for 60 seconds and rinse.', ['AM', 'PM']],
        ['Treat', 'Vitamin C + Hyaluronic Glow Serum', 'The powerhouse step for a bright and plump glow.', 'Fades dark spots and boosts radiance.', 'Apply 2–3 drops after cleansing.', ['AM']],
        ['Moisturize', 'Lightweight Sorbet Moisturizer', 'A weightless barrier to lock in your skin’s hydration.', 'Hydrates without clogging pores.', 'Smooth over face and neck.', ['AM', 'PM']],
        ['Protect', 'Invisible Sunscreen Veil', 'Your daily shield against UV damage and aging.', 'Prevents new dark spots.', 'Apply generously as the last step.', ['AM']],
      ].map(([category, title, description, goal, how, when], i) => ({
        id: `slot_${i + 1}`, order: i + 1, title, category, goal, description, how_to_use: how, when_to_use: when,
        recommended_product: {
          id: PRODUCTS[0].id, name: PRODUCTS[0].name, brand: PRODUCTS[0].brand, image: PRODUCTS[0].image,
          price: PRODUCTS[0].price, discount: PRODUCTS[0].discount,
          actions: [{ id: `ADDSLOT${i + 1}`, type: 'add_product', label: 'Add', payload: { slot_id: `slot_${i + 1}`, product_id: PRODUCTS[0].id, source_template_type: 'product_recommendation_slots' } }],
        },
      })),
      closing_text: 'This set provides everything your skin needs for a complete glow-up while staying within your preferred step count. Would you like me to add this entire routine to your cart?',
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
  }),
  card({
    name: 'product_collection',
    title: 'Boutiqaat · Suggested products',
    description: 'A bundle of products with a line on each, the total, and Add collection to cart.',
    widgetType: 'product_collection_suggestions',
    config: { layout: { variant: 'default' }, item_actions: { enabled: true, allowed_actions: ['remove'], display: 'inline' } },
    tidy: catalogueCollection,
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the card.' },
      { key: 'collection', type: 'object', required: true, description: '{title, items_count, products: [{id, name, brand, specs, note, image: {url}, price: {value, currency, formatted}}], collection_total: {label, value, currency, formatted}, actions: [{type: "add_collection_to_cart", label}]}.' },
    ],
    sample: {
      intro_text: 'Here’s a set picked for a dewy glow:',
      collection: {
        id: 'col_1',
        title: 'Suggested Products',
        items_count: 3,
        products: [
          { id: 'P1001', brand: 'Moodi Scent', name: 'White Truffle Spray Serum', specs: '100 ml', note: 'The ‘hero’ product for an instant, dewy glow.', image: { url: IMG.moodi }, price: { value: 5, currency: 'KWD', formatted: '5.000 KWD' } },
          { id: 'P1004', brand: 'Rhode', name: 'Glazing Milk', specs: '150 ml', note: 'Calms and preps skin for the next step.', image: { url: IMG.skincare }, price: { value: 5, currency: 'KWD', formatted: '5.000 KWD' } },
          { id: 'P1002', brand: 'Minimalist', name: 'Aqua Heartleaf Toner', specs: '50 ml', note: 'Balances oil without drying.', image: { url: IMG.serums }, price: { value: 5, currency: 'KWD', formatted: '5.000 KWD' } },
        ],
        collection_total: { label: 'Total', value: 15, currency: 'KWD', formatted: '15.000 KWD' },
        actions: [{ id: 'ADDCOL1', type: 'add_collection_to_cart', label: 'Add Collection to Cart', payload: { products: [{ product_id: 'P1001', quantity: 1 }, { product_id: 'P1004', quantity: 1 }, { product_id: 'P1002', quantity: 1 }] } }],
      },
    },
  }),
  card({
    name: 'product_info',
    title: 'Boutiqaat · Product details',
    description: 'A product explained in sections — key ingredients, how to use, available sizes — with an intro and a closing note.',
    widgetType: 'informative',
    config: {},
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the card.' },
      { key: 'header', type: 'object', required: true, description: '{title, items: [{title, description} | {title, description_type: "list", description_items: [...]}]}.' },
      { key: 'closing_text', type: 'string', description: 'A line under the card, e.g. a safety note.' },
    ],
    sample: {
      intro_text: 'This serum helps reduce pores, control excess oil, brighten skin tone, and fade dark spots — making it a great daily-use option for oily and acne-prone skin.',
      header: {
        title: 'Minimalist 10% Niacinamide',
        items: [
          { title: 'Key Ingredients:', description: '10% Niacinamide + 1% Zinc PCA' },
          { title: 'How to use:', description: 'Apply 2–3 drops on a cleansed face, morning and night. Follow with a moisturizer.' },
          { title: 'Available sizes:', description_type: 'list', description_items: ['30ml - 25.000 KWD', '60ml - 36.000 KWD (Low stock)'] },
        ],
      },
      closing_text: 'We recommend consulting with a dermatologist before adding this to your routine, especially if you have a known skin condition or are pregnant.',
    },
  }),
  card({
    name: 'product_comparison',
    title: 'Boutiqaat · Comparison',
    description: 'Two to four products side by side, one row per attribute, with See more and a recommendation.',
    widgetType: 'product_comparison',
    config: { comparison: { max_visible_rows: 5, enable_expand_collapse: true, see_more_label: 'See more', see_less_label: 'See less', missing_value_fallback: '—' }, actions: { enabled: true, allowed_actions: ['add_product'] } },
    tidy: comparisonImages,
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the table.' },
      { key: 'title', type: 'string', required: true, description: 'The table’s heading.' },
      { key: 'products', type: 'array', required: true, description: '2–4, each {id, name, image: {url}, subtitle?}.' },
      { key: 'rows', type: 'array', required: true, description: 'Each {key, label, value_type?: "text" | "price" | "percentage" | ..., values: {<product id>: value}}.' },
      { key: 'recommendation', type: 'object', description: '{title, text, recommended_product_id}.' },
    ],
    sample: {
      title: '📊 Full Comparison',
      products: [
        { id: 'C1', name: 'Callidus Care 2% Salicylic Acid', image: { url: IMG.serums } },
        { id: 'C2', name: 'd’Alba White Truffle First Serum', image: { url: IMG.moodi } },
      ],
      rows: [
        { key: 'benefit', label: 'Primary Benefit', values: { C1: 'Acne Proof & Glow', C2: 'Instant glow & hydration' } },
        { key: 'ingredients', label: 'Key Ingredients', values: { C1: 'Hyaluronic Acid, Grape extract', C2: 'White Truffle, Niacinamide' } },
        { key: 'price', label: 'Price', value_type: 'price', values: { C1: '72.000 KWD', C2: '89.000 KWD' } },
        { key: 'bha', label: 'BHA%', value_type: 'percentage', values: { C1: '2%', C2: '2%' } },
        { key: 'value', label: 'Value', values: { C1: '8.000 KWD/ml', C2: '8.000 KWD/ml' } },
        { key: 'skin', label: 'Best for', values: { C1: 'Oily, acne-prone', C2: 'Dry, dull' } },
      ],
      recommendation: { title: 'Our pick', text: 'For oily, acne-prone skin, Callidus Care is the better match.', recommended_product_id: 'C1' },
    },
  }),
  card({
    name: 'order_status',
    title: 'Boutiqaat · Order status',
    description: 'One order: its status, the timeline of steps with dates, the items in it, and Go to order.',
    widgetType: 'order_status',
    config: {},
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the card.' },
      { key: 'order', type: 'object', required: true, description: '{order_number, status: {label, value}, refund_status?, summary: {placed_on, items_count, total_amount: {formatted}}, timeline: {items: [{id, label, status: "completed" | "active" | "pending", date, description?}]}, items: {visible_count, total_count, products: [{id, name, brand, image, price: {formatted}, attributes: [{label, value}]}]}, actions: [{type: "go_to_order", label}]}.' },
    ],
    sample: {
      intro_text: 'Here’s the latest on your order:',
      order: {
        id: 'O8821',
        order_number: '#8821',
        status: { label: 'Cancelled', value: 'cancelled' },
        refund_status: { label: 'Refund in Progress', value: 'refund_in_progress' },
        summary: { placed_on: '2026-04-19', items_count: 4, total_amount: { value: 20, currency: 'KWD', formatted: '20.000 KWD' } },
        timeline: {
          current_step_id: 'refund_initiated',
          items: [
            { id: 'placed', label: 'Placed', status: 'completed', date: '2026-04-23' },
            { id: 'shipped', label: 'Shipped', status: 'completed', date: '2026-04-23' },
            { id: 'out', label: 'Out for Delivery', status: 'completed', date: '2026-04-23' },
            { id: 'delivered', label: 'Delivered', status: 'completed', date: '2026-04-23' },
            { id: 'cancelled', label: 'Order Cancelled', status: 'completed', date: '2026-04-23' },
            { id: 'refund_initiated', label: 'Refund Initiated', status: 'active', date: '2026-04-23', description: 'Your refund request for 20.000 KWD has been received and approved.' },
            { id: 'refund_processing', label: 'Refund Processing', status: 'pending', date: null },
            { id: 'refund_completed', label: 'Refund Completed', status: 'pending', date: null },
          ],
        },
        items: {
          visible_count: 1,
          total_count: 4,
          products: [
            { id: 'G1', name: 'Niacinamide 10% Serum 30ml', brand: 'Gissah', image: IMG.serums, price: { value: 15, currency: 'KWD', formatted: '15.000 KWD' }, attributes: [{ label: 'Qty', value: '01' }, { label: 'Size', value: '30ml' }] },
            { id: 'G2', name: 'Lady Powder White Set - 3 pcs', brand: 'Moodi Scent', image: IMG.moodi, price: { value: 5, currency: 'KWD', formatted: '5.000 KWD' }, attributes: [{ label: 'Qty', value: '01' }] },
          ],
        },
        actions: [{ id: 'GOORDER', type: 'go_to_order', label: 'Go to Order', payload: { order_id: 'O8821' } }],
      },
    },
  }),
  card({
    name: 'wishlist',
    title: 'Boutiqaat · Wishlist',
    description: 'The visitor’s saved products, with a status badge on each and View all.',
    widgetType: 'wishlist_products',
    config: {},
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the card.' },
      { key: 'wishlist', type: 'object', required: true, description: '{title, items_count, visible_count, products: [{id, name, brand, image, subtitle?, price: {formatted}, status_badge?: {label, value}, availability}], actions: [{type: "view_all_wishlist", label}]}.' },
    ],
    sample: {
      intro_text: 'Here’s what you saved:',
      wishlist: {
        id: 'W1',
        title: 'Your Wishlist',
        items_count: 3,
        visible_count: 3,
        products: [
          { id: 'P1001', name: 'Lady Powder White Set - 3 pcs', brand: 'Moodi Scent', image: IMG.moodi, price: { value: 23, currency: 'KWD', formatted: '23.000 KWD' }, status_badge: { label: 'Price drop', value: 'price_drop' }, availability: 'in_stock' },
          { id: 'P1003', name: 'Black Bakhoor - Ramadan Edition', brand: "Ma'moul Murshed", image: IMG.bakhoor, price: { value: 9.75, currency: 'KWD', formatted: '9.750 KWD' }, status_badge: { label: 'Low stock', value: 'low_stock' }, availability: 'in_stock' },
          { id: 'P1004', name: 'Hydrating Glow Cream - 50ml', brand: 'Rhode', image: IMG.skincare, price: { value: 18.5, currency: 'KWD', formatted: '18.500 KWD' }, status_badge: null, availability: 'out_of_stock' },
        ],
        actions: [{ id: 'VIEWWL', type: 'view_all_wishlist', label: 'View all' }],
      },
    },
  }),
  card({
    name: 'offers_carousel',
    title: 'Boutiqaat · Offers',
    description: 'Promo codes as a sideways row of cards, each with its code, terms and a copy button.',
    widgetType: 'carousel',
    envelope: { carousel_type: 'offers' },
    config: CAROUSEL_CONFIG,
    emits: [
      { key: 'intro_text', type: 'string', description: 'A line above the offers.' },
      { key: 'title', type: 'string', description: 'The row’s heading.' },
      { key: 'items', type: 'array', required: true, description: 'Up to 8, each {id, code, title, description, actions: [{type: "copy_code", label}]}.' },
    ],
    sample: {
      intro_text: 'Today’s skincare deals:',
      title: 'Offers for you',
      items: [
        { id: 'O1', code: 'SUMMER20', title: '20% off skincare', description: 'On orders above 15 KWD. Ends Sunday.', actions: [{ type: 'copy_code', label: 'Copy code' }] },
        { id: 'O2', code: 'GLOW10', title: '10 KWD off routines', description: 'When you add a full routine to your cart.', actions: [{ type: 'copy_code', label: 'Copy code' }] },
        { id: 'O3', code: 'FREESHIP', title: 'Free delivery', description: 'On every order this week.', actions: [{ type: 'copy_code', label: 'Copy code' }] },
      ],
    },
    tidy: (d) => ({ ...d, items: list(d.items, 8) }),
  }),
  card({
    name: 'product_error',
    title: 'Boutiqaat · Nothing found',
    description: 'What the agent shows when a search or lookup comes back empty, with a way to try again.',
    widgetType: 'error_card',
    config: { style: { variant: 'warning' }, actions: { enabled: true } },
    emits: [
      { key: 'title', type: 'string', required: true, description: 'Short heading.' },
      { key: 'message', type: 'string', required: true, description: 'What happened and what to try.' },
      { key: 'actions', type: 'array', description: '[{type: "retry", label}].' },
    ],
    sample: {
      title: 'No products found',
      message: 'We couldn’t find moisturizers under 5 KWD. Try a wider price range.',
      actions: [{ id: 'RETRY', type: 'retry', label: 'Try again' }],
    },
  }),
]

/* --------------------------------- Arabic ---------------------------------- */

/** Every line of the examples in Arabic, so the catalog shows each card in both languages. */
const AR: Record<string, string> = {
  'Here are the top moisturizers from Boutiqaat.': 'هذي أفضل المرطبات من بوتيكات.',
  'Top Moisturizers': 'أفضل المرطبات',
  'View All': 'عرض الكل',
  'View all': 'عرض الكل',
  'Lady Powder White Set - 3 pcs': 'مجموعة ليدي باودر وايت - ٣ قطع',
  'Moodi Scent': 'مودي سينت',
  'Add to cart': 'أضف إلى السلة',
  'Brightening Serum Trio': 'ثلاثية سيروم التفتيح',
  Minimalist: 'مينيماليست',
  'Black Bakhoor - Ramadan Edition': 'بخور أسود - إصدار رمضان',
  "Ma'moul Murshed": 'معمول مرشود',
  'Hydrating Glow Cream - 50ml': 'كريم الترطيب والنضارة - ٥٠ مل',
  Rhode: 'رود',
  'Suitable for daily use.': 'مناسب للاستخدام اليومي.',
  'Here is a pick for you.': 'هذا اختيار لك.',
  'Our pick': 'اختيارنا',
  '✨ Your Glow Routine is Ready! Based on your goal for brightening and oily skin type, I’ve built this custom routine, just for you.':
    '✨ روتين النضارة جاهز! على حسب هدفك للتفتيح ونوع بشرتك الدهنية، جهزت لك هالروتين الخاص فيك.',
  'Gentle Foaming Cleanser': 'غسول رغوي لطيف',
  Cleanse: 'تنظيف',
  'Removes impurities while preserving moisture.': 'يزيل الشوائب ويحافظ على الترطيب.',
  'A refreshing start to clear and prep your skin.': 'بداية منعشة تنظف بشرتك وتجهزها.',
  'Massage onto damp skin for 60 seconds and rinse.': 'دلكيه على بشرة مبللة لمدة ٦٠ ثانية واشطفيه.',
  Add: 'أضف',
  'Vitamin C + Hyaluronic Glow Serum': 'سيروم فيتامين سي والهيالورونيك للنضارة',
  Treat: 'علاج',
  'Fades dark spots and boosts radiance.': 'يخفف البقع الداكنة ويزيد الإشراقة.',
  'The powerhouse step for a bright and plump glow.': 'الخطوة الأقوى لبشرة مشرقة وممتلئة.',
  'Apply 2–3 drops after cleansing.': 'حطي ٢–٣ قطرات بعد التنظيف.',
  'Lightweight Sorbet Moisturizer': 'مرطب سوربيه خفيف',
  Moisturize: 'ترطيب',
  'Hydrates without clogging pores.': 'يرطب بدون ما يسد المسام.',
  'A weightless barrier to lock in your skin’s hydration.': 'طبقة خفيفة تحبس الترطيب في بشرتك.',
  'Smooth over face and neck.': 'وزعيه على الوجه والرقبة.',
  'Invisible Sunscreen Veil': 'واقي شمس شفاف',
  Protect: 'حماية',
  'Prevents new dark spots.': 'يمنع ظهور بقع داكنة جديدة.',
  'Your daily shield against UV damage and aging.': 'درعك اليومي ضد أضرار الشمس والتقدم بالعمر.',
  'Apply generously as the last step.': 'حطيه بكمية كافية كآخر خطوة.',
  'This set provides everything your skin needs for a complete glow-up while staying within your preferred step count. Would you like me to add this entire routine to your cart?':
    'هالمجموعة فيها كل اللي تحتاجه بشرتك لنضارة كاملة وبعدد الخطوات اللي تفضلينه. تبين أضيف الروتين كامل للسلة؟',
  'Here’s a set picked for a dewy glow:': 'هذي مجموعة مختارة لنضارة ندية:',
  'Suggested Products': 'منتجات مقترحة',
  'White Truffle Spray Serum': 'سيروم بخاخ الكمأ الأبيض',
  '100 ml': '١٠٠ مل',
  '150 ml': '١٥٠ مل',
  '50 ml': '٥٠ مل',
  'The ‘hero’ product for an instant, dewy glow.': 'المنتج الأساسي لنضارة ندية فورية.',
  'Glazing Milk': 'حليب الترطيب اللامع',
  'Calms and preps skin for the next step.': 'يهدي البشرة ويجهزها للخطوة الجاية.',
  'Aqua Heartleaf Toner': 'تونر أكوا هارتليف',
  'Balances oil without drying.': 'يوازن الدهون بدون ما ينشف البشرة.',
  Total: 'المجموع',
  'Add Collection to Cart': 'أضف المجموعة إلى السلة',
  'This serum helps reduce pores, control excess oil, brighten skin tone, and fade dark spots — making it a great daily-use option for oily and acne-prone skin.':
    'هالسيروم يصغّر المسام ويتحكم بالدهون الزايدة ويفتح لون البشرة ويخفف البقع الداكنة — خيار ممتاز للاستخدام اليومي للبشرة الدهنية والمعرضة لحب الشباب.',
  'Minimalist 10% Niacinamide': 'مينيماليست نياسيناميد ١٠٪',
  'Key Ingredients:': 'المكونات الأساسية:',
  '10% Niacinamide + 1% Zinc PCA': 'نياسيناميد ١٠٪ + زنك PCA ١٪',
  'How to use:': 'طريقة الاستخدام:',
  'Apply 2–3 drops on a cleansed face, morning and night. Follow with a moisturizer.': 'حطي ٢–٣ قطرات على وجه نظيف، الصبح وبالليل، وبعدها المرطب.',
  'Available sizes:': 'الأحجام المتوفرة:',
  '30ml - 25.000 KWD': '٣٠ مل - ٢٥٫٠٠٠ د.ك',
  '60ml - 36.000 KWD (Low stock)': '٦٠ مل - ٣٦٫٠٠٠ د.ك (الكمية قليلة)',
  'We recommend consulting with a dermatologist before adding this to your routine, especially if you have a known skin condition or are pregnant.':
    'ننصح باستشارة طبيب جلدية قبل إضافته لروتينك، خصوصاً إذا عندك مشكلة جلدية أو حامل.',
  '📊 Full Comparison': '📊 مقارنة كاملة',
  'Callidus Care 2% Salicylic Acid': 'كاليدوس كير حمض الساليسيليك ٢٪',
  'd’Alba White Truffle First Serum': 'دالبا سيروم الكمأ الأبيض',
  'Primary Benefit': 'الفائدة الأساسية',
  'Acne Proof & Glow': 'ضد الحبوب ونضارة',
  'Instant glow & hydration': 'نضارة وترطيب فوري',
  'Key Ingredients': 'المكونات الأساسية',
  'Hyaluronic Acid, Grape extract': 'حمض الهيالورونيك، خلاصة العنب',
  'White Truffle, Niacinamide': 'الكمأ الأبيض، نياسيناميد',
  Price: 'السعر',
  'BHA%': 'نسبة BHA',
  Value: 'القيمة',
  'Best for': 'الأنسب لـ',
  'Oily, acne-prone': 'الدهنية والمعرضة للحبوب',
  'Dry, dull': 'الجافة والباهتة',
  'For oily, acne-prone skin, Callidus Care is the better match.': 'للبشرة الدهنية والمعرضة للحبوب، كاليدوس كير هو الأنسب.',
  'Here’s the latest on your order:': 'هذي آخر تحديثات طلبك:',
  Cancelled: 'ملغي',
  'Refund in Progress': 'جاري الاسترجاع',
  Placed: 'تم الطلب',
  Shipped: 'تم الشحن',
  'Out for Delivery': 'في الطريق إليك',
  Delivered: 'تم التوصيل',
  'Order Cancelled': 'تم إلغاء الطلب',
  'Refund Initiated': 'بدأ الاسترجاع',
  'Your refund request for 20.000 KWD has been received and approved.': 'وصلنا طلب استرجاع ٢٠٫٠٠٠ د.ك وتمت الموافقة عليه.',
  'Refund Processing': 'جاري معالجة الاسترجاع',
  'Refund Completed': 'تم الاسترجاع',
  'Niacinamide 10% Serum 30ml': 'سيروم نياسيناميد ١٠٪ - ٣٠ مل',
  Gissah: 'قصة',
  Qty: 'الكمية',
  Size: 'الحجم',
  'Go to Order': 'روح للطلب',
  'Here’s what you saved:': 'هذي المنتجات اللي حفظتيها:',
  'Your Wishlist': 'المفضلة',
  'Price drop': 'نزل السعر',
  'Low stock': 'الكمية قليلة',
  'Today’s skincare deals:': 'عروض العناية بالبشرة اليوم:',
  'Offers for you': 'عروض لك',
  '20% off skincare': 'خصم ٢٠٪ على العناية بالبشرة',
  'On orders above 15 KWD. Ends Sunday.': 'للطلبات فوق ١٥ د.ك. ينتهي يوم الأحد.',
  'Copy code': 'انسخ الكود',
  '10 KWD off routines': 'خصم ١٠ د.ك على الروتينات',
  'When you add a full routine to your cart.': 'لما تضيفين روتين كامل للسلة.',
  'Free delivery': 'توصيل مجاني',
  'On every order this week.': 'على كل الطلبات هالأسبوع.',
  'No products found': 'ما لقينا منتجات',
  'We couldn’t find moisturizers under 5 KWD. Try a wider price range.': 'ما لقينا مرطبات أقل من ٥ د.ك. جربي نطاق سعر أوسع.',
  'Try again': 'حاول مرة ثانية',
  'Recommended Product': 'المنتج المقترح',
  'See more': 'عرض المزيد',
  'See less': 'عرض أقل',
  '30% OFF': 'خصم ٣٠٪',
  '22% OFF': 'خصم ٢٢٪',
}

/** The example in Arabic: every string that has a line above, swapped; ids, prices and paths untouched. */
const localize = (v: unknown): unknown =>
  typeof v === 'string' ? (AR[v] ?? v) : Array.isArray(v) ? v.map(localize) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, localize(x)])) : v

for (const t of COMMERCE_TEMPLATES) t.sampleAr = localize(t.sample) as Row
// Labels a renderer reads from `config` follow the language too.
const routine = COMMERCE_TEMPLATES.find((t) => t.name === 'product_routine')!
routine.sampleAr = { ...routine.sampleAr, config: { slot: { recommended_product: { label: AR['Recommended Product'] } } } }
const comparison = COMMERCE_TEMPLATES.find((t) => t.name === 'product_comparison')!
comparison.sampleAr = { ...comparison.sampleAr, config: { comparison: { see_more_label: AR['See more'], see_less_label: AR['See less'] } } }
