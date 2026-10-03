import { readFile, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HERO_ART_H,
  HERO_ART_W,
  buildHeroSvg,
  dotColor,
  normalizeHeroCarousel,
  type HeroCarousel,
  type HeroDesign,
} from './heroDesign.js'

/**
 * The hero, as one image, for SDKs that render a single `heroImage.url`.
 *
 * The studio's hero is a slide list, and the SDK now understands that list (see
 * the widget's own carousel). But a config may still be read by a build that
 * only knows the single field, so the whole list is also baked into ONE
 * animated SVG here: the slides crossfade on a loop, designs keep their own
 * motion, and uploaded images are embedded so the file needs no network access
 * of its own — it is loaded via <img>, where an SVG may not fetch anything.
 *
 * The designs themselves are not drawn here. `lib/heroDesign.ts` builds them,
 * and the dashboard's preview calls the very same builder, so what a designer
 * approves and what a visitor is served cannot drift apart.
 */

export type HeroSvgSlide = { kind: 'design'; design: HeroDesign } | { kind: 'image'; dataUri: string }

/** The face the baked hero draws in, when the config names none. */
const OVERLAY_FONT = "Montserrat, 'IBM Plex Sans Arabic', Jost, system-ui, sans-serif"

/** How long the crossfade between two slides takes. */
const FADE_MS = 700

/* The pattern tiles ship with the dashboard. They are embedded as data URIs,
 * and as PNG rather than WebP: this file can be rasterised by anything
 * downstream, and not every renderer has a WebP decoder. */
// A checkout has them under web/public; the image only carries the built
// dashboard, where the same files sit under web/dist. Reading just the first
// is what left every pattern (and the drift that needs one) undrawn once deployed.
const patternsDirs = ['../../../web/public/hero-patterns', '../../../web/dist/hero-patterns'].map((rel) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel),
)
const patternHref = (() => {
  const cache = new Map<string, string | null>()
  return (file: string): string | null => {
    if (!cache.has(file)) {
      let href: string | null = null
      for (const dir of patternsDirs) {
        try {
          href = `data:image/png;base64,${readFileSync(path.join(dir, `${file}-1x.png`)).toString('base64')}`
          break
        } catch {
          // not in this one
        }
      }
      cache.set(file, href)
    }
    return cache.get(file) ?? null
  }
})()

/**
 * The crossfade, as one set of keyframes every slide shares.
 *
 * Each slide runs the same animation over the full cycle and is offset by a
 * negative delay, so n slides need one `@keyframes` rather than n.
 */
function crossfadeCss(uid: string, n: number, holdMs: number): string {
  const cycle = n * holdMs
  const pc = (ms: number) => Math.min(100, Math.max(0, (ms / cycle) * 100)).toFixed(3)
  const fade = Math.min(FADE_MS, holdMs / 2)
  return [
    `@keyframes ${uid}cf{`,
    `0%,${pc(holdMs - fade)}%{opacity:1}`,
    `${pc(holdMs)}%,${pc(cycle - fade)}%{opacity:0}`,
    `100%{opacity:1}}`,
    // Slides and their dot rows share the keyframes, so a row can never show a
    // different slide's dot as active.
    `#${uid} .sl{animation:${uid}cf ${cycle}ms linear infinite}`,
    // A visitor who asked for less motion gets the first slide, held still.
    `@media (prefers-reduced-motion:reduce){#${uid} .sl{animation:none;opacity:0}#${uid} .sl:first-of-type{opacity:1}}`,
  ].join('')
}

/**
 * The carousel dots, drawn into the image itself.
 *
 * The dashboard draws real dots next to the hero; an SDK that only renders one
 * image has nowhere to put them, so they are baked in — same shape, size, gap
 * and colours the config carries. One row per active slide, crossfading on the
 * same keyframes as the slides, so the row always matches the slide on screen.
 * `position: 'below'` has no room of its own inside an image, so it is drawn
 * where `overlay` is: just inside the bottom edge.
 */
function dotsMarkup(uid: string, n: number, carousel: HeroCarousel, brand: string): string {
  const d = carousel.dots
  if (!d.show || n < 2) return ''
  const activeColor = dotColor(d.activeColor, brand, '#E30613')
  const inactiveColor = dotColor(d.inactiveColor, brand, '#A1A1A6')
  const height = d.shape === 'bar' ? Math.max(2, d.size * 0.6) : d.size
  const radius = d.shape === 'bar' ? 2 : 999
  const widthOf = (on: boolean) => (d.shape === 'dot' ? d.size : on ? d.activeWidth : d.size)
  const y = HERO_ART_H - 8 - height

  const rows = Array.from({ length: n }, (_, active) => {
    const widths = Array.from({ length: n }, (_, i) => widthOf(i === active))
    const total = widths.reduce((a, b) => a + b, 0) + d.gap * (n - 1)
    let x = (HERO_ART_W - total) / 2
    const rects = widths.map((w, i) => {
      const on = i === active
      const rect = `<rect x="${x.toFixed(2)}" y="${y}" width="${w}" height="${height}" rx="${Math.min(radius, height / 2)}" fill="${
        on ? activeColor : inactiveColor
      }"${on ? '' : ` opacity="${d.inactiveOpacity}"`}/>`
      x += w + d.gap
      return rect
    })
    return `<g class="sl" style="animation-delay:${-active * carousel.intervalMs}ms;opacity:${active === 0 ? 1 : 0}">${rects.join('')}</g>`
  })
  return `<g id="${uid}d">${rows.join('')}</g>`
}

/**
 * The widget's own welcome copy, drawn over a slide.
 *
 * The dashboard lays this text over the hero; an SDK that renders the hero as a
 * plain image puts its own copy underneath instead, which reads as a different
 * design. Baking it in — same scrim, same sizes — is what makes the two agree,
 * and the served config then blanks the SDK's own copy so it is never doubled.
 */
function overlayMarkup(uid: string, title: string, subtitle: string, rtl: boolean, textRtl = rtl): string {
  if (!title && !subtitle) return ''
  const pad = 12
  // The copy needs more room off the bottom than off the side: the carousel
  // dots sit directly beneath the hero.
  const padBottom = 20
  // Two different things decide the layout here, and conflating them is what
  // put the full stop on the wrong end of an Arabic line:
  //   `rtl`     — which side of the slide the copy block sits on, from the art.
  //   `textRtl` — which way the words themselves run, from the language.
  // A design that keeps its Latin arrangement still needs Arabic to be typeset
  // as Arabic. Under `direction: rtl` SVG's `start` anchor is the RIGHT edge,
  // so a left-hand block needs `end` and a right-hand block needs `start`.
  const x = rtl ? HERO_ART_W - pad : pad
  const anchor = textRtl ? (rtl ? 'start' : 'end') : rtl ? 'end' : 'start'
  const dir = textRtl ? ' direction="rtl"' : ''
  const font = OVERLAY_FONT
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // There are no text metrics here, so lines break on an average glyph width.
  const wrap = (text: string, size: number, maxLines: number): string[] => {
    const maxChars = Math.max(8, Math.floor((HERO_ART_W - pad * 2) / (size * 0.52)))
    const out: string[] = []
    let cur = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const cand = cur ? cur + ' ' + word : word
      if (cand.length > maxChars && cur) { out.push(cur); cur = word } else cur = cand
    }
    if (cur) out.push(cur)
    if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] += '\u2026' }
    return out
  }

  const titleLines = title ? wrap(title, 15, 2) : []
  const subLines = subtitle ? wrap(subtitle, 10.5, 2) : []
  const titleLH = 18
  const subLH = 13
  const blockH = titleLines.length * titleLH + (subLines.length ? subLines.length * subLH + 3 : 0)
  let y = HERO_ART_H - padBottom - blockH

  const lines: string[] = []
  for (const line of titleLines) {
    y += titleLH
    lines.push(`<text x="${x}" y="${y - 4}" text-anchor="${anchor}"${dir} font-family="${font}" font-size="15" font-weight="800" fill="#FFFFFF">${esc(line)}</text>`)
  }
  if (subLines.length) y += 3
  for (const line of subLines) {
    y += subLH
    lines.push(`<text x="${x}" y="${y - 3}" text-anchor="${anchor}"${dir} font-family="${font}" font-size="10.5" fill="#FFFFFF" opacity="0.9">${esc(line)}</text>`)
  }

  // The scrim exists to carry the white copy at the bottom, so it stops short of
  // the top: spanning the whole slide dimmed the badge with it, which on a light
  // design left the wordmark barely legible.
  const scrimTop = Math.max(0, Math.min(HERO_ART_H - 1, HERO_ART_H - blockH - padBottom - pad * 2))
  return `<defs><linearGradient id="${uid}sc" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0%" stop-color="#000000" stop-opacity="0.62"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/>
  </linearGradient></defs>
  <rect x="0" y="${scrimTop}" width="${HERO_ART_W}" height="${HERO_ART_H - scrimTop}" fill="url(#${uid}sc)"/>
  ${lines.join('\n  ')}`
}

export function renderHeroSvg(opts: {
  slides: HeroSvgSlide[]
  brand?: string
  rtl?: boolean
  carousel?: unknown
  /** The channel's name, for a design whose badge carries no text of its own. */
  badgeFallback?: string
  /** The channel's font stack, so the hero is drawn in the widget's own face. */
  fontFamily?: string
  /** The widget's welcome copy, laid over any slide that carries none of its own. */
  overlay?: { title?: string; subtitle?: string }
}): string {
  const carousel: HeroCarousel = normalizeHeroCarousel(opts.carousel)
  const rtl = opts.rtl === true
  const slides = opts.slides.slice(0, 8)
  const n = slides.length
  const uid = 'h'
  // Without autoplay there is nothing to cycle, so only the cover is drawn.
  const cycling = n > 1 && carousel.autoplay
  const shown = cycling ? slides : slides.slice(0, 1)

  const ovTitle = opts.overlay?.title?.trim() ?? ''
  const ovSub = opts.overlay?.subtitle?.trim() ?? ''

  const layers = shown.map((slide, i) => {
    // A design that opts out of mirroring keeps its Latin arrangement, and the
    // overlay has to follow it — otherwise the copy lands on top of the art.
    const slideRtl = rtl && !(slide.kind === 'design' && slide.design.mirrorInRtl === false)
    const art =
      slide.kind === 'image'
        ? `<image href="${slide.dataUri}" x="0" y="0" width="${HERO_ART_W}" height="${HERO_ART_H}" preserveAspectRatio="xMidYMid slice"/>`
        : // A nested <svg> keeps each design's own ids, styles and viewBox intact.
          buildHeroSvg(slide.design, {
            uid: `${uid}s${i}`,
            patternHref,
            rtl,
            brand: opts.brand,
            badgeFallback: opts.badgeFallback,
            fontFamily: opts.fontFamily || OVERLAY_FONT,
          })
    // A design carrying copy of its own keeps it, exactly as the dashboard does.
    const carriesText = slide.kind === 'design' && (slide.design.title.show || slide.design.subtitle.show)
    const inner = carriesText ? art : art + overlayMarkup(`${uid}o${i}`, ovTitle, ovSub, slideRtl, rtl)
    const style = cycling ? ` class="sl" style="animation-delay:${-i * carousel.intervalMs}ms;opacity:${i === 0 ? 1 : 0}"` : ''
    return `<g${style}>${inner}</g>`
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" id="${uid}" width="${HERO_ART_W * 2}" height="${HERO_ART_H * 2}" viewBox="0 0 ${HERO_ART_W} ${HERO_ART_H}">${
    cycling ? `<style>${crossfadeCss(uid, n, carousel.intervalMs)}</style>` : ''
  }
<rect width="${HERO_ART_W}" height="${HERO_ART_H}" fill="#000000"/>
${layers.join('\n')}
${cycling ? dotsMarkup(uid, n, carousel, opts.brand ?? '#E30613') : ''}
</svg>`
}

/* ------------------------- embedding uploaded images ------------------------ */

const IMAGE_MIMES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
}
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const imageCache = new Map<string, string | null>()

const readLocal = (file: string): Promise<Buffer | null> =>
  new Promise((resolve) => readFile(file, (err, data) => resolve(err ? null : data)))

/**
 * Turns a hero image reference into a data URI so it can live inside the SVG.
 * Studio uploads are read from disk; anything remote (a config imported from
 * Pair) is fetched once with a size cap and cached.
 */
export async function heroImageDataUri(url: string, uploadsDir: string): Promise<string | null> {
  if (imageCache.has(url)) return imageCache.get(url) ?? null
  let out: string | null = null
  try {
    if (url.startsWith('/api/public/uploads/')) {
      const name = path.basename(url)
      const ext = name.split('.').pop()?.toLowerCase() ?? ''
      const mime = IMAGE_MIMES[ext]
      const buf = mime ? await readLocal(path.join(uploadsDir, name)) : null
      if (buf && buf.length <= MAX_IMAGE_BYTES) out = `data:${mime};base64,${buf.toString('base64')}`
    } else if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim()
      if (res.ok && mime.startsWith('image/')) {
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length <= MAX_IMAGE_BYTES) out = `data:${mime};base64,${buf.toString('base64')}`
      }
    }
  } catch {
    out = null
  }
  if (imageCache.size > 40) imageCache.delete(imageCache.keys().next().value as string)
  imageCache.set(url, out)
  return out
}
