import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../config/env.js'
import { badRequest } from '../lib/errors.js'
import { addFeedback, logEvent } from '../lib/mongo.js'
import { normalizeHeroCarousel, normalizeHeroSlides } from '../lib/heroDesign.js'
import {
  cardCss, cardSubtitleCss, cardTextCss, chipCss, inputCss, launcherCss, loadingCss,
  normalizeChatInput, normalizeLauncher, normalizeQuickLinks, resolve as resolveColor,
  normalizeLoading, normalizePrompts, normalizeToast, placeholderCss, sendCss, toastCss,
} from '../lib/inputDesign.js'
import { heroImageDataUri, renderHeroSvg, type HeroSvgSlide } from '../lib/heroSvg.js'
import { isDrawableSendIcon, sendGlyphDataUri } from '../lib/sendGlyph.js'
import { applyWidgetLanguage, type WidgetLang as WidgetLangName } from '../lib/widgetLang.js'
import { applyWidgetTheme, isWidgetTheme } from '../lib/widgetTheme.js'
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

/**
 * The welcome copy the dashboard lays over the hero. It is drawn into the hero
 * image, so the SDK's own copy is blanked in the served config (see
 * `materializeHero`) and the text appears once, in the place a designer put it.
 */
const heroOverlayOf = (config: Record<string, any>) => ({
  title: one(config?.widget_v2_config?.intro_screen?.welcomeTitle?.text) ?? one(config?.welcome_title) ?? '',
  subtitle: one(config?.widget_v2_config?.intro_screen?.welcomeSubtitle?.text) ?? one(config?.welcome_tagline) ?? '',
})

/** A config's hero, read through the shared normaliser so both sides agree on it. */
const heroOf = (config: Record<string, any>) => {
  const hs = config?.widget_v2_config?.intro_screen?.heroSection
  return { slides: normalizeHeroSlides(hs?.heroImages), carousel: hs?.carousel }
}

/**
 * Compiles the chat input and launcher designs into the fields the widget
 * reads.
 *
 * The widget already accepted a raw CSS blob for the composer, the placeholder,
 * the send button and the launcher, so most of a design lands by filling those
 * in — no widget change needed, and older builds get the styling too. The
 * structured block travels alongside for the parts the widget had to be taught
 * (the typed text, the action buttons, the launcher's icon and geometry).
 */
function materializeChrome<T>(config: T): T {
  const c = config as Record<string, any>
  const hasInput = !!c?.widget_v2_config?.chat_input?.design
  const hasLauncher = !!c?.launcher_design
  const hasLoading = !!c?.widget_v2_config?.intro_screen?.loadingState?.design
  const hasToast = !!c?.toast_design
  const hasSendIcon = !!c?.widget_v2_config?.chat_input?.sendButtonIcon?.icon
  const hasPrompts = !!c?.widget_v2_config?.trending_prompts?.design
  const hasCards = !!c?.widget_v2_config?.quick_links?.design
  if (!hasInput && !hasLauncher && !hasLoading && !hasToast && !hasSendIcon && !hasPrompts && !hasCards) {
    return config
  }

  const next = structuredClone(c)
  const brand = one(next.widget_color) ?? '#E30613'

  if (hasInput) {
    const design = normalizeChatInput(next.widget_v2_config.chat_input.design)
    const ci = next.widget_v2_config.chat_input
    // The design is what the builder edits, so it wins over the generated
    // `styles` block. Keys the design does not set (a theme's own additions)
    // are kept, so nothing else in the config is lost.
    ci.styles = { ...(ci.styles ?? {}), ...inputCss(design, brand) }
    ci.placeholderText = {
      ...(ci.placeholderText ?? {}),
      styles: { ...(ci.placeholderText?.styles ?? {}), ...placeholderCss(design, brand) },
    }
    // The builder edits the design, so it is what decides the glyph too.
    const icon = design.send.icon || ci.sendButtonIcon?.icon
    ci.sendButtonIcon = {
      ...(ci.sendButtonIcon ?? {}),
      icon,
      url: design.send.url || ci.sendButtonIcon?.url,
      // An SDK build that predates `design` draws the send glyph from `variant`,
      // and knows only two of them. Mapping the chosen icon onto the nearer one
      // keeps the button pointing the right way there; a build that reads
      // `design` uses `icon` above and ignores this.
      variant: /-up$/.test(String(icon)) ? 'arrow-up' : 'send',
      styles: { ...(ci.sendButtonIcon?.styles ?? {}), ...sendCss(design, brand) },
    }
    // A build that ships only two glyphs still draws the channel's own mark: it
    // arrives as a background image on the send button, with the built-in glyph
    // made transparent (see lib/sendGlyph.ts).
    const rtl = /^(ar|he|fa|ur)/i.test(one(next.locale) ?? 'en')
    const glyph =
      icon === 'custom'
        ? one(design.send.url) || one(ci.sendButtonIcon?.url)
        : sendGlyphDataUri(String(icon), design.send.iconColor, rtl) ?? undefined
    if (glyph && (icon === 'custom' ? true : isDrawableSendIcon(icon))) {
      ci.sendButtonIcon.styles = {
        ...ci.sendButtonIcon.styles,
        backgroundImage: `url("${glyph}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: `${design.send.iconSize}px`,
        iconColor: 'transparent',
      }
    }
    ci.inputLayout = { ...(ci.inputLayout ?? {}), type: design.layout }
    ci.inputActions = {
      ...(ci.inputActions ?? {}),
      voiceMessages: design.actions.voice,
      attachmentMenu: design.actions.attach,
      showEmojiPicker: design.actions.emoji,
    }
    ci.design = design
  }

  if (hasLoading) {
    const design = normalizeLoading(next.widget_v2_config.intro_screen.loadingState.design)
    const ls = next.widget_v2_config.intro_screen.loadingState
    // The widget switches on `type`, and reads the rest off custom properties.
    ls.type = design.type === 'spinner' || design.type === 'dots' ? 'spinner' : 'shimmer'
    ls.styles = { ...(ls.styles ?? {}), ...loadingCss(design, brand) }
    ls.design = design
  }

  if (hasCards) {
    const design = normalizeQuickLinks(next.widget_v2_config.quick_links.design)
    const ql = next.widget_v2_config.quick_links
    ql.cardStyle = { ...(ql.cardStyle ?? {}), ...cardCss(design, brand) }
    ql.textStyle = { ...(ql.textStyle ?? {}), ...cardTextCss(design, brand) }
    ql.subtitleStyle = { ...(ql.subtitleStyle ?? {}), ...cardSubtitleCss(design, brand) }
    ql.displaySettings = {
      ...(ql.displaySettings ?? {}),
      showTitle: design.showTitle,
      showSubtitle: design.showSubtitle,
      // The widget tells a stack from a carousel by the card's flexDirection.
      carouselLoop: design.loop,
    }
    ql.design = design
  }

  if (hasPrompts) {
    const design = normalizePrompts(next.widget_v2_config.trending_prompts.design)
    const tp = next.widget_v2_config.trending_prompts
    const chip = chipCss(design, brand)
    tp.chipStyle = { ...(tp.chipStyle ?? {}), ...chip }
    // The widget styles a chip's text separately from its surface.
    tp.textStyle = {
      ...(tp.textStyle ?? {}),
      color: chip.color,
      fontSize: chip.fontSize,
      fontWeight: chip.fontWeight,
      fontFamily: chip.fontFamily,
      textAlign: chip.textAlign,
    }
    tp.displaySettings = {
      ...(tp.displaySettings ?? {}),
      showTitle: design.showTitle,
      showIcons: design.showIcon,
      layout: design.layout === 'stack' ? 'chip' : (tp.displaySettings?.layout ?? 'chip'),
      styles: {
        ...(tp.displaySettings?.styles ?? {}),
        color: resolveColor(design.titleColor, brand),
        fontSize: `${design.titleSize}px`,
        fontWeight: design.titleWeight,
        ...(design.titleFont ? { fontFamily: design.titleFont } : {}),
      },
    }
    // A chip's own uploaded icon is the only one the widget can fetch; a named
    // glyph travels in `design` for a build that knows how to draw it.
    if (Array.isArray(tp.promptChips)) {
      tp.promptChips = tp.promptChips.map((c: any) => ({
        ...c,
        iconUrl: c?.icon === 'custom' ? c.iconUrl : c?.iconUrl,
      }))
    }
    tp.design = design
  }

  if (hasToast) {
    const design = normalizeToast(next.toast_design)
    next.toast_design = { ...design, styles: toastCss(design, brand) }
  }

  if (hasLauncher) {
    const design = normalizeLauncher(next.launcher_design)
    next.launcher_styles = { ...(next.launcher_styles ?? {}), ...launcherCss(design, brand) }
    next.launcher_style = design.type
    next.launcher_position = design.position
    if (design.label.text.trim()) next.launcher_title = design.label.text
    next.launcher_design = design
  }

  return next as T
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
  const { slides, carousel } = heroOf(c)
  if (!slides.length) return config
  const next = structuredClone(c)
  const hs = next.widget_v2_config.intro_screen.heroSection
  const rtl = /^(ar|he|fa|ur)/i.test(one(next.locale) ?? 'en')
  const dir = rtl ? 'rtl' : 'ltr'
  const drawn = (params: Record<string, string>) => {
    const q = new URLSearchParams({ widget: widgetId, dir, ...params })
    if (lng) q.set('lng', lng)
    return `${origin}/api/public/hero.svg?${q.toString()}`
  }

  // Every slide leaves as a drawn URL, uploads included: the welcome copy is laid
  // over the slide the way the dashboard shows it, which an SDK cannot do to a
  // bare image. An SDK reading the list therefore gets a real carousel, and the
  // normalised carousel block tells it how to run it.
  hs.heroImages = slides.map((_slide, i) => ({ url: drawn({ slide: String(i) }) }))
  hs.carousel = normalizeHeroCarousel(carousel)

  // `heroImage` stays the single-slide fallback: one image holding the whole
  // list, for a build that does not read `heroImages`.
  hs.heroImage = {
    styles: { width: '100%', height: '220px', objectFit: 'cover', borderRadius: '20px' },
    position: 'top',
    ...(hs.heroImage ?? {}),
    url: drawn({}),
  }

  // The welcome copy is now part of the hero image. An SDK that also renders it
  // as a heading under the hero would show it twice, so its copy of the text is
  // cleared — but only while a hero is actually on screen to carry it.
  const overlay = heroOverlayOf(next)
  if (hs.enabled?.value !== false && (overlay.title || overlay.subtitle)) {
    const intro = next.widget_v2_config.intro_screen
    if (intro.welcomeTitle) intro.welcomeTitle = { ...intro.welcomeTitle, text: '' }
    if (intro.welcomeSubtitle) intro.welcomeSubtitle = { ...intro.welcomeSubtitle, text: '' }
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
  const { widget, dir, lng, slide } = req.query
  if (typeof widget !== 'string') {
    res.status(400).json({ error: { code: 'bad_hero', message: 'A widget id is required' } })
    return
  }

  const language = lng === 'ar' || lng === 'en' ? lng : undefined
  const { config } = await resolveConfig(widget)
  const c = (language ? applyWidgetLanguage(config, language) : config) as Record<string, any>
  const hero = heroOf(c)
  // ?slide=<i> draws that one slide, which is what a carousel-aware SDK asks
  // for; without it the whole list is baked into one crossfading image.
  const only = typeof slide === 'string' ? Number(slide) : NaN
  const picked = Number.isInteger(only) && only >= 0 && only < hero.slides.length
  const slides = picked ? [hero.slides[only]] : hero.slides
  const carousel = picked ? { autoplay: false } : hero.carousel
  // Keyed on the hero itself (plus brand and direction, which it is drawn with),
  // so an unrelated edit elsewhere in the config does not throw the render away.
  const overlay = heroOverlayOf(c)
  const revision = createHash('sha1')
    .update(JSON.stringify({ slides, carousel, overlay, brand: c.widget_color, locale: c.locale }))
    .digest('base64url')
  const key = `${widget}|${revision}|${dir === 'rtl' || dir === 'ltr' ? dir : ''}|${picked ? only : 'all'}`
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
    const badgeFallback = one(c.widget_v2_config?.header?.content?.title) ?? one(c.name) ?? ''
    const body = renderHeroSvg({ slides: drawable, brand: one(c.widget_color), rtl, carousel, badgeFallback, overlay })
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
    res.json(materializeChrome(materializeHero(absolutizeUploads(config, origin), origin, req.params.widgetId)))
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
    res.json(materializeChrome(materializeHero(absolutizeUploads(applyWidgetLanguage(config, lng), origin), origin, req.params.widgetId, lng)))
  }),
)

/**
 * View-forced config for the test page's controls: beBaseUrl points at
 * /pv/:lng/:theme, so the config arrives already translated AND re-themed.
 * Either segment can be `x` to keep that side of the saved design.
 */
export const widgetViewRouter = Router({ mergeParams: true })
widgetViewRouter.get(
  '/widget/:widgetId/config',
  asyncHandler(async (req, res) => {
    const p = req.params as { lng?: string; theme?: string }
    const lng: WidgetLangName | undefined = p.lng === 'ar' || p.lng === 'en' ? p.lng : undefined
    const theme = isWidgetTheme(p.theme) ? p.theme : undefined
    const { source, cached, config } = await resolveConfig(req.params.widgetId)
    res.setHeader('X-Config-Source', source)
    res.setHeader('X-Config-Cached', String(cached))
    res.setHeader('Cache-Control', 'public, max-age=30')
    const origin = `${req.protocol}://${req.get('host')}`
    let c = config
    if (lng) c = applyWidgetLanguage(c, lng)
    if (theme) c = applyWidgetTheme(c, theme)
    res.json(materializeChrome(materializeHero(absolutizeUploads(c, origin), origin, req.params.widgetId, lng)))
  }),
)

const LAUNCHER_POSITIONS = new Set(['left', 'right'])
/** A query value, only when it names one of the allowed choices. */
const LAUNCHER_ONE = (v: unknown, allowed: Set<string>): string | undefined => {
  const s = one(v)
  return s && allowed.has(s) ? s : undefined
}
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
 * A standalone test page that runs the real widget for one registered widget ID —
 * the design tried in a browser exactly as a customer would see it (the dashboard's
 * own CSP forbids loading the third-party SDK inline).
 *
 * Three things happen here, in order: a guided tour of how a Pair widget is made
 * (a route across a map, one stop per stage, closable and reopenable from the
 * logo), a one-time name gate so notes carry the tester's name, then the widget
 * itself — on a device, or running on this page like it would on a customer's
 * site. Language and theme are served already rewritten from /pv/:lng/:theme, the
 * same switch the builder pushes, so the real SDK renders them with no local tricks.
 */
publicRouter.get(
  '/widget/:widgetId/embed',
  asyncHandler(async (req, res) => {
    const widget = await getWidget(req.params.widgetId)

    // The launcher's own settings are part of the design, so the test page opens
    // with what the builder saved. A query parameter still wins, which is how the
    // embed panel previews a launcher the design has not been given yet.
    const { config: liveConfig } = await resolveConfig(req.params.widgetId)
    const lc = liveConfig as Record<string, any>
    const savedPosition = one(lc.launcher_design?.position) ?? one(lc.launcher_position)
    const savedType = one(lc.launcher_design?.type) ?? one(lc.launcher_style)
    const savedTitle = one(lc.launcher_design?.label?.text) ?? one(lc.launcher_title)
    const pick = (q: unknown, saved: string | undefined, allowed: Set<string>, fallback: string) =>
      LAUNCHER_ONE(q, allowed) ?? (saved && allowed.has(saved) ? saved : fallback)

    const position = pick(req.query.position, savedPosition, LAUNCHER_POSITIONS, 'right')
    const type = pick(req.query.type, savedType, LAUNCHER_TYPES, 'standard')
    const launcherTitle = (one(req.query.launcherTitle) ?? savedTitle ?? 'Chat with us!').slice(0, 120)
    const frameMode = req.query.frame === '1'
    // Page mode runs the widget on this document, so the SDK snippet is rendered
    // into the page rather than injected later — exactly as on a customer's site.
    const pageMode = one(req.query.surface) === 'page'
    // Safe-area inset for phone-frame previews: pushes the widget below a camera cutout.
    const inset = Math.min(80, Math.max(0, Number(one(req.query.inset)) || 0))
    const sdkBase = env.WIDGET_SDK_BASE_URL
    const sdkOrigin = new URL(sdkBase).origin
    const selfOrigin = `${req.protocol}://${req.get('host')}`
    // View overrides: the config is served already translated and/or re-themed.
    const wlang = one(req.query.wlang) === 'ar' ? 'ar' : one(req.query.wlang) === 'en' ? 'en' : ''
    const wtheme = one(req.query.wtheme) === 'dark' ? 'dark' : one(req.query.wtheme) === 'light' ? 'light' : ''
    const beBase = wlang || wtheme ? `${selfOrigin}/pv/${wlang || 'x'}/${wtheme || 'x'}` : selfOrigin

    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' ${sdkOrigin}`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${sdkOrigin}`,
        `font-src https://fonts.gstatic.com data: ${sdkOrigin}`,
        'img-src * data: blob:',
        'media-src * data: blob:',
        `connect-src 'self' ${sdkOrigin} https://system.trypair.ai wss://${new URL(sdkBase).host}`,
        `frame-src 'self' ${sdkOrigin}`,
      ].join('; '),
    )
    res.setHeader('Cache-Control', 'no-store')

    /**
     * Replaces the widget's own powered-by line with the real wordmark, and hides
     * the scrollbar the widget's iframe draws on its right edge.
     *
     * Both are done in CSS alone. The wordmark used to be a node appended into
     * the widget's holder on a timer, which the widget's own re-renders kept
     * wiping — so it was re-added a second later, flickering and costing a
     * repaint every tick. Pseudo-elements belong to our stylesheet instead, so
     * nothing re-renders them away and no timer has to run at all.
     */
    const poweredCss = `
  /* The widget positions this holder itself (fixed, docked to its corner), so its
     position is left alone — the pseudo-elements below hang off it as it is. */
  #pair-ai-widget-holder { overflow: hidden !important }
  #pair-ai-widget-holder::after {
    content: 'Powered by'; position: absolute; bottom: 0; left: 0; right: 0; height: 24px; z-index: 4;
    pointer-events: none; direction: ltr; display: flex; align-items: center; justify-content: center;
    padding-inline-end: 46px; border-radius: 0 0 15px 15px;
    backdrop-filter: blur(14px) saturate(1.1); -webkit-backdrop-filter: blur(14px) saturate(1.1);
    font: 600 9px Montserrat, system-ui, sans-serif; color: #97a0a8 }
  #pair-ai-widget-holder::before {
    content: ''; position: absolute; bottom: 7px; left: 50%; transform: translateX(6px); width: 38px; height: 10px; z-index: 5;
    pointer-events: none; opacity: .9; background: url(/pair-wordmark.svg) left center / contain no-repeat }
  /* The widget's scrollbar sits on its iframe's right edge, which the holder clips off. */
  #pair-ai-widget-iframe { width: calc(100% + 17px) !important; max-width: none !important }`


    /** The stock Pair embed snippet — what a customer pastes into their own site. */
    const sdkSnippet = `
<script>
  window.PairAiWidgetSettings = { position: ${js(position)}, type: ${js(type)}, launcherTitle: ${js(launcherTitle)}, beBaseUrl: ${js(beBase)} }
  ;(function (d, t) {
    var BASE_URL = ${js(sdkBase)}
    var g = d.createElement(t), s = d.getElementsByTagName(t)[0]
    g.src = BASE_URL + '/sdk.js'
    g.async = true
    s.parentNode.insertBefore(g, s)
    g.onload = function () { window.PairAiWidgetSDK.run({ widgetId: ${js(widget.widgetId)}, baseUrl: BASE_URL }) }
  })(document, 'script')
</script>`

    // The inner document rendered inside the device frames: just the SDK in a clean viewport.
    if (frameMode) {
      res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(widget.channelName)} — device</title>
<style>
  * { box-sizing: border-box }
  body { margin: 0; min-height: 100dvh; font-family: system-ui, sans-serif;
    background: ${wtheme === 'dark' ? 'linear-gradient(165deg, #101317 0%, #15191f 60%, #101317 100%)' : 'linear-gradient(165deg, #f4f9fe 0%, #e9f2fb 60%, #f2f8fe 100%)'} }
  ${inset ? `/* Keep the widget clear of the phone frame's camera cutout. */
  #pair-ai-widget-holder, #pair-ai-preview-holder { top: ${inset}px !important; height: calc(100dvh - ${inset}px) !important; max-height: calc(100dvh - ${inset}px) !important }` : ''}
  ${poweredCss}
</style>
</head>
<body>
${sdkSnippet}
</body>
</html>`)
      return
    }

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(widget.channelName)} — Pair widget</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light; --accent: #4d98e2; --deep: #1f6fb8; --ink: #0f1216; --muted: #52555b;
    --line: #bdd1e0; --page: #f4f9fe; --code: #f0f6fa; --alert: #b4372f; --a50: #f2f8fe; --a100: #e2eefb; --a200: #c9e0f7;
    --card: rgba(255,255,255,.92); --surface: #fff; --shadow: 0 1px 2px rgba(15,18,22,.04), 0 18px 44px -28px rgba(31,111,184,.32) }
  html[data-wt="dark"] { color-scheme: dark; --ink: #f2f5f8; --muted: #9aa5b1; --line: #262d36; --page: #0e1114;
    --code: #171c22; --card: rgba(22,26,32,.92); --surface: #14181d; --a50: #172029; --a100: #1b2735; --a200: #25405c }
  * { box-sizing: border-box }
  body { margin: 0; height: 100dvh; overflow: hidden;
    font-family: Montserrat, system-ui, sans-serif; color: var(--ink); background: var(--page) }
  /* The SDK appends its launcher and panel straight to <body> in page mode; the
     app lives in its own flex shell so those nodes never become layout siblings. */
  #shell { height: 100dvh; display: flex; flex-direction: column; overflow: hidden }
  html[lang="ar"] body { font-family: 'IBM Plex Sans Arabic', Montserrat, system-ui, sans-serif }
  svg { display: block }

  @keyframes rise { from { opacity: 0; transform: translate3d(0, 12px, 0) } to { opacity: 1; transform: none } }
  @keyframes pop { from { opacity: 0; transform: scale(.96) translate3d(0, 10px, 0) } to { opacity: 1; transform: none } }
  @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes shake { 10%,90% { transform: translateX(-1px) } 30%,70% { transform: translateX(2px) } 50% { transform: translateX(-2px) } }
  @keyframes drift { 0%, 100% { transform: translate3d(0,0,0) scale(1) } 33% { transform: translate3d(3%,-4%,0) scale(1.06) } 66% { transform: translate3d(-3%,3%,0) scale(.97) } }
  @keyframes dash { to { stroke-dashoffset: -28 } }
  @keyframes ping { 0% { transform: scale(1); opacity: .55 } 70%, 100% { transform: scale(2.1); opacity: 0 } }
  @keyframes bubble-in { from { opacity: 0; transform: translateY(6px) scale(.94) } to { opacity: 1; transform: none } }
  @keyframes tick { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  @keyframes toast-drop { from { opacity: 0; transform: translate3d(0,-14px,0) scale(.97) } to { opacity: 1; transform: none } }
  .rise { animation: rise .42s cubic-bezier(.22,1,.36,1) both }
  @media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important } }

  .glow { position: fixed; border-radius: 999px; filter: blur(2px); pointer-events: none; z-index: 0; animation: drift 24s ease-in-out infinite }
  .g1 { top: -24%; inset-inline-end: -18%; width: 54vw; height: 54vw; background: radial-gradient(circle, rgba(164,220,255,.45) 0%, rgba(164,220,255,.16) 46%, transparent 78%) }
  .g2 { bottom: -28%; inset-inline-start: -14%; width: 50vw; height: 50vw; background: radial-gradient(circle, rgba(177,226,255,.34) 0%, rgba(177,226,255,.13) 42%, transparent 76%); animation-delay: -9s }
  html[data-wt="dark"] .glow { opacity: .22 }

  button, input, select, textarea { font: inherit; color: inherit }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; cursor: pointer;
    border-radius: 10px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 700; padding: 10px 18px;
    transition: background .2s, transform .15s, box-shadow .2s; box-shadow: 0 10px 22px -12px rgba(31,111,184,.75) }
  .btn:hover { background: var(--deep) }
  .btn:active { transform: scale(.98) }
  .btn-ghost { background: var(--surface); color: var(--muted); border: 1px solid var(--line); box-shadow: none }
  .btn-ghost:hover { background: var(--surface); color: var(--deep); border-color: var(--accent) }
  .btn-sm { font-size: 11.5px; padding: 7px 12px; border-radius: 8px }
  .field { border: 1px solid var(--line); border-radius: 9px; background: var(--surface); padding: 8px 12px;
    font-size: 13px; transition: border-color .2s, box-shadow .2s }
  .field:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(77,152,226,.18) }
  label { display: block; font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow) }

  /* --- Header --- */
  header { position: relative; z-index: 5; display: flex; align-items: center; gap: 8px;
    padding: 10px clamp(12px, 3vw, 26px); background: var(--card); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line) }
  .brand { display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 4px; cursor: pointer; border-radius: 9px; min-width: 0 }
  .brand:hover { background: var(--a50) }
  .brand img { height: 16px; display: block; flex: none }
  .brand .name { font-weight: 700; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  html[data-wt="dark"] .brand img { filter: brightness(0) invert(1) }
  .controls { margin-inline-start: auto; display: flex; align-items: center; gap: 7px; min-width: 0 }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); padding: 2px; gap: 2px }
  .seg button { border: 0; border-radius: 7px; background: none; cursor: pointer; font-size: 11px; font-weight: 700;
    color: var(--muted); padding: 6px 10px; transition: all .18s; display: inline-flex; align-items: center; gap: 5px }
  .seg button.on { background: var(--accent); color: #fff }
  .seg button:not(.on):hover { color: var(--deep); background: var(--a50) }
  /* Surface picker: a real menu, so the list is styled like the rest of the page
     instead of the browser's native dropdown. */
  .menu { position: relative }
  .menu-btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 9px;
    background: var(--surface); color: var(--ink); font-size: 12px; font-weight: 700; padding: 8px 11px; cursor: pointer; transition: all .18s }
  .menu-btn:hover { border-color: var(--accent) }
  .menu-btn .lead { display: grid; place-items: center; color: var(--muted) }
  .menu-btn .caret { width: 10px; height: 6px; margin-inline-start: 2px; flex: none;
    background: currentColor; color: var(--muted);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23000' stroke-width='1.7' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23000' stroke-width='1.7' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat;
    transition: transform .2s }
  .menu.open .menu-btn { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(77,152,226,.16) }
  .menu.open .caret { transform: rotate(180deg) }
  .menu-pop { position: fixed; z-index: 60; min-width: 190px; padding: 6px;
    background: var(--card); backdrop-filter: blur(12px); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow);
    display: none; animation: pop .18s cubic-bezier(.22,1,.36,1) both }
  .menu.open .menu-pop { display: block }
  .menu-pop button { display: flex; align-items: center; gap: 9px; width: 100%; border: 0; border-radius: 8px; background: none;
    color: var(--ink); font-size: 12.5px; font-weight: 600; text-align: start; padding: 8px 10px; cursor: pointer; transition: background .15s }
  .menu-pop button:hover { background: var(--a50) }
  .menu-pop button .tick { margin-inline-start: auto; color: var(--accent); opacity: 0 }
  .menu-pop button[aria-selected="true"] { color: var(--deep); font-weight: 700 }
  .menu-pop button[aria-selected="true"] .tick { opacity: 1 }
  .menu-pop .sep { height: 1px; margin: 5px 6px; background: var(--line) }
  .menu-pop .grp { font-size: 9.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); padding: 6px 10px 3px }
  .iconbtn { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 9px;
    background: var(--surface); color: var(--muted); cursor: pointer; transition: all .18s; position: relative; flex: none }
  .iconbtn:hover { color: var(--deep); border-color: var(--accent) }
  .iconbtn .dot { position: absolute; top: -4px; inset-inline-end: -4px; min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px;
    background: var(--accent); color: #fff; font-size: 9px; font-weight: 800; line-height: 15px; text-align: center; border: 2px solid var(--card) }
  .who { display: inline-flex; align-items: center; gap: 7px; background: var(--code); border: 1px solid var(--line);
    border-radius: 999px; padding: 5px 12px 5px 6px; font-weight: 700; font-size: 11.5px; cursor: pointer; transition: border-color .18s }
  html[dir="rtl"] .who { padding: 5px 6px 5px 12px }
  .who:hover { border-color: var(--accent) }
  .who .av { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 800 }
  .who i { font-style: normal; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted) }
  /* Narrow screens: the controls stay one row and scroll sideways rather than
     wrapping into a second header or pushing the page wider than the viewport. */
  .controls { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 1px }
  .controls::-webkit-scrollbar { display: none }
  .controls > * { flex: none }
  @media (max-width: 860px) {
    header { gap: 6px; padding-inline: 10px }
    .brand .name { display: none }
    .who i { display: none }
    .who { padding: 5px 6px; gap: 5px }
    .who #whoName { max-width: 8ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .seg button { padding: 6px 9px }
    select.field { max-width: 148px }
  }

  /* --- Stage --- */
  main { position: relative; z-index: 1; flex: 1; min-height: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px; padding: clamp(10px, 2.4vh, 20px) 14px }
  #stage { display: flex; align-items: center; justify-content: center; min-height: 0; flex: 1; width: 100% }
  .phone { position: relative; background: #0f1216; box-shadow: 0 26px 64px -18px rgba(15,18,22,.45); flex: none }
  .phone.iphone { border-radius: 44px; padding: 9px }
  .phone.se { border-radius: 26px; padding: 8px }
  .phone.android { border-radius: 30px; padding: 7px }
  .phone.tablet { border-radius: 28px; padding: 11px }
  .phone .screen { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff }
  .phone.iphone .screen { border-radius: 36px }
  .phone.se .screen { border-radius: 18px }
  .phone.android .screen { border-radius: 24px }
  .phone.tablet .screen { border-radius: 17px }
  .phone iframe { border: 0; transform-origin: top left }
  html[dir="rtl"] .phone iframe { transform-origin: top right }
  .phone .island { position: absolute; top: 17px; left: 50%; transform: translateX(-50%); width: 78px; height: 21px; border-radius: 999px; background: #0f1216; z-index: 2 }
  .phone .hole { position: absolute; top: 15px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; border-radius: 999px; background: #0f1216; z-index: 2 }

  /* Desktop frame */
  .browser { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line); border-radius: 14px;
    background: var(--surface); box-shadow: 0 26px 64px -22px rgba(15,18,22,.4); flex: none }
  .browser .chrome { display: flex; align-items: center; gap: 6px; padding: 9px 13px; border-bottom: 1px solid var(--line); background: var(--code) }
  .browser .chrome i { width: 9px; height: 9px; border-radius: 999px; flex: none }
  .browser .chrome i:nth-child(1) { background: #ff5f57 } .browser .chrome i:nth-child(2) { background: #febc2e } .browser .chrome i:nth-child(3) { background: #28c840 }
  .browser .chrome em { margin-inline-start: 8px; flex: 1; font-style: normal; font-family: Menlo, monospace; font-size: 10.5px;
    color: var(--muted); background: var(--page); border-radius: 7px; padding: 4px 11px; text-align: center }
  .browser .screen { position: relative; flex: 1; overflow: hidden; background: #fff }
  .browser iframe { border: 0; transform-origin: top left }
  html[dir="rtl"] .browser iframe { transform-origin: top right }

  /* "On this page": the SDK runs on the page itself, over a mock site */
  .site { align-self: stretch; width: 100%; max-width: 1020px; margin: 0 auto; display: flex; flex-direction: column;
    border-radius: 14px; border: 1px solid var(--line);
    background: var(--surface); overflow: hidden; padding: clamp(16px, 3vw, 30px); animation: fade .4s both }
  .site .bar { display: flex; align-items: center; gap: 12px }
  .site .sq { width: 34px; height: 34px; border-radius: 10px; background: var(--accent); flex: none }
  .site .ln { height: 11px; border-radius: 999px; background: var(--code) }
  .site .nav { margin-inline-start: auto; display: flex; gap: 8px }
  .site .nav .ln { width: 58px }
  .site .banner { margin-top: 22px; flex: 1.4; min-height: 80px; border-radius: 14px; background: linear-gradient(135deg, var(--a100), var(--a50)) }
  .site .grid { margin-top: 16px; flex: 1; min-height: 56px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px }
  .site .grid div { border-radius: 12px; background: var(--code) }
  .site .hint { margin: 16px 0 0; text-align: center; font-size: 11.5px; font-weight: 600; color: var(--muted) }
  @media (max-width: 620px) { .site .grid { grid-template-columns: 1fr 1fr } .site .grid div:last-child { display: none } }

  .stage-actions { display: flex; gap: 8px; flex: none }
  .stage-actions button { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--line); background: var(--surface);
    color: var(--muted); cursor: pointer; border-radius: 999px; font-size: 11.5px; font-weight: 700; padding: 8px 16px; transition: all .18s }
  .stage-actions button:hover { border-color: var(--accent); color: var(--deep) }
  .stage-actions .btn { border: 0; background: var(--accent); color: #fff; font-size: 12.5px; padding: 9px 20px }
  .stage-actions .btn:hover { background: var(--deep); color: #fff }
  .powered { display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 600; color: var(--muted); flex: none }
  .powered img { height: 12px; display: block }
  html[data-wt="dark"] .powered img { filter: brightness(0) invert(1) }

  /* --- Overlays --- */
  .overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
    padding: 16px; background: rgba(9,13,18,.5); backdrop-filter: blur(6px); animation: fade .28s both; overflow: auto }
  .overlay.hidden { display: none }

  /* --- The tour: a route across a map, one stop per stage --- */
  .tour { position: relative; width: 100%; max-width: 640px; padding: 0; overflow: hidden; animation: pop .4s cubic-bezier(.22,1,.36,1) both }
  .tour .x { position: absolute; top: 12px; inset-inline-end: 12px; z-index: 3; display: grid; place-items: center; width: 32px; height: 32px;
    border: 0; border-radius: 999px; background: rgba(255,255,255,.7); color: var(--muted); cursor: pointer; transition: all .2s; backdrop-filter: blur(6px) }
  .tour .x:hover { background: #fff; color: var(--ink) }
  .map { position: relative; height: clamp(170px, 26vh, 215px);
    background:
      radial-gradient(60% 80% at 20% 15%, rgba(77,152,226,.13), transparent 70%),
      radial-gradient(50% 70% at 85% 80%, rgba(31,111,184,.12), transparent 70%),
      linear-gradient(160deg, #f7fbff 0%, #eaf3fc 100%) }
  html[data-wt="dark"] .map { background: linear-gradient(160deg, #141a21 0%, #101519 100%) }
  .map .grid { position: absolute; inset: 0; opacity: .5;
    background-image: linear-gradient(rgba(31,111,184,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(31,111,184,.10) 1px, transparent 1px);
    background-size: 26px 26px; mask-image: radial-gradient(circle at 50% 50%, #000 40%, transparent 92%) }
  .map svg { position: absolute; inset: 0; width: 100%; height: 100% }
  .route-bg { fill: none; stroke: rgba(31,111,184,.16); stroke-width: 3.5; stroke-linecap: round }
  .route-fg { fill: none; stroke: var(--accent); stroke-width: 3.5; stroke-linecap: round; transition: stroke-dashoffset .9s cubic-bezier(.4,0,.2,1) }
  .route-arrows { fill: none; stroke: rgba(255,255,255,.95); stroke-width: 2.4; stroke-linecap: round;
    stroke-dasharray: 0 14; animation: dash 1.1s linear infinite }
  .stop { cursor: pointer }
  .stop .ring { fill: #fff; stroke: var(--line); stroke-width: 2; transition: all .35s }
  html[data-wt="dark"] .stop .ring { fill: #1b2028 }
  .stop .num { font: 800 11px Montserrat, sans-serif; fill: var(--muted); text-anchor: middle; dominant-baseline: central; transition: fill .3s }
  .stop.done .ring { stroke: var(--accent) }
  .stop.done .num { fill: var(--accent) }
  .stop.on .ring { fill: var(--accent); stroke: var(--accent) }
  .stop.on .num { fill: #fff }
  .stop .halo { fill: var(--accent); opacity: 0; transform-box: fill-box; transform-origin: center }
  .stop.on .halo { animation: ping 1.9s ease-out infinite }
  .marker { transition: transform .85s cubic-bezier(.34,1.3,.5,1) }
  .marker .body { fill: var(--accent); stroke: #fff; stroke-width: 2 }
  .cap { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; pointer-events: none;
    background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 4px 11px;
    font-size: 10.5px; font-weight: 800; letter-spacing: .02em; color: var(--deep); box-shadow: 0 8px 18px -12px rgba(15,18,22,.5);
    opacity: 0; transition: opacity .35s, transform .35s }
  .cap.show { opacity: 1; animation: bubble-in .4s cubic-bezier(.22,1,.36,1) both }
  .tour .body-copy { padding: 20px clamp(20px, 4vw, 30px) 20px; text-align: center }
  .tour .step-no { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin: 0 }
  .tour h2 { margin: 7px 0 0; font-size: clamp(17px, 3.4vw, 21px); font-weight: 800; letter-spacing: -.015em; line-height: 1.2 }
  .tour p { margin: 8px auto 0; font-size: 13px; line-height: 1.65; color: var(--muted); max-width: 40em; min-height: 3.3em }
  .tour .nav-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 clamp(20px, 4vw, 30px) 20px }
  .tour .prog { display: flex; align-items: center; gap: 6px }
  .tour .prog button { position: relative; height: 6px; width: 6px; padding: 0; border: 0; border-radius: 999px; background: var(--line); cursor: pointer; overflow: hidden; transition: all .3s }
  .tour .prog button.on { width: 28px; background: var(--a200) }
  .tour .prog button.on::after { content: ''; position: absolute; inset: 0; border-radius: 999px; background: var(--accent); transform-origin: left; animation: tick 4.4s linear both }
  .tour .skip { border: 0; background: none; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--muted); padding: 8px }
  .tour .skip:hover { color: var(--deep) }
  @media (max-width: 560px) { .tour p { min-height: 4.8em } }

  /* --- Gate --- */
  .gate-card { width: 100%; max-width: 380px; padding: 28px; animation: pop .32s cubic-bezier(.22,1,.36,1) both }
  .gate-card.shake { animation: shake .42s cubic-bezier(.36,.07,.19,.97) both }
  .gate-card > img { height: 28px; display: block }
  .gate-card h1 { font-size: 19px; font-weight: 800; letter-spacing: -.015em; margin: 14px 0 5px }
  .gate-card > p { font-size: 12.5px; line-height: 1.6; color: var(--muted); margin: 0 0 16px }
  .gate-card .grid { display: grid; gap: 13px }
  .gate-card input.field { width: 100% }
  .roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(78px, 1fr)); gap: 6px }
  .roles label { margin: 0; cursor: pointer; text-transform: none; letter-spacing: 0 }
  .roles input { position: absolute; opacity: 0; pointer-events: none }
  .roles span { display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 9px;
    background: var(--surface); padding: 8px 4px; font-size: 11.5px; font-weight: 700; color: var(--muted); transition: all .18s }
  .roles label:hover span { border-color: var(--accent); color: var(--deep) }
  .roles input:checked + span { background: var(--accent); border-color: var(--accent); color: #fff }
  .roles input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px }

  /* --- Notes drawer --- */
  #scrim { position: fixed; inset: 0; z-index: 39; background: rgba(9,13,18,.35); opacity: 0; pointer-events: none; transition: opacity .3s }
  #scrim.on { opacity: 1; pointer-events: auto }
  #drawer { position: fixed; top: 0; bottom: 0; inset-inline-end: 0; z-index: 41; width: min(94vw, 370px);
    background: var(--card); backdrop-filter: blur(12px); border-inline-start: 1px solid var(--line);
    transform: translateX(calc(103% * var(--sign, 1))); transition: transform .32s cubic-bezier(.22,1,.36,1);
    display: flex; flex-direction: column; padding: 16px }
  html[dir="rtl"] #drawer { --sign: -1 }
  #drawer.open { transform: none }
  #drawer h3 { display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px; font-size: 14px; font-weight: 800 }
  #drawer textarea { width: 100%; min-height: 74px; resize: vertical }
  #drawer .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px }
  .attach-thumb { position: relative; display: none; margin-top: 9px; width: fit-content }
  .attach-thumb.on { display: block; animation: pop .25s both }
  .attach-thumb img { display: block; max-height: 72px; border-radius: 9px; border: 1px solid var(--line) }
  .attach-thumb button { position: absolute; top: -7px; inset-inline-end: -7px; width: 20px; height: 20px; border: 0; border-radius: 999px;
    background: var(--ink); color: var(--page); font-size: 11px; line-height: 1; cursor: pointer }
  #noteList { list-style: none; margin: 14px 0 0; padding: 0 2px 2px; display: grid; gap: 9px; overflow-y: auto; flex: 1; align-content: start }
  #noteList li { position: relative; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); padding: 11px 13px; padding-inline-end: 32px; animation: pop .26s both }
  #noteList p { margin: 0; font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word }
  #noteList img { display: block; max-height: 88px; border-radius: 8px; border: 1px solid var(--line); margin-top: 8px; cursor: zoom-in }
  #noteList small { display: block; margin-top: 6px; font-size: 9.5px; color: var(--muted) }
  #noteList .sent { color: var(--accent); font-weight: 700 }
  #noteList .del { position: absolute; top: 7px; inset-inline-end: 7px; border: 0; background: none; cursor: pointer; color: var(--muted); font-size: 13px; line-height: 1; padding: 4px; border-radius: 6px }
  #noteList .del:hover { color: var(--alert); background: var(--code) }
  .empty-note { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11.5px; color: var(--muted);
    text-align: center; border: 1px dashed var(--line); border-radius: 12px; padding: 20px 16px; margin-top: 14px }

  /* --- Toasts --- */
  #toasts { position: fixed; inset-inline: 0; top: 64px; z-index: 90; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; padding: 0 16px }
  .toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: min(92vw, 400px);
    background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 15px; font-size: 12.5px; font-weight: 600;
    box-shadow: var(--shadow); animation: toast-drop .32s cubic-bezier(.22,1,.36,1) both }
  .toast .ic { flex: none; display: grid; place-items: center; width: 23px; height: 23px; border-radius: 999px; background: var(--a100); color: var(--deep) }
  .toast.err .ic { background: #fdf1f0; color: var(--alert) }
  .toast b { color: var(--deep); font-weight: 800 }
  .toast.err b { color: var(--alert) }
  .toast.out { transition: opacity .25s, transform .25s; opacity: 0; transform: translateY(-8px) }
</style>
</head>
<body>
<div id="shell">
<div class="glow g1"></div>
<div class="glow g2"></div>
<div id="toasts" aria-live="polite"></div>

<header class="rise">
  <button class="brand" id="brandBtn" type="button" title="Pair">
    <img src="/pair-wordmark.svg" alt="Pair" />
    <span class="name">· ${esc(widget.channelName)}</span>
  </button>
  <div class="controls">
    <div class="menu" id="devMenu">
      <button class="menu-btn" id="devBtn" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="lead" id="devIcon"></span><span id="devLabel"></span><span class="caret"></span>
      </button>
      <div class="menu-pop" id="devPop" role="listbox"></div>
    </div>
    <span class="seg" role="group" aria-label="Widget language">
      <button id="wlEn" type="button">EN</button><button id="wlAr" type="button">عربي</button>
    </span>
    <span class="seg" role="group" aria-label="Widget theme">
      <button id="wtLight" type="button" aria-label="Light"></button><button id="wtDark" type="button" aria-label="Dark"></button>
    </span>
    <button class="iconbtn" id="notesBtn" type="button" aria-label="Notes"></button>
    <button class="who" id="whoBtn" type="button"><span class="av" id="whoAv"></span><span id="whoName"></span><i id="whoRole"></i></button>
  </div>
</header>

<main>
  <div id="stage"></div>
  <div class="stage-actions">
    <button class="btn" id="wOpen" type="button"><span class="i"></span><span id="runLabel"></span></button>
    <button id="wClose" type="button"><span class="i"></span><span data-i18n="close">Close</span></button>
  </div>
  <p class="powered"><span data-i18n="powered">Powered by</span> <img src="/pair-wordmark.svg" alt="Pair AI" /></p>
</main>
</div>

<!-- The tour: how this widget was made, one stop at a time -->
<div id="tour" class="overlay hidden" role="dialog" aria-modal="true" aria-label="How Pair works">
  <div class="card tour">
    <button class="x" id="tourX" type="button" aria-label="Close"></button>
    <div class="map" id="map">
      <div class="grid"></div>
      <svg viewBox="0 0 640 220" preserveAspectRatio="none" aria-hidden="true">
        <path id="route" class="route-bg" d="M 58 168 C 128 168 132 66 208 66 S 330 176 402 140 S 520 44 590 74" />
        <path id="routeFg" class="route-fg" d="M 58 168 C 128 168 132 66 208 66 S 330 176 402 140 S 520 44 590 74" />
        <path id="routeArrows" class="route-arrows" d="M 58 168 C 128 168 132 66 208 66 S 330 176 402 140 S 520 44 590 74" />
      </svg>
      <svg viewBox="0 0 640 220" preserveAspectRatio="none" aria-hidden="true" id="mapPins"></svg>
      <div id="caps"></div>
    </div>
    <div class="body-copy">
      <p class="step-no" id="tourNo">Stop 1 of 4</p>
      <h2 id="tourTitle"></h2>
      <p id="tourBody"></p>
    </div>
    <div class="nav-row">
      <button class="skip" id="tourSkip" type="button" data-i18n="t.skip">Skip</button>
      <span class="prog" id="tourProg"></span>
      <button class="btn" id="tourNext" type="button"><span id="tourNextLabel"></span><span class="i"></span></button>
    </div>
  </div>
</div>

<!-- Entry gate: who is testing? Kept in this browser so notes carry the tester's name. -->
<div id="gate" class="overlay hidden" role="dialog" aria-modal="true">
  <form id="gateForm" class="card gate-card">
    <img src="/pair-mark.svg" alt="Pair" />
    <h1 data-i18n="gate.title">Who's testing?</h1>
    <p data-i18n="gate.sub">Your notes on this design are saved with your name.</p>
    <div class="grid">
      <div><label for="tName" data-i18n="gate.name">Your name</label><input id="tName" class="field" maxlength="60" autocomplete="name" /></div>
      <div><label data-i18n="gate.role">Your role</label>
        <div class="roles" role="radiogroup" aria-label="Your role">
          <label><input type="radio" name="tRole" value="Designer" checked /><span data-i18n="role.designer">Designer</span></label>
          <label><input type="radio" name="tRole" value="Developer" /><span data-i18n="role.developer">Developer</span></label>
          <label><input type="radio" name="tRole" value="Product" /><span data-i18n="role.product">Product</span></label>
          <label><input type="radio" name="tRole" value="QA" /><span data-i18n="role.qa">QA</span></label>
        </div>
      </div>
      <button class="btn" type="submit" data-i18n="gate.start">Start →</button>
    </div>
  </form>
</div>

<div id="scrim"></div>
<aside id="drawer" aria-label="Test notes">
  <h3><span data-i18n="n.title">Test notes</span><button class="iconbtn" id="drawerX" type="button" aria-label="Close"></button></h3>
  <textarea id="noteText" class="field" maxlength="1000" data-i18n-ph="n.ph" placeholder="What's not working for you?"></textarea>
  <div class="attach-thumb" id="attachThumb"><img id="attachImg" alt="Attached screenshot" /><button type="button" id="attachRemove" aria-label="Remove screenshot">×</button></div>
  <div class="row">
    <button id="noteAttach" class="btn btn-ghost btn-sm" type="button"><span class="i"></span><span data-i18n="n.attach">Screenshot</span></button>
    <button id="noteAdd" class="btn btn-sm" type="button" data-i18n="n.save">Save note</button>
  </div>
  <input type="file" id="noteFile" accept="image/png,image/jpeg,image/webp" hidden />
  <ul id="noteList"></ul>
  <p class="empty-note" id="noteEmpty"><span class="i"></span><span data-i18n="n.empty">No notes yet.</span></p>
</aside>

<script>
  var WIDGET_ID = ${js(widget.widgetId)}
  var SDK_BASE = ${js(sdkBase)}
  var BE_BASE = ${js(beBase)}
  var SETTINGS = { position: ${js(position)}, type: ${js(type)}, launcherTitle: ${js(launcherTitle)} }
  var WLANG = ${js(wlang)}
  var WTHEME = ${js(wtheme)}
  var TESTER_KEY = 'pair.tester'
  var NOTES_KEY = 'pair.notes.' + WIDGET_ID
  var TOUR_KEY = 'pair.tour.v2'
  var SURFACE_KEY = 'pair.surface'

  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  function read(k) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } }
  var $ = function (id) { return document.getElementById(id) }
  function esc(s) { var d = document.createElement('span'); d.textContent = s; return d.innerHTML }

  /* --- Icons: one stroked set, so nothing on this page is an emoji --- */
  var ICONS = {
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18.5h2"/>',
    tablet: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
    desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    page: '<path d="M3 8h18"/><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="17" cy="15" r="3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/>',
    note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    inbox: '<path d="M3 12h5l2 3h4l2-3h5"/><path d="M5.5 5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z"/>',
  }
  function ic(name, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'
  }

  /* --- The page speaks English and Arabic, following the widget-language toggle --- */
  var I18N = {
    en: {
      'open': 'Open widget', 'run': 'Run the widget', 'close': 'Close', 'powered': 'Powered by',
      't.skip': 'Skip', 't.next': 'Next', 't.done': 'Try the widget',
      't1.cap': 'Design', 't1.t': 'It starts in the studio',
      't1.p': 'Brand colour, hero slides, quick links and prompts are picked in the Pair builder — no code, no deploy.',
      't2.cap': 'Preview', 't2.t': 'Every change, seen at once',
      't2.p': 'The builder renders the real widget as you type, in both languages and both themes, on any device.',
      't3.cap': 'Share', 't3.t': 'One link for the whole team',
      't3.p': 'This page is that link. Anyone can open it, switch language or theme, and leave a note on what they see.',
      't4.cap': 'Ship', 't4.t': 'The same design goes live',
      't4.p': 'The widget below loads through the real Pair SDK, reading the very design the studio serves to production.',
      'gate.title': "Who's testing?", 'gate.sub': 'Your notes on this design are saved with your name.',
      'gate.name': 'Your name', 'gate.role': 'Your role', 'gate.start': 'Start →',
      'role.designer': 'Designer', 'role.developer': 'Developer', 'role.product': 'Product', 'role.qa': 'QA',
      'n.title': 'Test notes', 'n.ph': "What's not working for you?", 'n.attach': 'Screenshot',
      'n.uploading': 'Uploading…', 'n.save': 'Save note', 'n.empty': 'No notes yet.',
      'n.sent': 'sent to studio', 'n.local': 'saved locally',
      'd.iphone': 'iPhone 15', 'd.se': 'iPhone SE', 'd.android': 'Android', 'd.tablet': 'iPad',
      'd.desktop': 'Desktop', 'd.page': 'On this page',
      'site.hint': 'A mock customer site — the launcher is live in the corner.',
      't.welcome': 'Welcome, <b>{n}</b> — happy testing!',
      't.nameReq': '<b>Your name</b> is required.',
      't.noteReq': 'Write the note first.',
      't.noteSent': 'Note sent to the <b>studio</b>. Thank you!',
      't.noteFail': 'Saved locally, but it did not reach the studio. <b>Check your connection.</b>',
      't.imgBig': 'Screenshot is over <b>3 MB</b>.', 't.imgOk': 'Screenshot attached.', 't.imgFail': 'Could not upload. <b>Try again.</b>',
    },
    ar: {
      'open': 'افتح الودجت', 'run': 'شغّل الودجت', 'close': 'إغلاق', 'powered': 'مدعوم بواسطة',
      't.skip': 'تخطّي', 't.next': 'التالي', 't.done': 'جرّب الودجت',
      't1.cap': 'التصميم', 't1.t': 'تبدأ الحكاية في الاستوديو',
      't1.p': 'لون العلامة وشرائح الهيرو والروابط السريعة والأسئلة كلها تُختار في بيلدر Pair — بلا كود وبلا نشر.',
      't2.cap': 'المعاينة', 't2.t': 'كل تعديل تراه في لحظته',
      't2.p': 'البيلدر يرسم الودجت الحقيقي وأنت تكتب، باللغتين والثيمين وعلى أي جهاز.',
      't3.cap': 'المشاركة', 't3.t': 'رابط واحد للفريق كله',
      't3.p': 'هذه الصفحة هي ذلك الرابط. أي شخص يفتحها، يبدّل اللغة أو الثيم، ويترك ملاحظة على ما يراه.',
      't4.cap': 'الإطلاق', 't4.t': 'نفس التصميم يصل للزائر',
      't4.p': 'الودجت بالأسفل يعمل عبر SDK الحقيقي من Pair، ويقرأ نفس التصميم الذي يقدّمه الاستوديو للإنتاج.',
      'gate.title': 'من يجرّب؟', 'gate.sub': 'ملاحظاتك على هذا التصميم تُحفظ باسمك.',
      'gate.name': 'اسمك', 'gate.role': 'دورك', 'gate.start': 'ابدأ ←',
      'role.designer': 'مصمم', 'role.developer': 'مطوّر', 'role.product': 'منتج', 'role.qa': 'جودة',
      'n.title': 'ملاحظات التجربة', 'n.ph': 'ما الذي لا يعجبك؟', 'n.attach': 'لقطة شاشة',
      'n.uploading': 'جارٍ الرفع…', 'n.save': 'حفظ', 'n.empty': 'لا توجد ملاحظات بعد.',
      'n.sent': 'أُرسلت للاستوديو', 'n.local': 'محفوظة محليًا',
      'd.iphone': 'آيفون 15', 'd.se': 'آيفون SE', 'd.android': 'أندرويد', 'd.tablet': 'آيباد',
      'd.desktop': 'سطح المكتب', 'd.page': 'داخل الصفحة',
      'site.hint': 'موقع عميل تجريبي — المُشغّل يعمل في الركن.',
      't.welcome': 'أهلًا <b>{n}</b> — تجربة سعيدة!',
      't.nameReq': '<b>اسمك</b> مطلوب.',
      't.noteReq': 'اكتب الملاحظة أولًا.',
      't.noteSent': 'وصلت الملاحظة إلى <b>الاستوديو</b>. شكرًا لك!',
      't.noteFail': 'حُفظت محليًا لكنها لم تصل إلى الاستوديو. <b>تحقق من الاتصال.</b>',
      't.imgBig': 'اللقطة أكبر من <b>3 ميجابايت</b>.', 't.imgOk': 'تم إرفاق اللقطة.', 't.imgFail': 'تعذّر الرفع. <b>حاول مرة أخرى.</b>',
    },
  }
  var lang = WLANG || read('pair.lang') || ((navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en')
  function tr(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k }

  /* --- Static icon slots --- */
  $('wtLight').innerHTML = ic('sun', 14)
  $('wtDark').innerHTML = ic('moon', 14)
  $('notesBtn').innerHTML = ic('note', 16)
  $('drawerX').innerHTML = ic('close', 15)
  $('tourX').innerHTML = ic('close', 16)
  $('wOpen').querySelector('.i').innerHTML = ic('play', 13)
  $('wClose').querySelector('.i').innerHTML = ic('stop', 13)
  $('noteAttach').querySelector('.i').innerHTML = ic('image', 14)
  $('noteEmpty').querySelector('.i').innerHTML = ic('inbox', 22)
  $('tourNext').querySelector('.i').innerHTML = ic('arrow', 14)

  function applyLang() {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = tr(el.getAttribute('data-i18n')) })
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = tr(el.getAttribute('data-i18n-ph')) })
    renderSurfaceOptions()
    try { syncRunLabel() } catch (e) {}
    try { renderNotes() } catch (e) {}
    try { paintTour() } catch (e) {}
  }

  /* --- Toasts --- */
  function toast(msg, kind) {
    var el = document.createElement('div')
    el.className = 'toast' + (kind === 'err' ? ' err' : '')
    el.innerHTML = '<span class="ic">' + ic(kind === 'err' ? 'close' : 'check', 13) + '</span><span>' + msg + '</span>'
    $('toasts').appendChild(el)
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove() }, 280) }, 3400)
  }

  /* --- Language / theme: rebuild the URL so the config is re-served --- */
  function reload(patch) {
    var q = new URLSearchParams({ position: SETTINGS.position, type: SETTINGS.type, launcherTitle: SETTINGS.launcherTitle })
    var wl = 'wlang' in patch ? patch.wlang : WLANG
    var wt = 'wtheme' in patch ? patch.wtheme : WTHEME
    if (wl) q.set('wlang', wl)
    if (wt) q.set('wtheme', wt)
    location.search = q.toString()
  }
  $('wlEn').classList.toggle('on', (WLANG || lang) === 'en')
  $('wlAr').classList.toggle('on', (WLANG || lang) === 'ar')
  $('wlEn').addEventListener('click', function () { store('pair.lang', 'en'); reload({ wlang: 'en' }) })
  $('wlAr').addEventListener('click', function () { store('pair.lang', 'ar'); reload({ wlang: 'ar' }) })
  $('wtLight').classList.toggle('on', WTHEME === 'light')
  $('wtDark').classList.toggle('on', WTHEME === 'dark')
  // Clicking the active theme again returns to the design's own theme.
  $('wtLight').addEventListener('click', function () { reload({ wtheme: WTHEME === 'light' ? '' : 'light' }) })
  $('wtDark').addEventListener('click', function () { reload({ wtheme: WTHEME === 'dark' ? '' : 'dark' }) })
  if (WTHEME) document.documentElement.setAttribute('data-wt', WTHEME)

  /* --- Surfaces: five device frames, plus the widget running on this page --- */
  var SURFACES = [
    { id: 'page', icon: 'page' },
    { id: 'iphone', icon: 'phone', vw: 390, vh: 844, cls: 'iphone', cut: 'island', inset: 46, pad: 18 },
    { id: 'se', icon: 'phone', vw: 375, vh: 667, cls: 'se', cut: null, inset: 0, pad: 16 },
    { id: 'android', icon: 'phone', vw: 412, vh: 915, cls: 'android', cut: 'hole', inset: 38, pad: 14 },
    { id: 'tablet', icon: 'tablet', vw: 820, vh: 1180, cls: 'tablet', cut: null, inset: 0, pad: 22 },
    { id: 'desktop', icon: 'desktop', vw: 1180, vh: 740, cls: 'desktop', cut: null, inset: 0, pad: 0, chrome: 38 },
  ]
  function surfaceOf(id) {
    for (var i = 0; i < SURFACES.length; i++) if (SURFACES[i].id === id) return SURFACES[i]
    return SURFACES[1]
  }
  // The surface lives in the URL: page mode is rendered by the server (the SDK
  // snippet is in the document, as on a real site), so switching into or out of
  // it reloads. A phone frame is the wrong default on a phone.
  var PAGE_MODE = ${js(pageMode ? '1' : '')} === '1'
  var urlSurface = new URLSearchParams(location.search).get('surface')
  var surfaceId = urlSurface || read(SURFACE_KEY) || (window.innerWidth < 760 ? 'page' : 'iphone')
  var surface = surfaceOf(surfaceId)
  surfaceId = surface.id
  if (surfaceId === 'page' && !PAGE_MODE) { setSurface('page'); }

  function setSurface(id) {
    store(SURFACE_KEY, id)
    var wasPage = PAGE_MODE
    if (id === 'page' || wasPage) {
      var q = new URLSearchParams(location.search)
      if (id === 'page') q.set('surface', 'page'); else q.delete('surface')
      location.search = q.toString()
      return
    }
    surfaceId = id
    surface = surfaceOf(id)
    renderSurfaceOptions()
    renderStage()
  }

  function renderSurfaceOptions() {
    $('devIcon').innerHTML = ic(surface.icon, 14)
    $('devLabel').textContent = tr('d.' + surfaceId)
    var pop = $('devPop')
    pop.innerHTML = ''
    SURFACES.forEach(function (s, i) {
      if (i === 1) { var sep = document.createElement('div'); sep.className = 'sep'; pop.appendChild(sep) }
      var b = document.createElement('button')
      b.type = 'button'
      b.setAttribute('role', 'option')
      b.setAttribute('aria-selected', s.id === surfaceId ? 'true' : 'false')
      b.innerHTML = '<span class="lead">' + ic(s.icon, 15) + '</span><span>' + esc(tr('d.' + s.id)) + '</span>' +
        '<span class="tick">' + ic('check', 13) + '</span>'
      b.addEventListener('click', function () { closeMenu(); setSurface(s.id) })
      pop.appendChild(b)
    })
  }
  function closeMenu() { $('devMenu').classList.remove('open'); $('devBtn').setAttribute('aria-expanded', 'false') }
  $('devBtn').addEventListener('click', function (e) {
    e.stopPropagation()
    var open = $('devMenu').classList.toggle('open')
    $('devBtn').setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) placeMenu()
  })
  /** Pins the popup under its button in viewport coordinates, clamped to the screen. */
  function placeMenu() {
    var r = $('devBtn').getBoundingClientRect()
    var pop = $('devPop')
    pop.style.top = Math.round(r.bottom + 6) + 'px'
    pop.style.insetInlineStart = ''
    pop.style.left = ''
    pop.style.right = ''
    var w = pop.offsetWidth || 190
    var left = document.documentElement.dir === 'rtl' ? r.right - w : r.left
    pop.style.left = Math.round(Math.max(8, Math.min(left, window.innerWidth - w - 8))) + 'px'
  }
  window.addEventListener('resize', function () { if ($('devMenu').classList.contains('open')) placeMenu() })
  document.addEventListener('click', closeMenu)

  function frameSrc(s) {
    var q = new URLSearchParams({ position: SETTINGS.position, type: SETTINGS.type, launcherTitle: SETTINGS.launcherTitle, frame: '1' })
    if (s.inset) q.set('inset', String(s.inset))
    if (WLANG) q.set('wlang', WLANG)
    if (WTHEME) q.set('wtheme', WTHEME)
    return location.pathname + '?' + q.toString()
  }

  var frameEl = null

  function renderStage() {
    var host = $('stage')
    host.innerHTML = ''
    frameEl = null

    if (surfaceId === 'page') {
      var site = document.createElement('div')
      site.className = 'site'
      site.innerHTML =
        '<div class="bar"><span class="sq"></span><span class="ln" style="width:120px"></span>' +
        '<span class="nav"><span class="ln"></span><span class="ln"></span><span class="ln"></span></span></div>' +
        '<div class="banner"></div><div class="grid"><div></div><div></div><div></div></div>' +
        '<p class="hint">' + esc(tr('site.hint')) + '</p>'
      host.appendChild(site)
      return
    }

    var s = surface
    var shell = document.createElement('div')
    shell.className = s.cls === 'desktop' ? 'browser' : 'phone ' + s.cls
    if (s.cls === 'desktop') {
      var chrome = document.createElement('div')
      chrome.className = 'chrome'
      chrome.innerHTML = '<i></i><i></i><i></i><em>customer-site.com</em>'
      shell.appendChild(chrome)
    }
    if (s.cut) { var cut = document.createElement('span'); cut.className = s.cut; shell.appendChild(cut) }
    var screen = document.createElement('div')
    screen.className = 'screen'
    frameEl = document.createElement('iframe')
    frameEl.title = tr('d.' + s.id)
    frameEl.src = frameSrc(s)
    screen.appendChild(frameEl)
    shell.appendChild(screen)
    host.appendChild(shell)
    fitStage()
    setTimeout(fitStage, 260)
  }

  /** The frame renders at the device's real viewport and is scaled to the shell. */
  function fitStage() {
    if (!frameEl) return
    var s = surface
    var shell = $('stage').firstElementChild
    if (!shell) return
    var availH = Math.max(260, $('stage').clientHeight)
    var availW = Math.min($('stage').clientWidth, s.cls === 'desktop' ? 1120 : 560)
    var chrome = s.chrome || 0
    var pad = s.pad || 0
    var h = availH
    var w = Math.round((h - chrome - pad) * s.vw / s.vh) + pad
    if (w > availW) { w = availW; h = Math.round((w - pad) * s.vh / s.vw) + chrome + pad }
    shell.style.width = w + 'px'
    shell.style.height = h + 'px'
    var screen = shell.querySelector('.screen')
    var scale = screen.clientWidth / s.vw
    frameEl.style.width = s.vw + 'px'
    frameEl.style.height = Math.round(screen.clientHeight / scale) + 'px'
    frameEl.style.transform = 'scale(' + scale + ')'
  }
  var fitTimer = null
  window.addEventListener('resize', function () { clearTimeout(fitTimer); fitTimer = setTimeout(fitStage, 80) })

  function sdk() {
    if (surfaceId === 'page') return window.PairAiWidgetSDK || null
    try { return frameEl && frameEl.contentWindow && frameEl.contentWindow.PairAiWidgetSDK || null } catch (e) { return null }
  }
  function syncRunLabel() { $('runLabel').textContent = tr(surfaceId === 'page' ? 'run' : 'open') }
  $('wOpen').addEventListener('click', function () { var s = sdk(); if (s) s.show() })
  $('wClose').addEventListener('click', function () { var s = sdk(); if (s) s.hide() })

  /* --- The tour: a marker walks the route, a stop lights up at each stage --- */
  var STOPS = [
    { k: 't1', at: 0.00 }, { k: 't2', at: 0.33 }, { k: 't3', at: 0.66 }, { k: 't4', at: 1.00 },
  ]
  var step = 0, tourTimer = null, routeLen = 0

  function buildMap() {
    var route = $('route')
    routeLen = route.getTotalLength()
    $('routeFg').style.strokeDasharray = routeLen
    $('routeArrows').style.strokeDasharray = '0 14'
    var pins = $('mapPins')
    var caps = $('caps')
    pins.innerHTML = ''
    caps.innerHTML = ''
    var NS = 'http://www.w3.org/2000/svg'
    STOPS.forEach(function (s, i) {
      var p = route.getPointAtLength(routeLen * s.at)
      s.x = p.x; s.y = p.y
      var g = document.createElementNS(NS, 'g')
      g.setAttribute('class', 'stop')
      g.setAttribute('tabindex', '0')
      g.setAttribute('role', 'button')
      g.innerHTML =
        '<circle class="halo" cx="' + p.x + '" cy="' + p.y + '" r="13"/>' +
        '<circle class="ring" cx="' + p.x + '" cy="' + p.y + '" r="13"/>' +
        '<text class="num" x="' + p.x + '" y="' + p.y + '">' + (i + 1) + '</text>'
      g.addEventListener('click', function () { go(i); arm() })
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); arm() } })
      pins.appendChild(g)
      var cap = document.createElement('span')
      cap.className = 'cap'
      cap.style.left = (s.at * 100) + '%'
      cap.style.top = ((p.y / 220) * 100) - 11 + '%'
      caps.appendChild(cap)
      s.capEl = cap
    })
    var marker = document.createElementNS(NS, 'g')
    marker.setAttribute('class', 'marker')
    marker.innerHTML = '<circle class="body" cx="0" cy="0" r="6.5"/>'
    pins.appendChild(marker)
    STOPS.marker = marker
  }

  function paintTour() {
    if (!routeLen) return
    var s = STOPS[step]
    $('tourNo').textContent = (lang === 'ar' ? 'محطة ' + (step + 1) + ' من ' + STOPS.length : 'Stop ' + (step + 1) + ' of ' + STOPS.length)
    $('tourTitle').textContent = tr(s.k + '.t')
    $('tourBody').textContent = tr(s.k + '.p')
    $('tourNextLabel').textContent = step === STOPS.length - 1 ? tr('t.done') : tr('t.next')
    $('routeFg').style.strokeDashoffset = routeLen * (1 - s.at)
    STOPS.marker.setAttribute('transform', 'translate(' + s.x + ',' + s.y + ')')
    document.querySelectorAll('#mapPins .stop').forEach(function (g, i) {
      g.classList.toggle('on', i === step)
      g.classList.toggle('done', i < step)
    })
    STOPS.forEach(function (st, i) {
      st.capEl.textContent = tr(st.k + '.cap')
      st.capEl.classList.toggle('show', i <= step)
    })
    var prog = $('tourProg')
    prog.innerHTML = ''
    STOPS.forEach(function (_, i) {
      var b = document.createElement('button')
      b.type = 'button'
      b.setAttribute('aria-label', String(i + 1))
      if (i === step) b.className = 'on'
      b.addEventListener('click', function () { go(i); arm() })
      prog.appendChild(b)
    })
  }
  function go(i) { step = i; paintTour() }
  function arm() { clearInterval(tourTimer); tourTimer = setInterval(function () { go((step + 1) % STOPS.length) }, 4400) }
  function openTour() {
    $('tour').classList.remove('hidden')
    if (!routeLen) buildMap()
    go(0); arm()
  }
  function closeTour() {
    $('tour').classList.add('hidden')
    clearInterval(tourTimer)
    store(TOUR_KEY, 1)
    if (!(read(TESTER_KEY) || {}).name) showGate(null)
  }
  $('tourX').addEventListener('click', closeTour)
  $('tourSkip').addEventListener('click', closeTour)
  $('tourNext').addEventListener('click', function () {
    if (step === STOPS.length - 1) { closeTour(); return }
    go(step + 1); arm()
  })
  $('brandBtn').addEventListener('click', openTour)

  /* --- Gate --- */
  function syncWho(t) {
    $('whoName').textContent = t.name
    $('whoRole').textContent = t.role || ''
    $('whoAv').textContent = (t.name || '?').trim().charAt(0).toUpperCase()
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
      e.target.classList.remove('shake'); void e.target.offsetWidth; e.target.classList.add('shake')
      toast(tr('t.nameReq'), 'err'); $('tName').focus(); return
    }
    var role = (document.querySelector('input[name="tRole"]:checked') || {}).value || 'Other'
    var tester = { name: name.slice(0, 60), role: role }
    store(TESTER_KEY, tester)
    syncWho(tester)
    $('gate').classList.add('hidden')
    toast(tr('t.welcome').replace('{n}', esc(tester.name)))
  })
  $('whoBtn').addEventListener('click', function () { showGate(read(TESTER_KEY)) })

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return
    if (!$('tour').classList.contains('hidden')) closeTour()
    else if ($('drawer').classList.contains('open')) closeDrawer()
  })

  /* --- Notes drawer --- */
  function openDrawer() { $('drawer').classList.add('open'); $('scrim').classList.add('on') }
  function closeDrawer() { $('drawer').classList.remove('open'); $('scrim').classList.remove('on') }
  $('notesBtn').addEventListener('click', function () { $('drawer').classList.contains('open') ? closeDrawer() : openDrawer() })
  $('drawerX').addEventListener('click', closeDrawer)
  $('scrim').addEventListener('click', closeDrawer)

  var pendingImage = null
  $('noteAttach').addEventListener('click', function () { $('noteFile').click() })
  $('attachRemove').addEventListener('click', function () { pendingImage = null; $('attachThumb').classList.remove('on') })
  $('noteFile').addEventListener('change', function () {
    var f = this.files && this.files[0]
    this.value = ''
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { toast(tr('t.imgBig'), 'err'); return }
    var btn = $('noteAttach')
    var label = btn.querySelector('span:last-child')
    btn.disabled = true; label.textContent = tr('n.uploading')
    fetch(location.pathname.replace(/\\/embed$/, '/feedback/upload'), { method: 'POST', headers: { 'content-type': f.type }, body: f })
      .then(function (r) { if (!r.ok) throw new Error('upload failed'); return r.json() })
      .then(function (r) { pendingImage = r.url; $('attachImg').src = r.url; $('attachThumb').classList.add('on'); toast(tr('t.imgOk')) })
      .catch(function () { toast(tr('t.imgFail'), 'err') })
      .finally(function () { btn.disabled = false; label.textContent = tr('n.attach') })
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
    $('noteEmpty').style.display = list.length ? 'none' : 'flex'
    var badge = $('notesBtn').querySelector('.dot')
    if (list.length) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'dot'; $('notesBtn').appendChild(badge) }
      badge.textContent = list.length > 9 ? '9+' : String(list.length)
    } else if (badge) badge.remove()

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
      del.className = 'del'; del.type = 'button'; del.innerHTML = ic('close', 12); del.setAttribute('aria-label', 'Delete note')
      del.addEventListener('click', function () { var next = notes(); next.splice(i, 1); store(NOTES_KEY, next); renderNotes() })
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

  /* --- Boot: tour once → gate once → the widget --- */
  var tester = read(TESTER_KEY)
  syncWho(tester && tester.name ? tester : { name: '—', role: '' })
  applyLang()
  renderStage()
  renderNotes()
  if (!read(TOUR_KEY)) openTour()
  else if (!(tester && tester.name)) showGate(null)
</script>
<style>${poweredCss}</style>
${pageMode ? sdkSnippet : ''}
</body>
</html>`)
  }),
)
