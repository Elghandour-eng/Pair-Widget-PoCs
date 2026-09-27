import { readFile, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HERO_ART_H,
  HERO_ART_W,
  buildHeroSvg,
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

/** How long the crossfade between two slides takes. */
const FADE_MS = 700

/* The pattern tiles ship with the dashboard. They are embedded as data URIs,
 * and as PNG rather than WebP: this file can be rasterised by anything
 * downstream, and not every renderer has a WebP decoder. */
const patternsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../web/public/hero-patterns')
const patternHref = (() => {
  const cache = new Map<string, string | null>()
  return (file: string): string | null => {
    if (!cache.has(file)) {
      try {
        cache.set(file, `data:image/png;base64,${readFileSync(path.join(patternsDir, `${file}-1x.png`)).toString('base64')}`)
      } catch {
        cache.set(file, null)
      }
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
    `#${uid} > .sl{animation:${uid}cf ${cycle}ms linear infinite}`,
    // A visitor who asked for less motion gets the first slide, held still.
    `@media (prefers-reduced-motion:reduce){#${uid} > .sl{animation:none;opacity:0}#${uid} > .sl:first-of-type{opacity:1}}`,
  ].join('')
}

export function renderHeroSvg(opts: {
  slides: HeroSvgSlide[]
  brand?: string
  rtl?: boolean
  carousel?: unknown
}): string {
  const carousel: HeroCarousel = normalizeHeroCarousel(opts.carousel)
  const rtl = opts.rtl === true
  const slides = opts.slides.slice(0, 8)
  const n = slides.length
  const uid = 'h'
  // Without autoplay there is nothing to cycle, so only the cover is drawn.
  const cycling = n > 1 && carousel.autoplay
  const shown = cycling ? slides : slides.slice(0, 1)

  const layers = shown.map((slide, i) => {
    const inner =
      slide.kind === 'image'
        ? `<image href="${slide.dataUri}" x="0" y="0" width="${HERO_ART_W}" height="${HERO_ART_H}" preserveAspectRatio="xMidYMid slice"/>`
        : // A nested <svg> keeps each design's own ids, styles and viewBox intact.
          buildHeroSvg(slide.design, { uid: `${uid}s${i}`, patternHref, rtl, brand: opts.brand })
    const style = cycling ? ` class="sl" style="animation-delay:${-i * carousel.intervalMs}ms;opacity:${i === 0 ? 1 : 0}"` : ''
    return `<g${style}>${inner}</g>`
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" id="${uid}" width="${HERO_ART_W * 2}" height="${HERO_ART_H * 2}" viewBox="0 0 ${HERO_ART_W} ${HERO_ART_H}">${
    cycling ? `<style>${crossfadeCss(uid, n, carousel.intervalMs)}</style>` : ''
  }
<rect width="${HERO_ART_W}" height="${HERO_ART_H}" fill="#000000"/>
${layers.join('\n')}
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
