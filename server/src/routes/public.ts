import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../config/env.js'
import { badRequest } from '../lib/errors.js'
import { addFeedback, logEvent } from '../lib/mongo.js'
import { normalizeHeroSlides } from '../lib/heroDesign.js'
import { heroImageDataUri, renderHeroSvg, type HeroSvgSlide } from '../lib/heroSvg.js'
import { applyWidgetLanguage, type WidgetLang as WidgetLangName } from '../lib/widgetLang.js'
import { asyncHandler } from '../middleware/error.js'
import { getWidget, resolveConfig } from '../services/widgets.js'
import { uploadsDir } from './uploads.js'

/**
 * Public, unauthenticated endpoint consumed by the widget itself.
 * Mirrors Pair's `GET /v1/widget/:id/config` shape so the widget can point here instead of Pair.
 */
export const publicRouter = Router()

// Generous: this mount also fronts the widget's own chat traffic when beBaseUrl points here.
publicRouter.use(rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }))

/**
 * Uploads are stored as relative URLs (/api/public/uploads/…). The widget renders inside
 * an iframe on the SDK's origin, so relative URLs would resolve against the wrong host —
 * rewrite them to absolute URLs on this server before the config leaves.
 */
function absolutizeUploads<T>(value: T, origin: string): T {
  if (typeof value === 'string') {
    return (value.startsWith('/api/public/uploads/') ? origin + value : value) as T
  }
  if (Array.isArray(value)) return value.map((v) => absolutizeUploads(v, origin)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutizeUploads(v, origin)])) as T
  }
  return value
}

/** A config's hero, read through the shared normaliser so both sides agree on it. */
const heroOf = (config: Record<string, any>) => {
  const hs = config?.widget_v2_config?.intro_screen?.heroSection
  return { slides: normalizeHeroSlides(hs?.heroImages), carousel: hs?.carousel }
}

/**
 * The studio's hero is a slide list; a config may still be read by an SDK build
 * that only knows the single `heroImage.url`. So that field is pointed at
 * /hero.svg?widget=…, one animated SVG holding the whole list (see
 * lib/heroSvg.ts), while `heroImages` is left as it is for SDKs that do read it.
 * A hero that is already a single plain image passes through untouched.
 */
function materializeHero<T>(config: T, origin: string, widgetId: string, lng?: string): T {
  const c = config as Record<string, any>
  const { slides } = heroOf(c)
  const needsDrawing = slides.some((s) => s.type === 'design')
  if (!needsDrawing && slides.length < 2) return config
  const next = structuredClone(c)
  const hs = next.widget_v2_config.intro_screen.heroSection
  const rtl = /^(ar|he|fa|ur)/i.test(one(next.locale) ?? 'en')
  const q = new URLSearchParams({ widget: widgetId, dir: rtl ? 'rtl' : 'ltr' })
  if (lng) q.set('lng', lng)
  hs.heroImage = {
    styles: { width: '100%', height: '220px', objectFit: 'cover', borderRadius: '20px' },
    position: 'top',
    ...(hs.heroImage ?? {}),
    url: `${origin}/api/public/hero.svg?${q.toString()}`,
  }
  return next as T
}

/**
 * The widget's hero as one self-contained animated SVG (see lib/heroSvg.ts).
 *
 * Rendering it means base64-ing every uploaded slide, so the result is cached
 * against the config's own revision and served with an ETag — the widget asks
 * for this on every cold load, and the answer only changes when the design does.
 */
const svgCache = new Map<string, { etag: string; body: string }>()

publicRouter.get('/hero.svg', asyncHandler(async (req, res) => {
  const { widget, dir, lng } = req.query
  if (typeof widget !== 'string') {
    res.status(400).json({ error: { code: 'bad_hero', message: 'A widget id is required' } })
    return
  }

  const language = lng === 'ar' || lng === 'en' ? lng : undefined
  const { config } = await resolveConfig(widget)
  const c = (language ? applyWidgetLanguage(config, language) : config) as Record<string, any>
  const { slides, carousel } = heroOf(c)
  // Keyed on the hero itself (plus brand and direction, which it is drawn with),
  // so an unrelated edit elsewhere in the config does not throw the render away.
  const revision = createHash('sha1')
    .update(JSON.stringify({ slides, carousel, brand: c.widget_color, locale: c.locale }))
    .digest('base64url')
  const key = `${widget}|${revision}|${dir === 'rtl' || dir === 'ltr' ? dir : ''}`
  let hit = svgCache.get(key)

  if (!hit) {
    const drawable: HeroSvgSlide[] = []
    for (const slide of slides) {
      if (slide.type === 'design') {
        drawable.push({ kind: 'design', design: slide.design })
      } else {
        const dataUri = await heroImageDataUri(slide.url, uploadsDir())
        if (dataUri) drawable.push({ kind: 'image', dataUri })
      }
    }
    if (!drawable.length) {
      res.status(400).json({ error: { code: 'bad_hero', message: 'No drawable hero slides' } })
      return
    }
    const rtl = dir === 'rtl' || (dir !== 'ltr' && /^(ar|he|fa|ur)/i.test(one(c.locale) ?? 'en'))
    const body = renderHeroSvg({ slides: drawable, brand: one(c.widget_color), rtl, carousel })
    hit = { etag: `W/"${createHash('sha1').update(body).digest('base64url')}"`, body }
    // Small bound: a handful of widgets x languages, and any entry is cheap to rebuild.
    if (svgCache.size > 64) svgCache.delete(svgCache.keys().next().value as string)
    svgCache.set(key, hit)
  }

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
  res.setHeader('ETag', hit.etag)
  if (req.headers['if-none-match'] === hit.etag) {
    res.status(304).end()
    return
  }
  res.send(hit.body)
}))

publicRouter.get(
  '/widget/:widgetId/config',
  asyncHandler(async (req, res) => {
    const { source, cached, config } = await resolveConfig(req.params.widgetId)
    res.setHeader('X-Config-Source', source)
    res.setHeader('X-Config-Cached', String(cached))
    res.setHeader('Cache-Control', 'public, max-age=30')
    const origin = `${req.protocol}://${req.get('host')}`
    res.json(materializeHero(absolutizeUploads(config, origin), origin, req.params.widgetId))
  }),
)

/**
 * Language-forced config, for the test page's widget-language switch: the widget's
 * beBaseUrl points at /lang/:lng/v1, so the config arrives already translated
 * (locale + every known copy string). Mounted in app.ts with mergeParams.
 */
export const widgetLangRouter = Router({ mergeParams: true })
widgetLangRouter.get(
  '/widget/:widgetId/config',
  asyncHandler(async (req, res) => {
    const lng: WidgetLangName = (req.params as { lng?: string }).lng === 'ar' ? 'ar' : 'en'
    const { source, cached, config } = await resolveConfig(req.params.widgetId)
    res.setHeader('X-Config-Source', source)
    res.setHeader('X-Config-Cached', String(cached))
    res.setHeader('Cache-Control', 'public, max-age=30')
    const origin = `${req.protocol}://${req.get('host')}`
    res.json(materializeHero(absolutizeUploads(applyWidgetLanguage(config, lng), origin), origin, req.params.widgetId, lng))
  }),
)

const LAUNCHER_POSITIONS = new Set(['left', 'right'])
const LAUNCHER_TYPES = new Set(['standard', 'expanded_bubble', 'chat_icon', 'icon_only'])

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Values are interpolated into a <script> block, so they go through JSON and never break out of it. */
const js = (s: string) => JSON.stringify(s).replace(/</g, '\\u003c')

const one = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** Notes written by testers on the embed page. Stored (with status) and echoed to the system log. */
const feedbackSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: z.string().trim().min(1).max(40),
  note: z.string().trim().min(1).max(1000),
  imageUrl: z.string().trim().max(500).optional(),
})

publicRouter.post(
  '/widget/:widgetId/feedback',
  asyncHandler(async (req, res) => {
    const widget = await getWidget(req.params.widgetId)
    const { name, role, note, imageUrl } = feedbackSchema.parse(req.body)
    // Only screenshots uploaded through this server can be attached; never an arbitrary URL.
    const safeImage = imageUrl && imageUrl.startsWith('/api/public/uploads/') ? imageUrl : null
    const item = await addFeedback({ widgetId: widget.widgetId, name, role, note, imageUrl: safeImage })
    logEvent({
      level: 'info',
      action: 'preview.feedback',
      actor: `${name} (${role})`,
      widgetId: widget.widgetId,
      message: note,
      ip: req.ip,
      meta: safeImage ? { imageUrl: safeImage } : undefined,
    })
    res.status(201).json({ note: item })
  }),
)

/** Screenshot attached to a tester note. Tightly capped and saved next to the studio uploads. */
const NOTE_IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

publicRouter.post(
  '/widget/:widgetId/feedback/upload',
  rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }),
  express.raw({ type: Object.keys(NOTE_IMAGE_TYPES), limit: 3 * 1024 * 1024 }),
  asyncHandler(async (req, res) => {
    await getWidget(req.params.widgetId)
    const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim()
    const ext = NOTE_IMAGE_TYPES[contentType]
    if (!ext) throw badRequest('Use PNG, JPEG or WebP, up to 3 MB.')
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest('Empty upload')

    const dir = uploadsDir()
    await mkdir(dir, { recursive: true })
    const name = `fb-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`
    await writeFile(path.join(dir, name), req.body)
    res.status(201).json({ url: `/api/public/uploads/${name}` })
  }),
)

/**
 * A standalone test harness that runs the real widget for one registered widget ID.
 * It exists so a design can be tried in a browser exactly as a customer would see it —
 * the dashboard's own CSP forbids loading the third-party SDK inline.
 *
 * The page asks the tester for their name and role once, runs the SDK on the page
 * itself (desktop) and inside iPhone / Android frames (`?frame=1` renders the
 * minimal inner document), and keeps the tester's notes — with screenshots — in
 * the studio, where they are triaged on the widget's Notes tab.
 */
publicRouter.get(
  '/widget/:widgetId/embed',
  asyncHandler(async (req, res) => {
    const widget = await getWidget(req.params.widgetId)

    const position = LAUNCHER_POSITIONS.has(one(req.query.position) ?? '') ? (one(req.query.position) as string) : 'right'
    const type = LAUNCHER_TYPES.has(one(req.query.type) ?? '') ? (one(req.query.type) as string) : 'standard'
    const launcherTitle = (one(req.query.launcherTitle) ?? 'Chat with us!').slice(0, 120)
    const frameMode = req.query.frame === '1'
    // Safe-area inset for phone-frame previews: pushes the widget below a camera cutout.
    const inset = Math.min(80, Math.max(0, Number(one(req.query.inset)) || 0))
    const sdkBase = env.WIDGET_SDK_BASE_URL
    const sdkOrigin = new URL(sdkBase).origin
    // The widget fetches its design from {beBaseUrl}/v1/widget/:id/config — pointing it here
    // makes the test render the studio design (Redis) or the live one, per the widget's source.
    const selfOrigin = `${req.protocol}://${req.get('host')}`
    // Widget-language override: /lang/:lng/v1 serves the config already translated.
    const wlang = one(req.query.wlang) === 'ar' ? 'ar' : one(req.query.wlang) === 'en' ? 'en' : ''
    const beBase = wlang ? `${selfOrigin}/lang/${wlang}` : selfOrigin

    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' ${sdkOrigin}`,
        // The SDK injects its own stylesheet (sdk.css) and Google Fonts links.
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${sdkOrigin}`,
        `font-src https://fonts.gstatic.com data: ${sdkOrigin}`,
        'img-src * data: blob:',
        'media-src * data: blob:',
        `connect-src 'self' ${sdkOrigin} https://system.trypair.ai wss://${new URL(sdkBase).host}`,
        // 'self' so the page can host its own phone-frame iframes.
        `frame-src 'self' ${sdkOrigin}`,
      ].join('; '),
    )
    res.setHeader('Cache-Control', 'no-store')

    /**
     * Launcher attention effects. The SDK renders the launcher bubble directly in the
     * host page's DOM (#pair-ai-bubble-holder), so the page can animate it. Effects are
     * mixable: each one animates a different property/layer (sheen overlay, box-shadow,
     * filter, transform), so any combination runs together.
     */
    const fxCss = `
  @keyframes fx-sheen { from { transform: translateX(-160%) rotate(14deg) } to { transform: translateX(320%) rotate(14deg) } }
  @keyframes fx-pulse { 0% { box-shadow: 0 0 0 0 rgba(77,152,226,.5) } 70% { box-shadow: 0 0 0 16px rgba(77,152,226,0) } 100% { box-shadow: 0 0 0 0 rgba(77,152,226,0) } }
  @keyframes fx-glow { 0%,100% { filter: drop-shadow(0 0 3px rgba(77,152,226,.35)) } 50% { filter: drop-shadow(0 0 16px rgba(77,152,226,.85)) } }
  @keyframes fx-bounce { 0%,100% { transform: translateY(0) } 12% { transform: translateY(-8px) } 24% { transform: translateY(0) } 32% { transform: translateY(-4px) } 40% { transform: translateY(0) } }
  @keyframes fx-wiggle { 0%,100% { transform: rotate(0) } 10% { transform: rotate(-9deg) } 20% { transform: rotate(8deg) } 30% { transform: rotate(-5deg) } 40% { transform: rotate(3deg) } 50% { transform: rotate(0) } }
  #pair-ai-bubble-holder.fx-pulse { border-radius: 999px }
  #pair-ai-bubble-holder.fx-shimmer { overflow: hidden; border-radius: 999px }
  #pair-ai-bubble-holder.fx-shimmer::after { content: ''; position: absolute; top: -25%; bottom: -25%; left: 0; width: 42%;
    background: linear-gradient(105deg, transparent 28%, rgba(255,255,255,.65) 50%, transparent 72%);
    animation: fx-sheen 2.3s ease-in-out infinite; pointer-events: none }
  /* Branded footer: the widget's own "Powered by Pair AI" text sits inside its iframe,
     so a frosted overlay in the holder (our DOM) replaces it with the real wordmark. */
  .pair-powered { position: absolute; bottom: 0; left: 0; right: 0; height: 24px; z-index: 3; pointer-events: none;
    direction: ltr; display: flex; align-items: center; justify-content: center; gap: 5px;
    backdrop-filter: blur(14px) saturate(1.1); -webkit-backdrop-filter: blur(14px) saturate(1.1);
    border-radius: 0 0 15px 15px; font: 600 9px Montserrat, system-ui, sans-serif; color: #97a0a8 }
  .pair-powered img { height: 9px; display: block; opacity: .9 }
  /* No visible scrollbars: the widget's scrollbar lives inside its iframe (always on its right
     edge), so the iframe is rendered one scrollbar-width wider and the holder clips that edge. */
  #pair-ai-widget-holder { overflow: hidden !important }
  #pair-ai-widget-iframe { width: calc(100% + 17px) !important }`

    const sdkSnippet = `
<script>
  window.PairAiWidgetSettings = { position: ${js(position)}, type: ${js(type)}, launcherTitle: ${js(launcherTitle)}, beBaseUrl: ${js(beBase)} }
  ;(function (d, t) {
    var BASE_URL = ${js(sdkBase)}
    var g = d.createElement(t), s = d.getElementsByTagName(t)[0]
    g.src = BASE_URL + '/sdk.js'
    g.async = true
    s.parentNode.insertBefore(g, s)
    g.onload = function () {
      window.PairAiWidgetSDK.run({ widgetId: ${js(widget.widgetId)}, baseUrl: BASE_URL })
    }
  })(document, 'script')
</script>`

    // The inner document rendered inside the iPhone / Android frames: just the SDK in a clean viewport.
    if (frameMode) {
      res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(widget.channelName)} — mobile</title>
<style>
  * { box-sizing: border-box }
  body { margin: 0; min-height: 100dvh; font-family: system-ui, sans-serif;
    background: linear-gradient(165deg, #f4f9fe 0%, #e9f2fb 60%, #f2f8fe 100%) }
  p { position: fixed; inset-inline: 0; top: 42%; margin: 0; text-align: center;
    font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #a6b3bf }
  ${inset ? `/* Keep the widget clear of the phone frame's camera cutout. */
  #pair-ai-widget-holder, #pair-ai-preview-holder { top: ${inset}px !important; height: calc(100dvh - ${inset}px) !important; max-height: calc(100dvh - ${inset}px) !important }` : ''}
  ${fxCss}
</style>
</head>
<body>
<p>Mobile viewport</p>
${sdkSnippet}
</body>
</html>`)
      return
    }

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(widget.channelName)} — widget test page</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light; --accent: #4d98e2; --deep: #1f6fb8; --ink: #0f1216; --muted: #52555b;
    --line: #bdd1e0; --page: #f4f9fe; --code: #f0f6fa; --alert: #b4372f; --a50: #f2f8fe; --a100: #e2eefb; --a200: #c9e0f7 }
  * { box-sizing: border-box }
  html { scroll-behavior: smooth }
  body { margin: 0; min-height: 100dvh; font-family: Montserrat, system-ui, sans-serif; color: #181b1f; background: var(--page); overflow-x: hidden }
  html[lang="ar"] body { font-family: 'IBM Plex Sans Arabic', Montserrat, system-ui, sans-serif }

  /* --- Animations, mirrored from the studio's login screen --- */
  @keyframes rise { from { opacity: 0; transform: translate3d(0, 14px, 0) } to { opacity: 1; transform: none } }
  @keyframes pop { from { opacity: 0; transform: scale(.97) translate3d(0, 8px, 0) } to { opacity: 1; transform: none } }
  @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes sweep { from { opacity: 0; transform: scaleX(0) } to { opacity: 1; transform: scaleX(1) } }
  @keyframes drift { 0%, 100% { transform: translate3d(0,0,0) scale(1) } 33% { transform: translate3d(3%,-4%,0) scale(1.06) } 66% { transform: translate3d(-3%,3%,0) scale(.97) } }
  @keyframes float { 0%, 100% { transform: translate3d(0,0,0) } 50% { transform: translate3d(0,-10px,0) } }
  @keyframes shake { 10%,90% { transform: translateX(-1px) } 30%,70% { transform: translateX(2px) } 50% { transform: translateX(-2px) } }
  @keyframes toast-in { from { opacity: 0; transform: translate3d(0,16px,0) scale(.96) } to { opacity: 1; transform: none } }
  @keyframes screen-in { from { opacity: 0; transform: translate3d(0,10px,0) scale(.985) } to { opacity: 1; transform: none } }
  @keyframes brand-cycle { 0%,100% { background: #4d98e2 } 33% { background: #e50914 } 66% { background: #0eb47a } }
  @keyframes caret { 0%,45% { opacity: 1 } 50%,100% { opacity: 0 } }
  @keyframes tick { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  .rise { animation: rise .44s cubic-bezier(.22,1,.36,1) both }
  .stagger > * { animation: rise .44s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--d,0) * 60ms) }
  @media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }

  .glow { position: fixed; border-radius: 999px; filter: blur(2px); pointer-events: none; z-index: 0; animation: drift 22s ease-in-out infinite }
  .g1 { top: -22%; right: -18%; width: 56vw; height: 56vw; background: radial-gradient(circle, rgba(164,220,255,.45) 0%, rgba(164,220,255,.18) 45%, transparent 78%) }
  .g2 { bottom: -26%; left: -14%; width: 52vw; height: 52vw; background: radial-gradient(circle, rgba(177,226,255,.34) 0%, rgba(177,226,255,.15) 40%, transparent 76%); animation-delay: -8s }

  .eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--accent); margin: 0 }
  code { font-family: Menlo, ui-monospace, monospace; font-size: .85em; background: var(--code); padding: 2px 6px; border-radius: 4px }
  .card { background: rgba(255,255,255,.9); border: 1px solid var(--line); border-radius: 12px;
    box-shadow: 0 1px 2px rgba(15,18,22,.04), 0 18px 44px -28px rgba(31,111,184,.32) }
  .rule { height: 2px; width: 44px; border: 0; margin: 12px 0 0; background: var(--accent); border-radius: 999px; transform-origin: left; animation: sweep .6s .2s cubic-bezier(.22,1,.36,1) both }

  button, input, select, textarea { font: inherit }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; cursor: pointer;
    border-radius: 8px; background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 700; padding: 8px 14px;
    transition: background .2s, transform .15s, border-color .2s, color .2s }
  .btn:hover { background: var(--deep) }
  .btn:active { transform: scale(.98) }
  .btn-ghost { background: #fff; color: var(--muted); border: 1px solid var(--line) }
  .btn-ghost:hover { background: #fff; color: var(--deep); border-color: var(--accent) }
  .btn-sm { font-size: 11.5px; padding: 6px 11px; border-radius: 7px }
  .field { width: 100%; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 8px 11px;
    font-size: 13px; color: var(--ink); transition: border-color .2s, box-shadow .2s }
  .field:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(77,152,226,.18) }
  label { display: block; font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 0 0 5px }

  /* --- Toasts: same voice as the studio — a white card with an icon, top center, out of the widget's way --- */
  #toasts { position: fixed; inset-inline: 0; top: 58px; z-index: 90; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; padding: 0 16px }
  @keyframes toast-drop { from { opacity: 0; transform: translate3d(0,-14px,0) scale(.97) } to { opacity: 1; transform: none } }
  .toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: min(92vw, 400px);
    background: rgba(255,255,255,.96); border: 1px solid var(--line); border-radius: 11px;
    padding: 9px 14px; padding-inline-start: 10px; font-size: 12.5px; font-weight: 600; color: var(--ink);
    box-shadow: 0 1px 2px rgba(15,18,22,.05), 0 16px 40px -18px rgba(31,111,184,.4);
    animation: toast-drop .32s cubic-bezier(.22,1,.36,1) both }
  .toast .ic { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px;
    background: var(--a100); color: var(--deep); font-size: 12px; font-weight: 800 }
  .toast.err .ic { background: #fdf1f0; color: var(--alert) }
  .toast b { color: var(--deep); font-weight: 800 }
  .toast.err b { color: var(--alert) }
  .toast.out { transition: opacity .25s, transform .25s; opacity: 0; transform: translateY(-8px) }

  /* --- Entry gate --- */
  #gate { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
    padding: 20px; background: rgba(15,18,22,.38); backdrop-filter: blur(4px); animation: fade .3s both }
  #gate.hidden, #app.hidden { display: none }
  .gate-card { width: 100%; max-width: 380px; padding: 26px; animation: pop .32s cubic-bezier(.22,1,.36,1) both }
  .gate-card.shake { animation: shake .42s cubic-bezier(.36,.07,.19,.97) both }
  .gate-mark { height: 32px; display: block }
  .gate-card h1 { font-size: 19px; font-weight: 800; letter-spacing: -.01em; color: var(--ink); margin: 13px 0 4px }
  .gate-card > p { font-size: 12.5px; line-height: 1.6; color: var(--muted); margin: 0 0 16px }
  .roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 7px }
  .roles label { margin: 0; cursor: pointer }
  .roles input { position: absolute; opacity: 0; pointer-events: none }
  .roles span { display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line); border-radius: 8px;
    background: #fff; padding: 8px 6px; font-size: 11.5px; font-weight: 700; color: var(--muted); transition: all .2s }
  .roles label:hover span { border-color: var(--accent); color: var(--deep) }
  .roles input:checked + span { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 6px 16px -8px rgba(31,111,184,.6) }
  .roles input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px }

  /* --- Header --- */
  header { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
    padding: 9px clamp(16px, 4vw, 40px); background: rgba(255,255,255,.82); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line) }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 12px; color: var(--muted) }
  .brand img { height: 18px; display: block }
  .tester { margin-inline-start: auto; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted) }
  .tester .chip { display: inline-flex; align-items: center; gap: 6px; background: var(--code); border: 1px solid var(--line);
    border-radius: 999px; padding: 4px 11px; font-weight: 600; color: var(--ink); font-size: 11.5px }
  .tester .chip i { font-style: normal; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--accent) }
  .tester > button { border: 0; background: none; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--muted); padding: 4px }
  .tester > button:hover { color: var(--deep) }
  .lang { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 2px; gap: 2px }
  .lang button { border: 0; border-radius: 6px; background: none; cursor: pointer; font-size: 10.5px; font-weight: 700; color: var(--muted); padding: 4px 9px; transition: all .2s }
  .lang button.on { background: var(--accent); color: #fff }
  .lang button:not(.on):hover { color: var(--deep); background: var(--a50) }

  main { position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: clamp(22px, 4.5vh, 44px) clamp(16px, 4vw, 40px) 140px }

  /* --- Hero: marketing + showcase --- */
  .hero { display: grid; gap: 30px; align-items: center; grid-template-columns: minmax(0, 1fr) }
  @media (min-width: 940px) { .hero { grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr) } }
  .hero h2 { font-size: clamp(23px, 4vw, 32px); font-weight: 800; letter-spacing: -.015em; color: var(--ink); margin: 8px 0 0; line-height: 1.15 }
  .hero .lede { font-size: 13.5px; line-height: 1.65; color: var(--muted); max-width: 42em; margin: 12px 0 0 }
  .hero ul { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 8px }
  .hero li { display: flex; gap: 9px; align-items: flex-start; font-size: 12.5px; line-height: 1.55; color: var(--muted) }
  .hero li b { color: var(--ink) }
  .hero li::before { content: '✓'; flex: none; display: grid; place-items: center; width: 17px; height: 17px; margin-top: 1px;
    border-radius: 999px; background: var(--a100); color: var(--deep); font-size: 10px; font-weight: 800 }

  /* Showcase: cycling miniatures of the studio, like the login screen */
  .show { animation: rise .5s .15s cubic-bezier(.22,1,.36,1) both }
  .show .win { overflow: hidden }
  .show .bar { display: flex; align-items: center; gap: 5px; border-bottom: 1px solid var(--line); background: rgba(247,253,255,.8); padding: 7px 11px }
  .show .bar i { width: 8px; height: 8px; border-radius: 999px; background: var(--line); font-style: normal }
  .show .bar em { margin-inline-start: 7px; font-style: normal; font-size: 9px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: #8a97a3 }
  .show .bar b { margin-inline-start: auto; border-radius: 4px; background: var(--a50); color: var(--accent); font-size: 8.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; padding: 2px 6px }
  .show .stage { position: relative; height: 218px }
  .show .screen { position: absolute; inset: 0; padding: 14px; display: none }
  .show .screen.on { display: block; animation: screen-in .45s cubic-bezier(.22,1,.36,1) both }
  .show .dots { display: flex; align-items: center; gap: 6px; margin-top: 12px }
  .show .dots button { position: relative; height: 6px; width: 6px; padding: 0; border: 0; border-radius: 999px; background: var(--line); cursor: pointer; overflow: hidden; transition: all .3s }
  .show .dots button.on { width: 30px; background: var(--a200) }
  .show .dots button.on::after { content: ''; position: absolute; inset: 0; border-radius: 999px; background: var(--accent); transform-origin: left; animation: tick 4.6s linear both }
  .show .dots span { font-size: 10px; font-weight: 700; color: var(--muted) }
  /* mini mock pieces */
  .mk-grid { display: grid; grid-template-columns: 1fr 96px; gap: 14px; height: 100% }
  .mk-label { font-size: 8px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--accent); margin: 0 0 4px }
  .mk-field { display: flex; align-items: center; height: 22px; border: 1px solid var(--line); border-radius: 6px; padding: 0 6px;
    font-family: Menlo, monospace; font-size: 8.5px; color: var(--muted); background: #fff }
  .mk-field .caret { animation: caret 1.1s steps(1) infinite }
  .mk-swatch { width: 18px; height: 18px; border-radius: 5px; animation: brand-cycle 9s ease-in-out infinite }
  .mk-toggle { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--line); background: rgba(247,253,255,.6);
    border-radius: 6px; padding: 5px 7px; font-size: 8.5px; font-weight: 700; color: var(--ink); margin-top: 8px }
  .mk-toggle i { width: 22px; height: 11px; border-radius: 999px; animation: brand-cycle 9s ease-in-out infinite; position: relative; font-style: normal }
  .mk-toggle i::after { content: ''; position: absolute; top: 1.5px; right: 1.5px; width: 8px; height: 8px; border-radius: 999px; background: #fff }
  .mk-phone { border: 3px solid var(--ink); border-radius: 14px; background: #fff; overflow: hidden; display: flex; flex-direction: column }
  .mk-phone .hd { height: 26px; animation: brand-cycle 9s ease-in-out infinite; display: flex; align-items: center; padding: 0 7px }
  .mk-phone .hd i { width: 9px; height: 9px; border-radius: 999px; background: rgba(255,255,255,.85); font-style: normal }
  .mk-phone .ln { height: 6px; border-radius: 3px; background: var(--code); margin: 6px 7px 0 }
  .mk-phone .blk { flex: 1; margin: 6px 7px; border-radius: 6px; background: linear-gradient(135deg, var(--a100), var(--a50)) }
  .mk-phone .in { height: 14px; border-radius: 999px; background: var(--code); margin: 0 7px 7px }
  .mk-devices { display: flex; gap: 10px; align-items: center; justify-content: center; height: 100% }
  .mk-devices .dv { border: 3px solid var(--ink); background: #fff; animation: float 6s ease-in-out infinite }
  .mk-devices .dv.p1 { width: 76px; height: 150px; border-radius: 16px }
  .mk-devices .dv.p2 { width: 66px; height: 132px; border-radius: 12px; animation-delay: -3s }
  .mk-devices .dv.web { width: 120px; height: 88px; border-radius: 8px; animation-delay: -1.5s }
  .mk-devices .dv > div { height: 20%; animation: brand-cycle 9s ease-in-out infinite; border-radius: 4px 4px 0 0; margin: 4px 4px 0 }
  .mk-devices .dv > span { display: block; height: 5px; border-radius: 3px; background: var(--code); margin: 5px 6px 0 }
  .mk-code { height: 100%; border-radius: 8px; background: #10151b; padding: 12px; display: flex; flex-direction: column; gap: 7px }
  .mk-code span { height: 7px; border-radius: 3px; background: #2c3947; display: block }
  .mk-code span.a { width: 62%; background: #3a86c8 }
  .mk-code span.b { width: 84% }
  .mk-code span.c { width: 48%; background: #2e7d5b }
  .mk-code span.d { width: 72% }
  .mk-code em { margin-top: auto; align-self: flex-end; border-radius: 5px; background: var(--accent); color: #fff;
    font-style: normal; font-size: 8.5px; font-weight: 700; padding: 4px 9px }

  /* --- Builder --- */
  .builder { display: grid; gap: 12px; padding: 14px 16px; margin-top: 26px;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); align-items: end }
  .builder .apply { display: flex; flex-wrap: wrap; gap: 6px }

  /* --- Devices + notes --- */
  .cols { display: grid; gap: 20px; margin-top: 20px; grid-template-columns: minmax(0, 1fr) }
  @media (min-width: 1020px) { .cols { grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr) } }
  .panel-title { display: flex; align-items: baseline; gap: 10px; font-size: 14px; font-weight: 800; color: var(--ink); margin: 0 0 4px }
  .panel-title small { font-size: 11px; font-weight: 600; color: var(--muted) }

  .devices { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 24px 34px; padding: 26px 18px 20px;
    border-radius: 12px;
    background:
      radial-gradient(closest-side, rgba(77,152,226,.10), transparent 90%) center / 120% 120% no-repeat,
      radial-gradient(rgba(31,111,184,.14) 1px, transparent 1.5px) 0 0 / 22px 22px,
      linear-gradient(165deg, #fbfdff 0%, #eef5fc 100%) }
  /* Every frame shares one height; width follows the device's real aspect ratio, so the
     lineup sits on a common ground line like a proper device family shot. */
  .device { margin: 0; display: flex; flex-direction: column; align-items: center; text-align: center }
  .device .phone { animation: float 7s ease-in-out infinite }
  .device:nth-child(2) .phone { animation-delay: -2.4s }
  .device:nth-child(3) .phone { animation-delay: -4.7s }
  .device:nth-child(4) .phone { animation-delay: -1.3s }
  .device .ground { width: 62%; height: 12px; border-radius: 50%; margin-top: 14px;
    background: radial-gradient(closest-side, rgba(15,18,22,.16), transparent 72%) }
  .device figcaption { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-top: 4px }
  .frame-actions { display: flex; justify-content: center; gap: 6px; margin-top: 7px }
  .frame-actions button { border: 1px solid var(--line); background: #fff; color: var(--muted); cursor: pointer;
    border-radius: 999px; font-size: 10.5px; font-weight: 700; padding: 4px 11px; transition: all .2s }
  .frame-actions button:hover { border-color: var(--accent); color: var(--deep) }
  /* Sizes come from the DEVICES table in the script; each frame gets width + aspect-ratio inline. */
  .phone { position: relative; background: var(--ink); box-shadow: 0 24px 60px rgba(15,18,22,.32) }
  .phone.iphone { border-radius: 44px; padding: 9px }
  .phone.se { border-radius: 26px; padding: 8px }
  .phone.android { border-radius: 30px; padding: 7px }
  .phone.tablet { border-radius: 28px; padding: 11px }
  .phone .screen { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff }
  .phone.iphone .screen { border-radius: 36px }
  .phone.se .screen { border-radius: 18px }
  .phone.android .screen { border-radius: 24px }
  .phone.tablet .screen { border-radius: 17px }
  .dev-picker { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 14px 16px 0 }
  .dev-picker > span { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-inline-end: 4px }
  .dev-picker button { border: 1px solid var(--line); background: #fff; color: var(--muted); cursor: pointer;
    border-radius: 999px; font-size: 11px; font-weight: 700; padding: 5px 12px; transition: all .2s }
  .dev-picker button.on { background: var(--accent); border-color: var(--accent); color: #fff }
  .dev-picker button:not(.on):hover { border-color: var(--accent); color: var(--deep) }
  /* The iframe renders at a real phone viewport (390 CSS px) and is scaled down to the frame,
     so the widget lays itself out exactly as it would on an actual device. */
  .phone iframe { border: 0; width: 390px; height: 844px; transform-origin: top left }
  [dir="rtl"] .phone iframe { transform-origin: top right }
  .phone .island { position: absolute; top: 17px; left: 50%; transform: translateX(-50%); width: 78px; height: 21px; border-radius: 999px; background: var(--ink); z-index: 2 }
  .phone .hole { position: absolute; top: 15px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; border-radius: 999px; background: var(--ink); z-index: 2 }

  .notes { padding: 18px; align-self: start }
  .notes textarea { min-height: 76px; resize: vertical }
  .notes .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 9px }
  .notes .row-l { display: flex; align-items: center; gap: 6px }
  .attach-thumb { position: relative; display: none; margin-top: 10px; width: fit-content }
  .attach-thumb.on { display: block; animation: pop .25s both }
  .attach-thumb img { display: block; max-height: 84px; max-width: 100%; border-radius: 8px; border: 1px solid var(--line) }
  .attach-thumb button { position: absolute; top: -7px; inset-inline-end: -7px; width: 20px; height: 20px; border: 0; border-radius: 999px;
    background: var(--ink); color: #fff; font-size: 11px; line-height: 1; cursor: pointer }
  #noteList { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 9px }
  #noteList li { position: relative; border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 11px 13px; padding-inline-end: 32px; animation: pop .28s both }
  #noteList p { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; word-break: break-word }
  #noteList img { display: block; max-height: 110px; border-radius: 7px; border: 1px solid var(--line); margin-top: 8px; cursor: zoom-in }
  #noteList small { display: block; margin-top: 6px; font-size: 10px; color: var(--muted) }
  #noteList .sent { color: var(--accent); font-weight: 700 }
  #noteList .del { position: absolute; top: 7px; inset-inline-end: 7px; border: 0; background: none; cursor: pointer; color: var(--muted); font-size: 14px; line-height: 1; padding: 4px }
  #noteList .del:hover { color: var(--alert) }
  .empty-note { font-size: 11.5px; color: var(--muted); text-align: center; border: 1px dashed var(--line); border-radius: 10px; padding: 16px; margin-top: 16px }

  .foot { margin-top: 30px; border-inline-start: 3px solid var(--accent); padding-inline-start: 12px; font-size: 12px; color: var(--muted); line-height: 1.6 }
  .powered { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 30px 0 0;
    font-size: 11px; font-weight: 600; color: var(--muted) }
  .powered img { height: 14px; display: block }

  /* Toast lifetime bar */
  .toast { position: relative; overflow: hidden }
  @keyframes toast-life { from { transform: scaleX(1) } to { transform: scaleX(0) } }
  .toast::after { content: ''; position: absolute; bottom: 0; inset-inline: 0; height: 2px; background: var(--a200);
    transform-origin: left; animation: toast-life 3.2s linear both }
  .toast.err::after { background: var(--alert); opacity: .4 }

  /* Launcher effects picker */
  .fx-row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
    border-top: 1px dashed var(--line); padding-top: 12px }
  .fx-row > span { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
  #fxChips { display: flex; flex-wrap: wrap; gap: 6px }
  #fxChips button { border: 1px solid var(--line); background: #fff; color: var(--muted); cursor: pointer;
    border-radius: 999px; font-size: 11px; font-weight: 700; padding: 5px 12px; transition: all .2s }
  #fxChips button.on { background: var(--accent); border-color: var(--accent); color: #fff }
  #fxChips button:not(.on):hover { border-color: var(--accent); color: var(--deep) }
  ${fxCss}
</style>
</head>
<body>
<div class="glow g1"></div>
<div class="glow g2"></div>
<div id="toasts" aria-live="polite"></div>

<!-- Entry gate: who is testing? Kept in this browser so notes carry the tester's name and role. -->
<div id="gate" class="hidden">
  <form id="gateForm" class="card gate-card">
    <img class="gate-mark" src="/pair-mark.svg" alt="Pair" />
    <h1 data-i18n="gate.title">Before you start testing</h1>
    <p data-i18n="gate.sub">Tell us who you are — your notes on this design will be saved with your name and role.</p>
    <div class="stagger" style="display:grid;gap:13px">
      <div style="--d:0"><label for="tName" data-i18n="gate.name">Your name</label><input id="tName" class="field" maxlength="60" autocomplete="name" data-i18n-ph="gate.namePh" placeholder="e.g. Taha" /></div>
      <div style="--d:1"><label data-i18n="gate.role">Your role</label>
        <div class="roles" id="tRoles" role="radiogroup" aria-label="Your role">
          <label><input type="radio" name="tRole" value="Designer" checked /><span data-i18n="role.designer">Designer</span></label>
          <label><input type="radio" name="tRole" value="Developer" /><span data-i18n="role.developer">Developer</span></label>
          <label><input type="radio" name="tRole" value="Product" /><span data-i18n="role.product">Product</span></label>
          <label><input type="radio" name="tRole" value="QA" /><span data-i18n="role.qa">QA</span></label>
          <label><input type="radio" name="tRole" value="Other" /><span data-i18n="role.other">Other</span></label>
        </div>
      </div>
      <button class="btn" type="submit" style="--d:2" data-i18n="gate.start">Start testing →</button>
    </div>
  </form>
</div>

<div id="app" class="hidden">
  <header class="rise">
    <span class="brand"><img src="/pair-wordmark.svg" alt="Pair" /><span data-i18n="hdr.tag">· widget test page</span></span>
    <span class="tester">
      <span class="lang" role="group" aria-label="Language">
        <button id="langEn" type="button">EN</button><button id="langAr" type="button">عربي</button>
      </span>
      <span class="chip"><span id="whoName"></span><i id="whoRole"></i></span>
      <button id="changeTester" type="button" data-i18n="hdr.change">change</button>
    </span>
  </header>

  <main>
    <section class="hero">
      <div class="rise">
        <p class="eyebrow"><span data-i18n="hero.eyebrow">Live widget test</span> · ${esc(widget.channelName)}</p>
        <h2 data-i18n-html="hero.title">One widget ID.<br />Designed in the studio, served everywhere.</h2>
        <hr class="rule" />
        <p class="lede" data-i18n-html="hero.lede"></p>
        <ul class="stagger">
          <li style="--d:1"><span data-i18n-html="hero.p1"></span></li>
          <li style="--d:2"><span data-i18n-html="hero.p2"></span></li>
          <li style="--d:3"><span data-i18n-html="hero.p3"></span></li>
        </ul>
      </div>

      <div class="show">
        <div class="card win">
          <div class="bar"><i></i><i></i><i></i><em>Widget Studio</em><b>Live</b></div>
          <div class="stage">
            <div class="screen on" data-screen="0">
              <div class="mk-grid">
                <div>
                  <p class="mk-label">Brand color</p>
                  <div style="display:flex;gap:6px;align-items:center"><span class="mk-swatch"></span><span class="mk-field" style="flex:1">#4D98E2<span class="caret">|</span></span></div>
                  <p class="mk-label" style="margin-top:10px">Header title</p>
                  <span class="mk-field">${esc(widget.channelName)}</span>
                  <div class="mk-toggle">Show hero <i></i></div>
                  <div class="mk-toggle">Voice messages <i></i></div>
                </div>
                <div class="mk-phone"><div class="hd"><i></i></div><span class="ln" style="width:60%"></span><div class="blk"></div><span class="in"></span></div>
              </div>
            </div>
            <div class="screen" data-screen="1">
              <div class="mk-devices">
                <div class="dv p1"><div></div><span style="width:70%"></span><span style="width:50%"></span></div>
                <div class="dv web"><div style="height:26%"></div><span style="width:80%"></span><span style="width:55%"></span></div>
                <div class="dv p2"><div></div><span style="width:65%"></span><span style="width:45%"></span></div>
              </div>
            </div>
            <div class="screen" data-screen="2">
              <div class="mk-code"><span class="a"></span><span class="b"></span><span class="c"></span><span class="d"></span><span style="width:38%"></span><em>Copy snippet</em></div>
            </div>
          </div>
        </div>
        <div class="dots">
          <button type="button" class="on" data-dot="0" aria-label="Design"></button>
          <button type="button" data-dot="1" aria-label="Preview"></button>
          <button type="button" data-dot="2" aria-label="Embed"></button>
          <span id="dotLabel">Design</span>
        </div>
      </div>
    </section>

    <section class="card builder stagger" aria-label="Launcher builder">
      <div style="--d:0"><label for="bPos" data-i18n="b.pos">Launcher position</label>
        <select id="bPos" class="field"><option value="right" data-i18n="b.right">Right</option><option value="left" data-i18n="b.left">Left</option></select>
      </div>
      <div style="--d:1"><label for="bType" data-i18n="b.type">Launcher type</label>
        <select id="bType" class="field">
          <option value="standard" data-i18n="b.standard">Standard</option>
          <option value="expanded_bubble" data-i18n="b.expanded">Expanded bubble</option>
          <option value="chat_icon" data-i18n="b.chatIcon">Chat icon</option>
          <option value="icon_only" data-i18n="b.iconOnly">Icon only</option>
        </select>
      </div>
      <div style="--d:2"><label for="bTitle" data-i18n="b.title">Launcher title</label><input id="bTitle" class="field" maxlength="120" /></div>
      <div style="--d:3"><label for="bWlang" data-i18n="b.wlang">Widget language</label>
        <select id="bWlang" class="field">
          <option value="" data-i18n="b.default">Design default</option>
          <option value="en">English</option>
          <option value="ar">عربي</option>
        </select>
      </div>
      <div class="apply" style="--d:4">
        <button id="bApply" class="btn btn-sm" type="button" data-i18n="b.apply">Apply</button>
        <button id="wOpen" class="btn btn-ghost btn-sm" type="button" data-i18n="b.open">Open</button>
        <button id="wClose" class="btn btn-ghost btn-sm" type="button" data-i18n="b.close">Close</button>
      </div>
      <div class="fx-row" style="--d:5">
        <span data-i18n="fx.title">Launcher effects</span>
        <div id="fxChips"></div>
      </div>
    </section>

    <div class="cols">
      <section class="card" aria-label="Device previews">
        <div class="dev-picker" id="devPicker"><span data-i18n="d.pick">Devices</span></div>
        <div class="devices" id="devices"></div>
      </section>

      <section class="card notes rise" style="--d:2" aria-label="Test notes">
        <p class="panel-title"><span data-i18n="n.title">Test notes</span> <small data-i18n="n.sub">what's not working for you?</small></p>
        <textarea id="noteText" class="field" maxlength="1000" data-i18n-ph="n.ph" placeholder="e.g. The header color clashes with the hero image…"></textarea>
        <div class="attach-thumb" id="attachThumb"><img id="attachImg" alt="Attached screenshot" /><button type="button" id="attachRemove" aria-label="Remove screenshot">×</button></div>
        <div class="row">
          <div class="row-l">
            <button id="noteAttach" class="btn btn-ghost btn-sm" type="button" data-i18n="n.attach">📎 Screenshot</button>
          </div>
          <button id="noteAdd" class="btn btn-sm" type="button" data-i18n="n.save">Save note</button>
        </div>
        <input type="file" id="noteFile" accept="image/png,image/jpeg,image/webp" hidden />
        <ul id="noteList"></ul>
        <p class="empty-note" id="noteEmpty" data-i18n="n.empty">No notes yet — write the first thing that bothers you.</p>
      </section>
    </div>

    <p class="foot rise" style="--d:3" data-i18n="foot">This page loads the real Pair SDK, so what you see here is exactly what a visitor sees on the customer's site.
       Resize the window or open this page on a phone to test responsiveness end to end.</p>

    <p class="powered rise" style="--d:4">
      <span data-i18n="powered">Powered by</span>
      <img src="/pair-wordmark.svg" alt="Pair AI" />
    </p>
  </main>
</div>

<script>
  var WIDGET_ID = ${js(widget.widgetId)}
  var SETTINGS = { position: ${js(position)}, type: ${js(type)}, launcherTitle: ${js(launcherTitle)} }
  var TESTER_KEY = 'pair.tester'
  var NOTES_KEY = 'pair.notes.' + WIDGET_ID

  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  function read(k) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } }
  var $ = function (id) { return document.getElementById(id) }

  /* --- The whole page speaks English and Arabic --- */
  var CH = ${js(widget.channelName)}
  var WID = ${js(widget.widgetId)}
  var I18N = {
    en: {
      'hdr.tag': '· widget test page', 'hdr.change': 'change',
      'gate.title': 'Before you start testing',
      'gate.sub': 'Tell us who you are — your notes on this design will be saved with your name and role.',
      'gate.name': 'Your name', 'gate.namePh': 'e.g. Taha', 'gate.role': 'Your role', 'gate.start': 'Start testing →',
      'role.designer': 'Designer', 'role.developer': 'Developer', 'role.product': 'Product', 'role.qa': 'QA', 'role.other': 'Other',
      'hero.eyebrow': 'Live widget test',
      'hero.title': 'One widget ID.<br />Designed in the studio, served everywhere.',
      'hero.lede': 'Pair turns <b>' + CH + '</b> into a branded AI assistant. This design was built in the Pair Widget Studio and is running here through the real SDK — widget <code>' + WID + '</code> — exactly as a visitor would see it.',
      'hero.p1': '<b>Design without a deploy.</b> Colors, hero, prompts and quick links are edited in the studio and served live.',
      'hero.p2': '<b>Every device, both directions.</b> Desktop, iPhone and Android — English and Arabic, LTR and RTL.',
      'hero.p3': "<b>Your notes reach the team.</b> Anything you flag here lands on the widget's Notes board in the studio.",
      'b.pos': 'Launcher position', 'b.right': 'Right', 'b.left': 'Left', 'b.type': 'Launcher type',
      'b.standard': 'Standard', 'b.expanded': 'Expanded bubble', 'b.chatIcon': 'Chat icon', 'b.iconOnly': 'Icon only',
      'b.title': 'Launcher title', 'b.apply': 'Apply', 'b.open': 'Open', 'b.close': 'Close',
      'n.title': 'Test notes', 'n.sub': "what's not working for you?",
      'n.ph': 'e.g. The header color clashes with the hero image…',
      'n.attach': '📎 Screenshot', 'n.uploading': 'Uploading…', 'n.save': 'Save note',
      'n.empty': 'No notes yet — write the first thing that bothers you.',
      'n.sent': 'sent to studio', 'n.local': 'saved locally',
      'd.pick': 'Devices',
      'b.wlang': 'Widget language', 'b.default': 'Design default',
      'powered': 'Powered by',
      'fx.title': 'Launcher effects', 'fx.shimmer': 'Shimmer', 'fx.pulse': 'Pulse', 'fx.glow': 'Glow', 'fx.bounce': 'Bounce', 'fx.wiggle': 'Wiggle',
      'foot': 'This page loads the real Pair SDK, so what you see here is exactly what a visitor sees on the customer\\'s site. Resize the window or open this page on a phone to test responsiveness end to end.',
      'dots': ['Design', 'Preview', 'Embed'],
      't.welcome': 'Welcome, <b>{n}</b> — happy testing!',
      't.nameReq': '<b>Your name</b> is required to start testing.',
      't.noteReq': 'Write the note first.',
      't.noteSent': 'Note sent to the <b>studio</b>. Thank you!',
      't.noteFail': 'Saved locally, but it did not reach the studio. <b>Check your connection.</b>',
      't.imgBig': 'Screenshot is over <b>3 MB</b> — please crop or compress it.',
      't.imgOk': 'Screenshot attached.', 't.imgFail': 'Could not upload the screenshot. <b>Try again.</b>',
    },
    ar: {
      'hdr.tag': '· صفحة تجربة الودجت', 'hdr.change': 'تغيير',
      'gate.title': 'قبل أن تبدأ التجربة',
      'gate.sub': 'عرّفنا بنفسك — ملاحظاتك على هذا التصميم ستُحفظ باسمك ودورك.',
      'gate.name': 'اسمك', 'gate.namePh': 'مثال: طه', 'gate.role': 'دورك', 'gate.start': 'ابدأ التجربة ←',
      'role.designer': 'مصمم', 'role.developer': 'مطوّر', 'role.product': 'منتج', 'role.qa': 'جودة', 'role.other': 'آخر',
      'hero.eyebrow': 'تجربة حيّة للودجت',
      'hero.title': 'معرّف ودجت واحد.<br />يُصمَّم في الاستوديو ويُقدَّم في كل مكان.',
      'hero.lede': 'Pair تحوّل <b>' + CH + '</b> إلى مساعد ذكي بهوية علامتك. هذا التصميم بُني في استوديو Pair ويعمل هنا عبر الـ SDK الحقيقي — الودجت <code>' + WID + '</code> — تمامًا كما يراه الزائر.',
      'hero.p1': '<b>صمّم دون نشر جديد.</b> الألوان والصورة الرئيسية والأسئلة والروابط السريعة تُحرَّر في الاستوديو وتُقدَّم مباشرة.',
      'hero.p2': '<b>كل الأجهزة وبالاتجاهين.</b> سطح المكتب وآيفون وأندرويد — عربي وإنجليزي، يمين ويسار.',
      'hero.p3': '<b>ملاحظاتك تصل للفريق.</b> كل ما تسجّله هنا يظهر في لوحة ملاحظات الودجت داخل الاستوديو.',
      'b.pos': 'موضع المُشغّل', 'b.right': 'يمين', 'b.left': 'يسار', 'b.type': 'نوع المُشغّل',
      'b.standard': 'قياسي', 'b.expanded': 'فقاعة موسّعة', 'b.chatIcon': 'أيقونة محادثة', 'b.iconOnly': 'أيقونة فقط',
      'b.title': 'عنوان المُشغّل', 'b.apply': 'تطبيق', 'b.open': 'فتح', 'b.close': 'إغلاق',
      'n.title': 'ملاحظات التجربة', 'n.sub': 'ما الذي لا يعجبك؟',
      'n.ph': 'مثال: لون الترويسة لا يتناسب مع الصورة الرئيسية…',
      'n.attach': '📎 لقطة شاشة', 'n.uploading': 'جارٍ الرفع…', 'n.save': 'حفظ الملاحظة',
      'n.empty': 'لا توجد ملاحظات بعد — اكتب أول ما يزعجك.',
      'n.sent': 'أُرسلت للاستوديو', 'n.local': 'محفوظة محليًا',
      'd.pick': 'الأجهزة',
      'b.wlang': 'لغة الودجت', 'b.default': 'افتراضي التصميم',
      'powered': 'مدعوم بواسطة',
      'fx.title': 'مؤثرات المُشغّل', 'fx.shimmer': 'لمعان', 'fx.pulse': 'نبض', 'fx.glow': 'توهج', 'fx.bounce': 'قفزة', 'fx.wiggle': 'اهتزاز',
      'foot': 'تعمل هذه الصفحة بالـ SDK الحقيقي من Pair، فما تراه هنا هو ما يراه الزائر على موقع العميل تمامًا. غيّر حجم النافذة أو افتح الصفحة من هاتفك لاختبار التجاوب بالكامل.',
      'dots': ['التصميم', 'المعاينة', 'التضمين'],
      't.welcome': 'أهلًا <b>{n}</b> — تجربة سعيدة!',
      't.nameReq': '<b>اسمك</b> مطلوب لبدء التجربة.',
      't.noteReq': 'اكتب الملاحظة أولًا.',
      't.noteSent': 'وصلت الملاحظة إلى <b>الاستوديو</b>. شكرًا لك!',
      't.noteFail': 'حُفظت محليًا لكنها لم تصل إلى الاستوديو. <b>تحقق من الاتصال.</b>',
      't.imgBig': 'حجم اللقطة أكبر من <b>3 ميجابايت</b> — صغّرها أو اقتصّها.',
      't.imgOk': 'تم إرفاق اللقطة.', 't.imgFail': 'تعذّر رفع اللقطة. <b>حاول مرة أخرى.</b>',
    },
  }
  var LANG_KEY = 'pair.lang'
  var lang = read(LANG_KEY) || ((navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en')
  function tr(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k }
  function applyLang() {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = tr(el.getAttribute('data-i18n')) })
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = tr(el.getAttribute('data-i18n-html')) })
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = tr(el.getAttribute('data-i18n-ph')) })
    $('langEn').classList.toggle('on', lang === 'en')
    $('langAr').classList.toggle('on', lang === 'ar')
    document.querySelectorAll('.frame-actions').forEach(function (fa) {
      var bs = fa.querySelectorAll('button')
      if (bs[0]) bs[0].textContent = tr('b.open')
      if (bs[1]) bs[1].textContent = tr('b.close')
    })
    if (typeof renderNotes === 'function') try { renderNotes() } catch (e) {}
    if (typeof renderFxChips === 'function') try { renderFxChips() } catch (e) {}
    if (typeof syncDotLabel === 'function') try { syncDotLabel() } catch (e) {}
    if (typeof fitFrames === 'function') try { fitFrames() } catch (e) {}
  }
  function setLang(l) { lang = l; store(LANG_KEY, l); applyLang() }
  $('langEn').addEventListener('click', function () { setLang('en') })
  $('langAr').addEventListener('click', function () { setLang('ar') })

  /* --- Toasts --- */
  function toast(msg, kind) {
    var el = document.createElement('div')
    el.className = 'toast' + (kind === 'err' ? ' err' : '')
    el.innerHTML = '<span class="ic">' + (kind === 'err' ? '!' : '✓') + '</span><span>' + msg + '</span>'
    $('toasts').appendChild(el)
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove() }, 280) }, 3200)
  }

  /* --- Gate --- */
  function pickedRole() {
    var el = document.querySelector('input[name="tRole"]:checked')
    return el ? el.value : 'Other'
  }
  function showApp(tester) {
    $('whoName').textContent = tester.name
    $('whoRole').textContent = tester.role
    $('gate').classList.add('hidden')
    $('app').classList.remove('hidden')
  }
  function showGate(prefill) {
    if (prefill) {
      $('tName').value = prefill.name || ''
      var radio = document.querySelector('input[name="tRole"][value="' + (prefill.role || 'Designer') + '"]')
      if (radio) radio.checked = true
    }
    $('gate').classList.remove('hidden')
    setTimeout(function () { $('tName').focus() }, 60)
  }
  $('gateForm').addEventListener('submit', function (e) {
    e.preventDefault()
    var name = $('tName').value.trim()
    if (!name) {
      var card = e.target
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake')
      toast(tr('t.nameReq'), 'err')
      $('tName').focus()
      return
    }
    var tester = { name: name.slice(0, 60), role: pickedRole() }
    store(TESTER_KEY, tester)
    showApp(tester)
    toast(tr('t.welcome').replace('{n}', esc(tester.name)))
  })
  $('changeTester').addEventListener('click', function () { showGate(read(TESTER_KEY)) })

  function esc(s) { var d = document.createElement('span'); d.textContent = s; return d.innerHTML }

  var saved = read(TESTER_KEY)
  if (saved && saved.name) showApp(saved)
  else { $('app').classList.remove('hidden'); showGate(null) }

  /* --- Showcase cycling --- */
  var syncDotLabel = null
  ;(function () {
    var screens = document.querySelectorAll('.show .screen')
    var dots = document.querySelectorAll('.show .dots button')
    var current = 0, timer = null
    syncDotLabel = function () { $('dotLabel').textContent = tr('dots')[current] }
    function go(i) {
      current = i
      screens.forEach(function (s, k) { s.classList.toggle('on', k === i) })
      dots.forEach(function (d, k) {
        d.classList.remove('on'); void d.offsetWidth
        if (k === i) d.classList.add('on')
      })
      syncDotLabel()
    }
    function arm() { clearInterval(timer); timer = setInterval(function () { go((current + 1) % screens.length) }, 4600) }
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); arm() }) })
    var box = document.querySelector('.show')
    box.addEventListener('mouseenter', function () { clearInterval(timer) })
    box.addEventListener('mouseleave', arm)
    arm()
  })()

  /* --- Launcher builder: rebuilds the URL so page + frames reload with the new settings --- */
  var WLANG = ${js(wlang)}
  $('bPos').value = SETTINGS.position
  $('bType').value = SETTINGS.type
  $('bTitle').value = SETTINGS.launcherTitle
  $('bWlang').value = WLANG
  $('bApply').addEventListener('click', function () {
    var q = new URLSearchParams({ position: $('bPos').value, type: $('bType').value, launcherTitle: $('bTitle').value.slice(0, 120) })
    if ($('bWlang').value) q.set('wlang', $('bWlang').value)
    location.search = q.toString()
  })
  // Picking a widget language applies immediately — the page and every frame reload in it.
  $('bWlang').addEventListener('change', function () { $('bApply').click() })

  /* --- Device frames: pick any mix; each runs the SDK at that device's real viewport, scaled to fit --- */
  var DEVICES = [
    { id: 'iphone', label: 'iPhone 15', vw: 390, vh: 844, cls: 'iphone', cut: 'island', inset: 46, w: 266 },
    { id: 'se', label: 'iPhone SE', vw: 375, vh: 667, cls: 'se', cut: null, inset: 0, w: 236 },
    { id: 'android', label: 'Android', vw: 412, vh: 915, cls: 'android', cut: 'hole', inset: 38, w: 266 },
    { id: 'tablet', label: 'iPad', vw: 820, vh: 1180, cls: 'tablet', cut: null, inset: 0, w: 340 },
  ]
  var DEV_KEY = 'pair.devices'
  var enabledDevices = read(DEV_KEY) || ['iphone', 'android']

  function fitFrames() {
    // One shared height for the whole lineup; each width follows the device's real aspect ratio.
    // Width and height are both set explicitly so the frame can never stretch out of ratio.
    var H = Math.min(420, Math.max(280, Math.round(window.innerHeight * 0.4)))
    var maxW = Math.round(window.innerWidth * 0.86)
    document.querySelectorAll('.devices .phone').forEach(function (ph) {
      var vw = parseInt(ph.getAttribute('data-vw') || '390', 10)
      var vh = parseInt(ph.getAttribute('data-vh') || '844', 10)
      var h = H
      var w = Math.round(h * vw / vh)
      if (w > maxW) { w = maxW; h = Math.round(w * vh / vw) }
      ph.style.width = w + 'px'
      ph.style.height = h + 'px'
    })
    document.querySelectorAll('.phone .screen').forEach(function (sc) {
      var f = sc.querySelector('iframe')
      if (!f || !sc.clientWidth) return
      var vw = parseInt(f.getAttribute('data-vw') || '390', 10)
      var s = sc.clientWidth / vw
      f.style.width = vw + 'px'
      f.style.height = Math.round(sc.clientHeight / s) + 'px'
      f.style.transform = 'scale(' + s + ')'
    })
  }
  window.addEventListener('resize', fitFrames)

  function sdkOf(win) { return win && win.PairAiWidgetSDK ? win.PairAiWidgetSDK : null }
  $('wOpen').addEventListener('click', function () { var s = sdkOf(window); if (s) s.show() })
  $('wClose').addEventListener('click', function () { var s = sdkOf(window); if (s) s.hide() })

  function frameSrc(d) {
    var q = new URLSearchParams({ position: SETTINGS.position, type: SETTINGS.type, launcherTitle: SETTINGS.launcherTitle, frame: '1' })
    if (d && d.inset) q.set('inset', String(d.inset))
    return location.pathname + '?' + q.toString()
  }

  function renderDevices() {
    var host = $('devices')
    host.innerHTML = ''
    var shown = DEVICES.filter(function (d) { return enabledDevices.indexOf(d.id) !== -1 })
    shown.forEach(function (d, i) {
      var fig = document.createElement('figure')
      fig.className = 'device rise'
      fig.style.setProperty('--d', String(i + 1))
      var phone = document.createElement('div')
      phone.className = 'phone ' + d.cls
      phone.setAttribute('data-vw', String(d.vw))
      phone.setAttribute('data-vh', String(d.vh))
      phone.style.aspectRatio = d.vw + ' / ' + d.vh
      if (d.cut) { var cut = document.createElement('span'); cut.className = d.cut; phone.appendChild(cut) }
      var screen = document.createElement('div')
      screen.className = 'screen'
      var frame = document.createElement('iframe')
      frame.setAttribute('data-vw', String(d.vw))
      frame.title = d.label
      frame.loading = 'lazy'
      frame.src = frameSrc(d)
      screen.appendChild(frame)
      phone.appendChild(screen)
      fig.appendChild(phone)
      var ground = document.createElement('span'); ground.className = 'ground'; fig.appendChild(ground)
      var cap = document.createElement('figcaption'); cap.textContent = d.label; fig.appendChild(cap)
      var actions = document.createElement('div'); actions.className = 'frame-actions'
      var open = document.createElement('button'); open.type = 'button'; open.textContent = tr('b.open')
      var close = document.createElement('button'); close.type = 'button'; close.textContent = tr('b.close')
      open.addEventListener('click', function () { try { var s = sdkOf(frame.contentWindow); if (s) s.show() } catch (e) {} })
      close.addEventListener('click', function () { try { var s = sdkOf(frame.contentWindow); if (s) s.hide() } catch (e) {} })
      actions.appendChild(open); actions.appendChild(close); fig.appendChild(actions)
      host.appendChild(fig)
    })
    fitFrames()
    setTimeout(fitFrames, 300)
  }

  function renderPicker() {
    var picker = $('devPicker')
    picker.querySelectorAll('button').forEach(function (b) { b.remove() })
    DEVICES.forEach(function (d) {
      var b = document.createElement('button')
      b.type = 'button'
      b.textContent = d.label
      b.className = enabledDevices.indexOf(d.id) !== -1 ? 'on' : ''
      b.setAttribute('aria-pressed', enabledDevices.indexOf(d.id) !== -1 ? 'true' : 'false')
      b.addEventListener('click', function () {
        var i = enabledDevices.indexOf(d.id)
        if (i === -1) enabledDevices.push(d.id)
        else if (enabledDevices.length > 1) enabledDevices.splice(i, 1)
        store(DEV_KEY, enabledDevices)
        renderPicker()
        renderDevices()
      })
      picker.appendChild(b)
    })
  }
  renderPicker()
  renderDevices()

  /* --- Launcher effects: mixable, applied live to this page and every phone frame --- */
  var FX = [
    { id: 'shimmer', k: 'fx.shimmer' },
    { id: 'pulse', k: 'fx.pulse' },
    { id: 'glow', k: 'fx.glow' },
    { id: 'bounce', k: 'fx.bounce' },
    { id: 'wiggle', k: 'fx.wiggle' },
  ]
  var FX_KEY = 'pair.fx'
  var fxOn = read(FX_KEY) || []
  function fxActive(id) { return fxOn.indexOf(id) !== -1 }

  function applyFx(doc) {
    var h = doc.getElementById('pair-ai-bubble-holder')
    if (!h) return
    h.classList.toggle('fx-shimmer', fxActive('shimmer'))
    h.classList.toggle('fx-pulse', fxActive('pulse'))
    // Each mixable effect animates a different property, so they can run together:
    // pulse = box-shadow on the holder; glow = filter; bounce/wiggle = transform on the bubble.
    h.style.animation = fxActive('pulse') ? 'fx-pulse 2.2s ease-out infinite' : ''
    var b = h.querySelector('button') || h.firstElementChild
    if (!b) return
    var parts = []
    if (fxActive('glow')) parts.push('fx-glow 2.6s ease-in-out infinite')
    if (fxActive('bounce')) parts.push('fx-bounce 2.8s ease-in-out infinite')
    if (fxActive('wiggle')) parts.push('fx-wiggle 3.4s ease-in-out infinite')
    b.style.animation = parts.join(', ')
  }
  function brandFooter(doc) {
    var h = doc.getElementById('pair-ai-widget-holder')
    if (!h || h.querySelector('.pair-powered')) return
    var d = doc.createElement('div')
    d.className = 'pair-powered'
    d.innerHTML = '<span>Powered by</span><img src="/pair-wordmark.svg" alt="Pair AI" />'
    h.appendChild(d)
  }
  function applyFxAll() {
    applyFx(document)
    brandFooter(document)
    document.querySelectorAll('iframe[data-vw]').forEach(function (f) {
      try {
        if (f.contentWindow && f.contentWindow.document) {
          applyFx(f.contentWindow.document)
          brandFooter(f.contentWindow.document)
        }
      } catch (e) {}
    })
  }
  function renderFxChips() {
    var host = $('fxChips')
    host.innerHTML = ''
    FX.forEach(function (fx) {
      var b = document.createElement('button')
      b.type = 'button'
      b.textContent = tr(fx.k)
      b.className = fxActive(fx.id) ? 'on' : ''
      b.setAttribute('aria-pressed', fxActive(fx.id) ? 'true' : 'false')
      b.addEventListener('click', function () {
        var i = fxOn.indexOf(fx.id)
        if (i === -1) fxOn.push(fx.id)
        else fxOn.splice(i, 1)
        store(FX_KEY, fxOn)
        renderFxChips()
        applyFxAll()
      })
      host.appendChild(b)
    })
  }
  renderFxChips()
  // The SDK adds the launcher asynchronously (page and frames alike), so keep re-applying.
  setInterval(applyFxAll, 1500)

  /* --- Notes: screenshot attach, kept locally and sent to the studio's Notes board --- */
  var pendingImage = null

  $('noteAttach').addEventListener('click', function () { $('noteFile').click() })
  $('attachRemove').addEventListener('click', function () { pendingImage = null; $('attachThumb').classList.remove('on') })
  $('noteFile').addEventListener('change', function () {
    var f = this.files && this.files[0]
    this.value = ''
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { toast(tr('t.imgBig'), 'err'); return }
    var btn = $('noteAttach')
    btn.disabled = true; btn.textContent = tr('n.uploading')
    fetch(location.pathname.replace(/\\/embed$/, '/feedback/upload'), { method: 'POST', headers: { 'content-type': f.type }, body: f })
      .then(function (r) { if (!r.ok) throw new Error('upload failed'); return r.json() })
      .then(function (r) {
        pendingImage = r.url
        $('attachImg').src = r.url
        $('attachThumb').classList.add('on')
        toast(tr('t.imgOk'))
      })
      .catch(function () { toast(tr('t.imgFail'), 'err') })
      .finally(function () { btn.disabled = false; btn.textContent = tr('n.attach') })
  })

  function notes() { return read(NOTES_KEY) || [] }
  function fmt(iso) {
    var d = new Date(iso)
    var loc = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB'
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  }
  function renderNotes() {
    var list = notes()
    var ul = $('noteList')
    ul.innerHTML = ''
    $('noteEmpty').style.display = list.length ? 'none' : 'block'
    list.forEach(function (n, i) {
      var li = document.createElement('li')
      var p = document.createElement('p'); p.textContent = n.text
      li.appendChild(p)
      if (n.imageUrl) {
        var img = document.createElement('img')
        img.src = n.imageUrl; img.alt = 'Screenshot'
        img.addEventListener('click', function () { window.open(n.imageUrl, '_blank') })
        li.appendChild(img)
      }
      var small = document.createElement('small')
      small.textContent = n.name + ' (' + n.role + ') · ' + fmt(n.at) + ' · '
      var status = document.createElement('span')
      status.textContent = n.sent ? tr('n.sent') : tr('n.local')
      if (n.sent) status.className = 'sent'
      small.appendChild(status)
      li.appendChild(small)
      var del = document.createElement('button')
      del.className = 'del'; del.type = 'button'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete note')
      del.addEventListener('click', function () {
        var next = notes(); next.splice(i, 1); store(NOTES_KEY, next); renderNotes()
      })
      li.appendChild(del)
      ul.appendChild(li)
    })
  }
  $('noteAdd').addEventListener('click', function () {
    var text = $('noteText').value.trim()
    if (!text) { toast(tr('t.noteReq'), 'err'); $('noteText').focus(); return }
    var tester = read(TESTER_KEY) || { name: 'Anonymous', role: 'Other' }
    var note = { at: new Date().toISOString(), name: tester.name, role: tester.role, text: text, imageUrl: pendingImage, sent: false }
    var list = notes(); list.unshift(note); if (list.length > 100) list.length = 100
    store(NOTES_KEY, list)
    $('noteText').value = ''
    pendingImage = null
    $('attachThumb').classList.remove('on')
    renderNotes()
    fetch(location.pathname.replace(/\\/embed$/, '/feedback'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: tester.name, role: tester.role, note: text, imageUrl: note.imageUrl || undefined }),
    }).then(function (r) {
      if (!r.ok) throw new Error('failed')
      var l = notes()
      if (l.length && l[0].at === note.at) { l[0].sent = true; store(NOTES_KEY, l); renderNotes() }
      toast(tr('t.noteSent'))
    }).catch(function () { toast(tr('t.noteFail'), 'err') })
  })
  renderNotes()
  applyLang()
</script>
${sdkSnippet}
</body>
</html>`)
  }),
)
