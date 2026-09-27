/**
 * Hero designs: one parameterised composition, rendered to SVG.
 *
 * A hero slide is either an uploaded image or a *design* — a composition whose
 * every value (background, pattern, decoration, badge, copy, motion) lives in
 * the widget config, so each channel is styled from the builder instead of
 * picking one of a few fixed looks. `HERO_PRESETS` only seeds those values;
 * nothing here is baked into a channel.
 *
 * The same design has to be drawn in two places: the dashboard's live preview
 * and, for the real SDK, a server-rendered image. So this module produces an
 * SVG *string* rather than React nodes, and both sides call it — the preview
 * inlines the string, the server serves it. That keeps one geometry, one set of
 * animations, and no chance of the two drifting apart.
 *
 * Two consequences of the server case shape the code:
 *  - The SDK loads it via <img>, where an SVG cannot fetch anything, so pattern
 *    tiles arrive through `patternHref` (a URL in the browser, a data URI on the
 *    server) and `foreignObject` is unavailable — text is <text> plus the
 *    word-wrap below, which is why wrapping is done here and not by the browser.
 *  - Ids and keyframe names are prefixed with `uid`, because inlined SVG shares
 *    the document's id and animation namespace with every other slide.
 *
 * Geometry is authored on the references' 358x220 artboard and scaled by the
 * viewBox, so it stays faithful at any size with no measuring at runtime.
 *
 * MIRRORED FILE — server/src/lib/heroDesign.ts is a byte-identical copy (the
 * server workspace cannot import from web/). `npm test -w server` asserts that.
 */

export const HERO_ART_W = 358
export const HERO_ART_H = 220

/** The references' typeface; the fallbacks matter for the server-rendered case. */
export const HERO_FONT = "Jost, Futura, 'Century Gothic', 'Segoe UI', Tahoma, sans-serif"

/* --------------------------------- pattern -------------------------------- */

export const HERO_PATTERNS = ['none', 'sadu', 'lattice'] as const
export type HeroPatternAsset = (typeof HERO_PATTERNS)[number]

/**
 * Pattern tiles are greyscale *masks*: the artwork is the luminance, so the
 * colour is a config value rather than part of the file. `w`/`h` are the tile's
 * size in artboard units at scale 1.
 */
export const HERO_PATTERN_TILES: Record<Exclude<HeroPatternAsset, 'none'>, { w: number; h: number; file: string }> = {
  sadu: { w: 517, h: 244, file: 'sadu-mask' },
  lattice: { w: 131, h: 91, file: 'lattice-mask' },
}

/* -------------------------------- decoration ------------------------------- */

export const HERO_DECORS = ['none', 'wedge', 'chevron', 'chevron-pair', 'triple-chevron'] as const
export type HeroDecorShape = (typeof HERO_DECORS)[number]

/**
 * The references' chevron, normalised to a unit box. Every decoration is built
 * from this one outline, which is also exactly the `clip-path` the HTML mockups
 * use (100% 0, 0 50%, 100% 100%, 100% 84.13%, 30.1% 50%, 100% 15.87%).
 */
const CHEVRON_UNIT = 'M1 0L0 .5L1 1V.8413L.3009 .5L1 .1587Z'
/** A single chevron of the triple stack spans this much of the box, stepped by STEP. */
const TRIPLE_SPAN = 0.5745
const TRIPLE_STEP = 0.2123
/** The nested chevron of a pair, as a fraction of the outer box (measured from the reference). */
const PAIR_SCALE = 0.59
const PAIR_INSET_X = 0.265

export const HERO_LAYOUTS = ['text-left', 'text-center', 'text-bottom'] as const
export type HeroLayout = (typeof HERO_LAYOUTS)[number]

export const HERO_ENTRANCES = ['rise', 'fade', 'none'] as const
export type HeroEntrance = (typeof HERO_ENTRANCES)[number]

export const HERO_DECOR_MOTIONS = ['slide', 'fade', 'none'] as const
export type HeroDecorMotion = (typeof HERO_DECOR_MOTIONS)[number]

export const HERO_DRIFTS = ['none', 'left', 'right'] as const
export type HeroDrift = (typeof HERO_DRIFTS)[number]

/* --------------------------------- the type -------------------------------- */

export interface HeroBackground {
  type: 'color' | 'gradient'
  color: string
  from: string
  to: string
  /** Gradient angle in degrees, 0 = left→right, 135 = the references' diagonal. */
  angle: number
}

export interface HeroPatternCfg {
  asset: HeroPatternAsset
  color: string
  opacity: number
  /** Tile scale; 1 = the tile's natural size in artboard units. */
  scale: number
  /** Where the pattern is drawn: across the background, or clipped to the decoration. */
  target: 'background' | 'decor'
  /** Fade the pattern out towards the leading edge, as in the Sadu Night reference. */
  fade: boolean
}

export interface HeroDecorCfg {
  shape: HeroDecorShape
  /** Box in artboard units. Values outside 0…358 / 0…220 bleed off the edge, as in the references. */
  x: number
  y: number
  w: number
  h: number
  color: string
  /** The middle chevron of `triple-chevron`. */
  color2: string
  /** Fill behind a `wedge`'s pattern. */
  fill: string
  /** How far the wedge's point protrudes, as a fraction of its width. */
  point: number
  opacity: number
}

export interface HeroBadgeCfg {
  show: boolean
  text: string
  showLogo: boolean
  color: string
  size: number
}

export interface HeroTextCfg {
  show: boolean
  text: string
  color: string
  size: number
}

export interface HeroMotionCfg {
  entrance: HeroEntrance
  entranceMs: number
  decor: HeroDecorMotion
  decorMs: number
  drift: HeroDrift
  driftMs: number
}

export interface HeroDesign {
  layout: HeroLayout
  background: HeroBackground
  pattern: HeroPatternCfg
  decor: HeroDecorCfg
  badge: HeroBadgeCfg
  title: HeroTextCfg
  subtitle: HeroTextCfg
  motion: HeroMotionCfg
}

/* -------------------------------- normalising ------------------------------ */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Colours reach the SVG as attribute values, so only literal hex is accepted. */
export const color = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

const text = (v: unknown, fallback: string, max = 160): string =>
  typeof v === 'string' ? v.slice(0, max) : fallback

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

/** The neutral design every preset and every stored slide is layered onto. */
export const HERO_DESIGN_DEFAULTS: HeroDesign = {
  layout: 'text-left',
  background: { type: 'color', color: '#000000', from: '#341C4C', to: '#132A3E', angle: 135 },
  pattern: { asset: 'none', color: '#E30613', opacity: 0.9, scale: 1, target: 'background', fade: false },
  decor: { shape: 'none', x: 192, y: 24, w: 200, h: 173, color: '#FFFFFF', color2: '#FFFFFF', fill: '#FFFFFF', point: 0.32, opacity: 1 },
  badge: { show: true, text: '', showLogo: true, color: '#FFFFFF', size: 11 },
  title: { show: false, text: '', color: '#FFFFFF', size: 24 },
  subtitle: { show: false, text: '', color: '#D1D1D6', size: 13 },
  motion: { entrance: 'rise', entranceMs: 600, decor: 'slide', decorMs: 700, drift: 'none', driftMs: 40000 },
}

/**
 * Reads a stored design, filling anything missing from the defaults. Configs are
 * hand-editable JSON and older slides predate most of these fields, so every
 * value is validated rather than trusted.
 */
export function normalizeHeroDesign(raw: unknown): HeroDesign {
  const r = (raw ?? {}) as Record<string, any>
  const d = HERO_DESIGN_DEFAULTS
  const bg = (r.background ?? {}) as Record<string, any>
  const pt = (r.pattern ?? {}) as Record<string, any>
  const dc = (r.decor ?? {}) as Record<string, any>
  const bd = (r.badge ?? {}) as Record<string, any>
  const ti = (r.title ?? {}) as Record<string, any>
  const su = (r.subtitle ?? {}) as Record<string, any>
  const mo = (r.motion ?? {}) as Record<string, any>
  return {
    layout: pick(r.layout, HERO_LAYOUTS, d.layout),
    background: {
      type: pick(bg.type, ['color', 'gradient'] as const, d.background.type),
      color: color(bg.color, d.background.color),
      from: color(bg.from, d.background.from),
      to: color(bg.to, d.background.to),
      angle: num(bg.angle, d.background.angle, 0, 360),
    },
    pattern: {
      asset: pick(pt.asset, HERO_PATTERNS, d.pattern.asset),
      color: color(pt.color, d.pattern.color),
      opacity: num(pt.opacity, d.pattern.opacity, 0, 1),
      scale: num(pt.scale, d.pattern.scale, 0.25, 4),
      target: pick(pt.target, ['background', 'decor'] as const, d.pattern.target),
      fade: bool(pt.fade, d.pattern.fade),
    },
    decor: {
      shape: pick(dc.shape, HERO_DECORS, d.decor.shape),
      x: num(dc.x, d.decor.x, -400, 800),
      y: num(dc.y, d.decor.y, -400, 600),
      w: num(dc.w, d.decor.w, 8, 900),
      h: num(dc.h, d.decor.h, 8, 700),
      color: color(dc.color, d.decor.color),
      color2: color(dc.color2, d.decor.color2),
      fill: color(dc.fill, d.decor.fill),
      point: num(dc.point, d.decor.point, 0.02, 1),
      opacity: num(dc.opacity, d.decor.opacity, 0, 1),
    },
    badge: {
      show: bool(bd.show, d.badge.show),
      text: text(bd.text, d.badge.text, 60),
      showLogo: bool(bd.showLogo, d.badge.showLogo),
      color: color(bd.color, d.badge.color),
      size: num(bd.size, d.badge.size, 6, 28),
    },
    title: {
      show: bool(ti.show, d.title.show),
      text: text(ti.text, d.title.text),
      color: color(ti.color, d.title.color),
      size: num(ti.size, d.title.size, 8, 48),
    },
    subtitle: {
      show: bool(su.show, d.subtitle.show),
      text: text(su.text, d.subtitle.text),
      color: color(su.color, d.subtitle.color),
      size: num(su.size, d.subtitle.size, 6, 32),
    },
    motion: {
      entrance: pick(mo.entrance, HERO_ENTRANCES, d.motion.entrance),
      entranceMs: num(mo.entranceMs, d.motion.entranceMs, 0, 5000),
      decor: pick(mo.decor, HERO_DECOR_MOTIONS, d.motion.decor),
      decorMs: num(mo.decorMs, d.motion.decorMs, 0, 5000),
      drift: pick(mo.drift, HERO_DRIFTS, d.motion.drift),
      driftMs: num(mo.driftMs, d.motion.driftMs, 1000, 240000),
    },
  }
}

/* ---------------------------------- presets -------------------------------- */

/**
 * Starting points, not styles: choosing one writes these values into the slide,
 * and every one of them stays editable per channel afterwards.
 *
 * `cinescape-*` reproduce the two slides on the Cinescape channel; the other
 * three reproduce the Sadu Night / Triple Arrow / Arrow Window design
 * references. Geometry and type metrics are measured from those files.
 */
export const HERO_PRESETS: Record<string, { label: string; design: HeroDesign }> = {
  'cinescape-night': {
    label: 'Cinescape Night',
    design: normalizeHeroDesign({
      layout: 'text-left',
      background: { type: 'color', color: '#000000' },
      // Red lattice on the wedge's white ground, at the tile's natural size.
      pattern: { asset: 'lattice', color: '#E30613', opacity: 1, scale: 1, target: 'decor' },
      // Measured from the reference: point at (179, 110), top/bottom edge at x=236, bleeding off the right.
      decor: { shape: 'wedge', x: 179, y: 0, w: 179, h: 220, fill: '#FFFFFF', point: 0.318 },
      badge: { show: true, text: 'Cinescape AI', color: '#FFFFFF' },
      title: { show: true, text: 'What’s showing tonight?', color: '#FFFFFF', size: 24 },
      subtitle: { show: true, text: 'Ask me for films, times and formats.', color: '#D1D1D6', size: 13 },
      // The reference is a still; the lattice drifts here so the wedge reads as live art.
      motion: { entrance: 'rise', entranceMs: 600, decor: 'slide', decorMs: 700, drift: 'left', driftMs: 18000 },
    }),
  },
  'cinescape-chevron': {
    label: 'Cinescape Chevron',
    design: normalizeHeroDesign({
      layout: 'text-left',
      background: { type: 'gradient', from: '#341C4C', to: '#132A3E', angle: 135 },
      pattern: { asset: 'lattice', color: '#FFFFFF', opacity: 0.07, scale: 1, target: 'background' },
      // Measured from the channel's second slide: a red chevron with a white one nested inside.
      decor: { shape: 'chevron-pair', x: 215, y: 16.9, w: 200, h: 174.1, color: '#E30613', color2: '#FFFFFF' },
      badge: { show: true, text: 'Cinescape AI', color: '#FFFFFF' },
      title: { show: true, text: 'Your cinema, one message away', color: '#FFFFFF', size: 24 },
      subtitle: { show: true, text: 'Films, food, cinemas and help, all in one chat.', color: '#D1D1D6', size: 13 },
      motion: { entrance: 'rise', decor: 'slide', drift: 'none' },
    }),
  },
  'sadu-night': {
    label: 'Sadu Night',
    design: normalizeHeroDesign({
      layout: 'text-left',
      background: { type: 'color', color: '#000000' },
      pattern: { asset: 'sadu', color: '#E30613', opacity: 0.9, scale: 1, target: 'background', fade: true },
      decor: { shape: 'chevron', x: 224, y: 59, w: 118, h: 102.4, color: '#FFFFFF' },
      badge: { show: true, text: '', color: '#FFFFFF' },
      title: { show: false, text: 'Your cinema, one message away', color: '#FFFFFF' },
      subtitle: { show: false, text: 'Films, food, cinemas and help, all in one chat.', color: '#D1D1D6' },
      motion: { entrance: 'rise', decor: 'slide', drift: 'left', driftMs: 40000 },
    }),
  },
  'triple-arrow': {
    label: 'Triple Arrow',
    design: normalizeHeroDesign({
      layout: 'text-left',
      background: { type: 'gradient', from: '#341C4C', to: '#132A3E', angle: 135 },
      pattern: { asset: 'lattice', color: '#FFFFFF', opacity: 0.07, scale: 1, target: 'background' },
      decor: { shape: 'triple-chevron', x: 200, y: 58, w: 210, h: 104.9, color: '#E30613', color2: '#FFFFFF' },
      badge: { show: true, text: '', color: '#FFFFFF' },
      title: { show: false, text: 'Hungry? Ask about the menu', color: '#FFFFFF' },
      subtitle: { show: false, text: 'Combos, popcorn, hot food and drinks.', color: '#D1D1D6' },
      motion: { entrance: 'rise', decor: 'slide', drift: 'none' },
    }),
  },
  'arrow-window': {
    label: 'Arrow Window',
    design: normalizeHeroDesign({
      layout: 'text-left',
      background: { type: 'color', color: '#F6F6F8' },
      pattern: { asset: 'lattice', color: '#E30613', opacity: 1, scale: 1, target: 'decor' },
      decor: { shape: 'chevron', x: 192, y: 24, w: 200, h: 173, fill: '#FFFFFF' },
      badge: { show: true, text: '', color: '#000000' },
      title: { show: false, text: 'We’re here to help', color: '#000000' },
      subtitle: { show: false, text: 'Reach guest care or check a complaint.', color: '#5E5E63' },
      motion: { entrance: 'rise', decor: 'slide', drift: 'left', driftMs: 12000 },
    }),
  },
}

export const HERO_PRESET_IDS = Object.keys(HERO_PRESETS)

/* --------------------------------- rendering ------------------------------- */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Two decimals is plenty on a 358x220 artboard, and keeps the markup small. */
const n = (v: number) => String(Math.round(v * 100) / 100)

/**
 * Word-wraps with an average glyph advance rather than real metrics.
 *
 * `<img>`-loaded SVG has no `foreignObject` and no way to measure text, so the
 * wrap has to be computed up front. Doing it here — not in the browser — is
 * also what keeps the preview and the served image identical.
 */
export function wrapHeroText(value: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  // 0.465em is Jost's average advance: it reproduces the design references'
  // own line breaks exactly at their sizes, which is the bar to hit here.
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * 0.465)))
  const lines: string[] = []
  let cur = ''
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const cand = cur ? `${cur} ${word}` : word
    if (cand.length > maxChars && cur) {
      lines.push(cur)
      cur = word
    } else cur = cand
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s.,;:]+$/, '')}…`
  }
  return lines
}

export interface HeroRenderCtx {
  /** Unique per rendered slide: inlined SVG shares the document's id and keyframe namespace. */
  uid: string
  /** Resolves a pattern tile to something this consumer can load — a URL, or a data URI. */
  patternHref: (file: string) => string | null
  /** Mirrors the composition and lays the copy out from the right. */
  rtl?: boolean
  /** Brand colour, used where a design opts into it rather than a literal. */
  brand?: string
  /** Drops all animation — honours prefers-reduced-motion at the call site. */
  still?: boolean
}

/** `<defs>` for the pattern, plus the drifting tiled rect that carries its colour. */
function patternLayer(design: HeroDesign, ctx: HeroRenderCtx, clip: string | null): { defs: string; body: string } {
  const p = design.pattern
  if (p.asset === 'none' || p.opacity <= 0) return { defs: '', body: '' }
  const tile = HERO_PATTERN_TILES[p.asset]
  const href = ctx.patternHref(tile.file)
  if (!href) return { defs: '', body: '' }

  const tw = tile.w * p.scale
  const th = tile.h * p.scale
  const { uid } = ctx

  // The tiled area overhangs by one tile on each side, so a drift of exactly one
  // tile still covers the artboard at every point of the loop.
  const bx = n(-tw)
  const by = n(-th)
  const bw = n(HERO_ART_W + tw * 2)
  const bh = n(HERO_ART_H + th * 2)

  // A luminance mask turns the greyscale tile into "show the colour here", which
  // is what makes the colour a config value. sRGB interpolation keeps it from
  // darkening in renderers that default to linearRGB.
  const defs = `<pattern id="${uid}t" width="${n(tw)}" height="${n(th)}" patternUnits="userSpaceOnUse"><image href="${href}" width="${n(tw)}" height="${n(th)}" preserveAspectRatio="none"/></pattern>
<mask id="${uid}m" color-interpolation="sRGB" maskUnits="userSpaceOnUse" x="${bx}" y="${by}" width="${bw}" height="${bh}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#${uid}t)"/></mask>${
    p.fade
      ? `\n<linearGradient id="${uid}f" x1="0" y1="0" x2="1" y2="0"><stop offset="45%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="85%" stop-color="#FFFFFF"/></linearGradient>
<mask id="${uid}g" maskUnits="userSpaceOnUse" x="0" y="0" width="${HERO_ART_W}" height="${HERO_ART_H}"><rect width="${HERO_ART_W}" height="${HERO_ART_H}" fill="url(#${uid}f)"/></mask>`
      : ''
  }`

  // Drift is a transform on the *masked* group, so the mask travels with the
  // colour it reveals — animating the fill underneath a fixed mask would move
  // nothing, the fill being uniform.
  let body = `<g class="pd" mask="url(#${uid}m)" opacity="${n(p.opacity)}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${p.color}"/></g>`
  if (p.fade) body = `<g mask="url(#${uid}g)">${body}</g>`
  if (clip) body = `<g clip-path="url(#${clip})">${body}</g>`
  return { defs, body }
}

/**
 * The decoration's geometry, once.
 *
 * `parts` carries each piece with the colour it is filled with; `shapes` is the
 * same geometry with no presentation, so the very same outline can also clip a
 * pattern into the decoration (the Arrow Window and Cinescape compositions).
 */
function decorGeometry(design: HeroDesign): { parts: string; shapes: string } {
  const d = design.decor
  if (d.shape === 'none') return { parts: '', shapes: '' }
  const col = d.color
  const col2 = d.color2

  if (d.shape === 'wedge') {
    // Point on the leading edge, flat trailing side — the Cinescape composition.
    const px = d.x + d.w * d.point
    const pts = [
      [d.x + d.w, d.y],
      [px, d.y],
      [d.x, d.y + d.h / 2],
      [px, d.y + d.h],
      [d.x + d.w, d.y + d.h],
    ]
      .map(([x, y]) => `${n(x)},${n(y)}`)
      .join(' ')
    return { parts: `<polygon points="${pts}" fill="${d.fill}"/>`, shapes: `<polygon points="${pts}"/>` }
  }

  const chevron = (x: number, w: number, fill: string | null, y = d.y, h = d.h) =>
    `<path d="${CHEVRON_UNIT}"${fill ? ` fill="${fill}"` : ''} transform="translate(${n(x)},${n(y)}) scale(${n(w)},${n(h)})"/>`

  if (d.shape === 'chevron-pair') {
    // A second chevron nested inside the first, sharing its point's vertical centre.
    const iw = d.w * PAIR_SCALE
    const ih = d.h * PAIR_SCALE
    const ix = d.x + d.w * PAIR_INSET_X
    const iy = d.y + (d.h - ih) / 2
    return {
      parts: chevron(d.x, d.w, col) + chevron(ix, iw, col2, iy, ih),
      shapes: chevron(d.x, d.w, null) + chevron(ix, iw, null, iy, ih),
    }
  }

  if (d.shape === 'triple-chevron') {
    const span = d.w * TRIPLE_SPAN
    const step = d.w * TRIPLE_STEP
    const at = (i: number) => d.x + step * i
    return {
      parts: [0, 1, 2].map((i) => chevron(at(i), span, i === 1 ? col2 : col)).join(''),
      shapes: [0, 1, 2].map((i) => chevron(at(i), span, null)).join(''),
    }
  }

  return { parts: chevron(d.x, d.w, col), shapes: chevron(d.x, d.w, null) }
}

/** Badge, title and subtitle. Laid out from the right in RTL rather than mirrored. */
function copyBlock(design: HeroDesign, ctx: HeroRenderCtx, brand: string): string {
  const rtl = ctx.rtl === true
  const { badge, title, subtitle, layout } = design
  const centered = layout === 'text-center'
  const inset = 20
  const blockW = centered ? HERO_ART_W - inset * 2 : 180

  const anchor = centered ? 'middle' : rtl ? 'end' : 'start'
  const bodyX = centered ? HERO_ART_W / 2 : rtl ? HERO_ART_W - inset : inset
  const dir = rtl ? ' direction="rtl"' : ''

  const out: string[] = []

  if (badge.show) {
    const logo = badge.showLogo
    // The mark is drawn, not fetched, so it survives the <img> sandbox.
    const logoSize = badge.size * 2.55
    const gap = 8
    const label = badge.text.trim().toUpperCase()
    const textW = label.length * badge.size * 0.66
    const groupW = (logo ? logoSize + gap : 0) + textW
    const startX = centered ? HERO_ART_W / 2 - groupW / 2 : rtl ? HERO_ART_W - inset - groupW : inset
    if (logo) {
      out.push(
        `<g transform="translate(${n(startX)},${n(inset)}) scale(${n(logoSize / 28)})"><circle cx="14" cy="14" r="12.5" fill="#000000" stroke="${brand}" stroke-width="2"/><path d="M19 8.5L9 14l10 5.5" fill="none" stroke="#FFFFFF" stroke-width="2.4"/></g>`,
      )
    }
    if (label) {
      const tx = startX + (logo ? logoSize + gap : 0)
      out.push(
        `<text x="${n(tx)}" y="${n(inset + badge.size * 1.55)}" text-anchor="start" font-family="${HERO_FONT}" font-size="${n(badge.size)}" font-weight="700" letter-spacing="${n(badge.size * 0.15)}" fill="${badge.color}">${esc(label)}</text>`,
      )
    }
  }

  // Copy sits on the baseline of the artboard and grows upwards, as in the references.
  const titleLines = title.show && title.text.trim() ? wrapHeroText(title.text.trim(), blockW, title.size, 3) : []
  const subLines = subtitle.show && subtitle.text.trim() ? wrapHeroText(subtitle.text.trim(), blockW + 15, subtitle.size, 2) : []
  const titleLH = title.size * 1.12
  const subLH = subtitle.size * 1.45
  const gap = subLines.length && titleLines.length ? 8 : 0
  let y = HERO_ART_H - inset - subLines.length * subLH - gap - titleLines.length * titleLH

  const titleTexts = titleLines.map((line) => {
    y += titleLH
    return `<text x="${n(bodyX)}" y="${n(y - title.size * 0.26)}" text-anchor="${anchor}"${dir} font-family="${HERO_FONT}" font-size="${n(title.size)}" font-weight="600" letter-spacing="${n(-title.size * 0.01)}" fill="${title.color}">${esc(line)}</text>`
  })
  y += gap
  const subTexts = subLines.map((line) => {
    y += subLH
    return `<text x="${n(bodyX)}" y="${n(y - subtitle.size * 0.35)}" text-anchor="${anchor}"${dir} font-family="${HERO_FONT}" font-size="${n(subtitle.size)}" fill="${subtitle.color}">${esc(line)}</text>`
  })

  if (titleTexts.length) out.push(`<g class="ci">${titleTexts.join('')}</g>`)
  if (subTexts.length) out.push(`<g class="ci cd">${subTexts.join('')}</g>`)
  return out.join('\n')
}

/**
 * Animations, as CSS inside the SVG.
 *
 * CSS animations run in `<img>`-loaded SVG, where script does not, so the same
 * declarations drive the preview and the served image. Selectors and keyframe
 * names are scoped to `uid` because inlined SVG is part of the host document.
 */
function motionCss(design: HeroDesign, ctx: HeroRenderCtx): string {
  if (ctx.still) return ''
  const m = design.motion
  const { uid } = ctx
  const rules: string[] = []
  const frames: string[] = []

  if (m.entrance !== 'none' && m.entranceMs > 0) {
    const from = m.entrance === 'rise' ? 'opacity:0;transform:translateY(10px)' : 'opacity:0'
    frames.push(`@keyframes ${uid}i{from{${from}}to{opacity:1;transform:none}}`)
    rules.push(`#${uid} .ci{animation:${uid}i ${m.entranceMs}ms cubic-bezier(.2,.7,.2,1) both}`)
    // The subtitle trails the title, as in the references' .12s delay.
    rules.push(`#${uid} .cd{animation-delay:${Math.round(m.entranceMs * 0.2)}ms}`)
  }

  if (m.decor !== 'none' && m.decorMs > 0 && design.decor.shape !== 'none') {
    const from = m.decor === 'slide' ? 'opacity:0;transform:translateX(24px)' : 'opacity:0'
    frames.push(`@keyframes ${uid}d{from{${from}}to{opacity:1;transform:none}}`)
    rules.push(`#${uid} .dc{animation:${uid}d ${m.decorMs}ms cubic-bezier(.2,.8,.2,1) both}`)
  }

  if (m.drift !== 'none' && design.pattern.asset !== 'none') {
    const tile = HERO_PATTERN_TILES[design.pattern.asset]
    const dx = tile.w * design.pattern.scale * (m.drift === 'left' ? -1 : 1)
    frames.push(`@keyframes ${uid}p{from{transform:translateX(0)}to{transform:translateX(${n(dx)}px)}}`)
    rules.push(`#${uid} .pd{animation:${uid}p ${m.driftMs}ms linear infinite}`)
  }

  if (!rules.length) return ''
  // An inactive slide is paused by the host rather than re-rendered (see WidgetPreview).
  return `<style>${frames.join('')}${rules.join('')}@media (prefers-reduced-motion:reduce){#${uid} .ci,#${uid} .cd,#${uid} .dc,#${uid} .pd{animation:none}}</style>`
}

/** Renders a design to a standalone SVG string. Safe to inline: every value is escaped or validated. */
export function buildHeroSvg(design: HeroDesign, ctx: HeroRenderCtx): string {
  const { uid } = ctx
  const brand = color(ctx.brand, '#E30613')
  const rtl = ctx.rtl === true

  const bg =
    design.background.type === 'gradient'
      ? { defs: gradientDefs(uid, design.background), fill: `url(#${uid}b)` }
      : { defs: '', fill: design.background.color }

  const decor = decorGeometry(design)
  // A pattern aimed at the decoration turns it into a window: filled with
  // `decor.fill`, with the pattern clipped to the same outline on top.
  const asWindow = design.pattern.target === 'decor' && decor.shapes !== ''
  const clipId = asWindow ? `${uid}c` : null
  const clipDefs = clipId ? `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${decor.shapes}</clipPath>` : ''

  const pattern = patternLayer(design, ctx, clipId)

  // Decorations mirror as a whole in RTL; the copy lays itself out from the right instead.
  const mirror = rtl ? ` transform="translate(${HERO_ART_W} 0) scale(-1 1)"` : ''
  const opacity = n(design.decor.opacity)
  const artLayers = asWindow
    ? `<g class="dc" opacity="${opacity}"><g fill="${design.decor.fill}">${decor.shapes}</g>${pattern.body}</g>`
    : `${pattern.body}<g class="dc" opacity="${opacity}">${decor.parts}</g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" id="${uid}" viewBox="0 0 ${HERO_ART_W} ${HERO_ART_H}" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">${motionCss(design, ctx)}
<defs>${bg.defs}${clipDefs}${pattern.defs}</defs>
<rect width="${HERO_ART_W}" height="${HERO_ART_H}" fill="${bg.fill}"/>
<g${mirror}>${artLayers}</g>
${copyBlock(design, ctx, brand)}
</svg>`
}

/** A CSS-style angle (0 = left→right, clockwise) as SVG gradient endpoints. */
function gradientDefs(uid: string, bg: HeroBackground): string {
  const rad = ((bg.angle - 90) * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const x1 = 0.5 - dx / 2
  const y1 = 0.5 - dy / 2
  return `<linearGradient id="${uid}b" x1="${n(x1)}" y1="${n(y1)}" x2="${n(0.5 + dx / 2)}" y2="${n(0.5 + dy / 2)}"><stop offset="0%" stop-color="${bg.from}"/><stop offset="100%" stop-color="${bg.to}"/></linearGradient>`
}

/* ------------------------------ slides & carousel --------------------------- */

/**
 * A hero slide as stored in `heroSection.heroImages`.
 *
 * Three shapes have to be read: a design, an uploaded image, and — from configs
 * written before designs were editable — a bare style id or a plain URL string.
 */
export type HeroSlide = { type: 'image'; url: string } | { type: 'design'; design: HeroDesign }

export interface HeroDots {
  show: boolean
  shape: 'pill' | 'dot' | 'bar'
  /** Inactive dot size, in px. */
  size: number
  /** Active dot width, in px; `pill` stretches to it. */
  activeWidth: number
  gap: number
  activeColor: string
  inactiveColor: string
  inactiveOpacity: number
  position: 'below' | 'overlay'
}

export interface HeroCarousel {
  autoplay: boolean
  intervalMs: number
  transition: 'fade' | 'slide'
  dots: HeroDots
}

/** `#brand` resolves to the channel's colour wherever a dot colour is read. */
export const HERO_BRAND_TOKEN = '#brand'

export const HERO_CAROUSEL_DEFAULTS: HeroCarousel = {
  autoplay: true,
  intervalMs: 3500,
  transition: 'fade',
  dots: {
    show: true,
    shape: 'pill',
    size: 5,
    activeWidth: 16,
    gap: 6,
    activeColor: HERO_BRAND_TOKEN,
    inactiveColor: '#A1A1A6',
    inactiveOpacity: 0.35,
    position: 'below',
  },
}

/** A dot colour may be a hex value or the brand token. */
export const dotColor = (v: unknown, brand: string, fallback: string): string =>
  v === HERO_BRAND_TOKEN ? brand : color(v, fallback)

export function normalizeHeroCarousel(raw: unknown): HeroCarousel {
  const r = (raw ?? {}) as Record<string, any>
  const d = HERO_CAROUSEL_DEFAULTS
  const dots = (r.dots ?? {}) as Record<string, any>
  const dotCol = (v: unknown, fb: string) => (v === HERO_BRAND_TOKEN ? HERO_BRAND_TOKEN : color(v, fb))
  return {
    autoplay: bool(r.autoplay, d.autoplay),
    intervalMs: num(r.intervalMs, d.intervalMs, 800, 30000),
    transition: pick(r.transition, ['fade', 'slide'] as const, d.transition),
    dots: {
      show: bool(dots.show, d.dots.show),
      shape: pick(dots.shape, ['pill', 'dot', 'bar'] as const, d.dots.shape),
      size: num(dots.size, d.dots.size, 2, 20),
      activeWidth: num(dots.activeWidth, d.dots.activeWidth, 2, 60),
      gap: num(dots.gap, d.dots.gap, 0, 24),
      activeColor: dotCol(dots.activeColor, d.dots.activeColor),
      inactiveColor: dotCol(dots.inactiveColor, d.dots.inactiveColor),
      inactiveOpacity: num(dots.inactiveOpacity, d.dots.inactiveOpacity, 0, 1),
      position: pick(dots.position, ['below', 'overlay'] as const, d.dots.position),
    },
  }
}

/** Reads one stored slide, migrating the legacy shapes. Returns null for an empty entry. */
export function normalizeHeroSlide(raw: unknown): HeroSlide | null {
  if (typeof raw === 'string') return raw.trim() ? { type: 'image', url: raw } : null
  const r = (raw ?? {}) as Record<string, any>
  if (r.type === 'design' || r.design) return { type: 'design', design: normalizeHeroDesign(r.design) }
  // Pre-design configs stored a style id; the matching preset is that design.
  if (typeof r.style === 'string' && HERO_PRESETS[r.style]) {
    return { type: 'design', design: HERO_PRESETS[r.style].design }
  }
  return typeof r.url === 'string' && r.url.trim() ? { type: 'image', url: r.url } : null
}

/** Reads a whole hero slide list, dropping empties. */
export function normalizeHeroSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw)) return []
  const out: HeroSlide[] = []
  for (const entry of raw) {
    const slide = normalizeHeroSlide(entry)
    if (slide) out.push(slide)
  }
  return out
}
