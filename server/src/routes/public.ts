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
  normalizeChatInput, normalizeConsent, normalizeCsat, normalizeLauncher, normalizePreChat,
  normalizeQuickLinks,
  resolve as resolveColor,
  normalizeLoading, normalizePrompts, normalizeToast, placeholderCss, sendCss, toastCss,
} from '../lib/inputDesign.js'
import { heroImageDataUri, renderHeroSvg, type HeroSvgSlide } from '../lib/heroSvg.js'
import { isDrawableSendIcon, sendGlyphDataUri } from '../lib/sendGlyph.js'
import { applyWidgetLanguage, type WidgetLang as WidgetLangName } from '../lib/widgetLang.js'
import { applyWidgetTheme, isWidgetTheme } from '../lib/widgetTheme.js'
import { sdkBaseUrl } from '../lib/sdkBase.js'
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
 * Merges a compiled design over the styles already in a config.
 *
 * The old blocks carry shorthands (`border`, `background`) while the compiled
 * design writes longhands (`borderColor`, `backgroundColor`). Both would end up
 * in the same style object, and which one wins then depends on key order —
 * so the shorthand a design has superseded is dropped outright.
 */
function mergeStyles(existing: Record<string, any> | undefined, compiled: Record<string, any>): Record<string, any> {
  const out = { ...(existing ?? {}), ...compiled }
  if ('borderColor' in compiled || 'borderWidth' in compiled || 'borderStyle' in compiled) delete out.border
  if ('background' in compiled) delete out.backgroundColor
  if ('backgroundColor' in compiled) delete out.background
  if ('padding' in compiled) {
    delete out.paddingTop
    delete out.paddingRight
    delete out.paddingBottom
    delete out.paddingLeft
  }
  return out
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
  const hasPreChat = !!c?.widget_v2_config?.pre_chat_form
  const hasConsent = !!c?.widget_v2_config?.consent_screen
  const hasCsat = !!c?.widget_v2_config?.csat
  if (!hasInput && !hasLauncher && !hasLoading && !hasToast && !hasSendIcon && !hasPrompts && !hasCards && !hasPreChat && !hasConsent && !hasCsat) {
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
    ci.styles = mergeStyles(ci.styles, inputCss(design, brand))
    ci.placeholderText = {
      ...(ci.placeholderText ?? {}),
      styles: mergeStyles(ci.placeholderText?.styles, placeholderCss(design, brand)),
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
      styles: mergeStyles(ci.sendButtonIcon?.styles, sendCss(design, brand)),
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
    ls.styles = mergeStyles(ls.styles, loadingCss(design, brand))
    ls.design = design
  }

  if (hasCards) {
    const design = normalizeQuickLinks(next.widget_v2_config.quick_links.design)
    const ql = next.widget_v2_config.quick_links
    ql.cardStyle = mergeStyles(ql.cardStyle, cardCss(design, brand))
    ql.textStyle = mergeStyles(ql.textStyle, cardTextCss(design, brand))
    ql.subtitleStyle = mergeStyles(ql.subtitleStyle, cardSubtitleCss(design, brand))
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
    tp.chipStyle = mergeStyles(tp.chipStyle, chip)
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
        // The builder previews this heading in caps with wide tracking, so the
        // served style says so too rather than leaving it to the widget's css.
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
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

  if (hasPreChat) {
    // The studio's pre-chat page edits this block; it lands on the top-level
    // fields the widget already reads, so an untouched section changes nothing.
    const pcf = next.widget_v2_config.pre_chat_form
    if (typeof pcf.enabled === 'boolean') next.pre_chat_form_enabled = pcf.enabled
    const opts = { ...(next.pre_chat_form_options ?? {}) }
    if (typeof pcf.message === 'string') opts.pre_chat_message = pcf.message
    if (Array.isArray(pcf.fields) && pcf.fields.length) {
      opts.pre_chat_fields = pcf.fields.map((f: any, i: number) => ({
        name: String(f?.name ?? ''),
        type: String(f?.type ?? 'text'),
        label: String(f?.label ?? f?.name ?? ''),
        placeholder: typeof f?.placeholder === 'string' ? f.placeholder : '',
        required: !!f?.required,
        enabled: f?.enabled !== false,
        order: Number.isFinite(f?.order) ? f.order : i + 1,
        field_type: String(f?.field_type ?? 'standard'),
      }))
    }
    const design = normalizePreChat(pcf.design)
    // Untyped defaults follow the config's language: an Arabic widget never
    // says "Start Chat" just because nothing was customised.
    if (/^ar/i.test(one(next.locale) ?? '')) {
      if (design.buttonText === 'Start Chat') design.buttonText = 'ابدأ المحادثة'
      if (design.messageLabel === 'Message') design.messageLabel = 'الرسالة'
      if (design.messagePlaceholder === 'Type your message here...') design.messagePlaceholder = 'اكتب رسالتك هنا...'
    }
    opts.design = design
    next.pre_chat_form_options = opts
    pcf.design = design
  }

  if (hasConsent) {
    // The welcome / consent gate: texts as typed, the design normalized.
    const cs = next.widget_v2_config.consent_screen
    cs.enabled = cs.enabled === true
    cs.points = (Array.isArray(cs.points) ? cs.points : [])
      .map((p: any) => ({ icon: String(p?.icon ?? 'info'), text: String(p?.text ?? '') }))
      .filter((p: any) => p.text.trim() !== '')
    // The privacy / terms links under the footnote. Only http(s) leaves the
    // server — these become real anchors on a customer's site.
    const safeUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : '')
    const link = (raw: any, label: string) => ({
      show: raw?.show !== false,
      label: typeof raw?.label === 'string' && raw.label.trim() ? raw.label : label,
      url: safeUrl(raw?.url),
    })
    const arC = /^ar/i.test(one(next.locale) ?? '')
    cs.links = {
      color: typeof cs.links?.color === 'string' ? cs.links.color : '#brand',
      underline: cs.links?.underline !== false,
      terms: link(cs.links?.terms, arC ? 'شروط الاستخدام' : 'Terms of Use'),
      privacy: link(cs.links?.privacy, arC ? 'سياسة الخصوصية' : 'Privacy Policy'),
    }
    // Untyped consent copy also follows the language.
    if (!one(cs.title)) cs.title = arC ? 'أهلاً بك في مساعدك الذكي' : 'Welcome to your AI Assistant'
    if (!one(cs.subtitle)) cs.subtitle = arC ? 'أشياء بسيطة خليك واخد بالك منها' : 'A few things to keep in mind'
    if (!one(cs.buttonText)) cs.buttonText = arC ? 'موافق ومتابعة' : 'Agree & Continue'
    cs.design = normalizeConsent(cs.design)
  }

  if (hasCsat) {
    // The rating survey shown when a session is resolved: texts as typed
    // (empty means "use what the survey message carries"), design normalized.
    const cz = next.widget_v2_config.csat
    cz.design = normalizeCsat(cz.design)
  }

  if (hasLauncher) {
    const design = normalizeLauncher(next.launcher_design)
    next.launcher_styles = mergeStyles(next.launcher_styles, launcherCss(design, brand))
    next.launcher_style = design.type
    next.launcher_position = design.position
    if (design.label.text.trim()) next.launcher_title = design.label.text
    // No launcher at all: the panel opens by itself, and there is nothing to
    // close it back into.
    if (design.type === 'none') next.opening_method = 'automatically_open'
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
  // list, for a build that does not read `heroImages`. Sized by aspect ratio,
  // not a fixed height: a fixed 220px cover-cropped the slide's own text away
  // on narrow phones, while a ratio scales the drawing whole — the same 16:9
  // the builder previews.
  hs.heroImage = {
    styles: { width: '100%', aspectRatio: '16 / 9', height: 'auto', objectFit: 'cover', borderRadius: '20px' },
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
const LAUNCHER_TYPES = new Set(['standard', 'expanded_bubble', 'chat_icon', 'icon_only', 'none'])

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
    // The saved panel size rides in the snippet, exactly as the embed panel
    // writes it for a customer, so this page opens the panel at the design's size.
    const savedPanel = normalizeLauncher(lc.launcher_design).panel
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
    const sdkBase = sdkBaseUrl()
    // A relative base is this origin, which 'self' already covers.
    const localSdk = sdkBase.startsWith('/')
    const sdkOrigin = localSdk ? '' : new URL(sdkBase).origin
    // A path, not an absolute URL: this server sits behind a proxy that rewrites
    // the Host header, so an origin derived from the request would point the
    // visitor's browser at the proxy's target — `localhost` — instead of here.
    // The page resolves it against its own origin at runtime.
    const bePath = ''
    // View overrides: the config is served already translated and/or re-themed.
    const wlang = one(req.query.wlang) === 'ar' ? 'ar' : one(req.query.wlang) === 'en' ? 'en' : ''
    const wtheme = one(req.query.wtheme) === 'dark' ? 'dark' : one(req.query.wtheme) === 'light' ? 'light' : ''
    const beBase = wlang || wtheme ? `/pv/${wlang || 'x'}/${wtheme || 'x'}` : bePath

    // The page wears the widget's own brand: its colour drives every accent on
    // the page, and its welcome copy becomes the headline — translated along
    // with the page when a language is forced.
    const lcv = applyWidgetLanguage(liveConfig, (wlang || 'en') as WidgetLangName) as Record<string, any>
    const brand = one(lcv.widget_color) ?? '#4d98e2'
    const avatarUrl = one(lcv.avatar_url) ?? ''
    const brandInitial = (widget.channelName || 'A').trim().charAt(0).toUpperCase()
    const heroTitle =
      one(lcv.widget_v2_config?.intro_screen?.welcomeTitle?.text) ??
      one(lcv.welcome_title) ??
      one(lcv.widget_v2_config?.header?.content?.title) ??
      widget.channelName
    const heroSub = one(lcv.widget_v2_config?.intro_screen?.welcomeSubtitle?.text) ?? one(lcv.welcome_tagline) ?? ''

    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' ${sdkOrigin}`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${sdkOrigin}`,
        `font-src 'self' https://fonts.gstatic.com data: ${sdkOrigin}`,
        'img-src * data: blob:',
        'media-src * data: blob:',
        `connect-src 'self' ${sdkOrigin} https://system.trypair.ai ${localSdk ? '' : `wss://${new URL(sdkBase).host}`}`,
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
    // The widget draws its own "Powered by PAIR" footer, so the page adds
    // nothing on top of it — it used to overlay a second copy.
    const poweredCss = `
  #pair-ai-widget-holder { overflow: hidden !important }`


    /** The stock Pair embed snippet — what a customer pastes into their own site. */
    const sdkSnippet = `
<script>
  window.PairAiWidgetSettings = { position: ${js(position)}, type: ${js(type)}, launcherTitle: ${js(launcherTitle)}, panel: ${JSON.stringify(savedPanel)}, beBaseUrl: location.origin + ${js(beBase)} }
  ;(function (d, t) {
    var BASE_URL = ${localSdk ? `location.origin + ${js(sdkBase)}` : js(sdkBase)}
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
  :root { color-scheme: light;
    /* Pair is the page's identity; the tested widget's brand colours the stage. */
    --pair: #4d98e2;
    --brand: ${brand};
    --accent: var(--pair);
    --deep: color-mix(in srgb, var(--pair) 74%, #16181c);
    --ink: #101216; --muted: #5a5f66; --alert: #b4372f;
    --line: color-mix(in srgb, var(--pair) 9%, #e0e3e8);
    --page: color-mix(in srgb, var(--pair) 4%, #f8f8fa);
    --code: color-mix(in srgb, var(--pair) 5%, #f1f2f5);
    --a50: color-mix(in srgb, var(--pair) 6%, #ffffff);
    --a100: color-mix(in srgb, var(--pair) 13%, #ffffff);
    --a200: color-mix(in srgb, var(--pair) 26%, #ffffff);
    --card: rgba(255,255,255,.92); --surface: #fff;
    --shadow: 0 1px 2px rgba(15,18,22,.04), 0 18px 44px -28px color-mix(in srgb, var(--pair) 40%, rgba(15,18,22,.35)) }
  html[data-wt="dark"] { color-scheme: dark; --ink: #f2f5f8; --muted: #9aa5b1;
    --line: color-mix(in srgb, var(--pair) 11%, #23272e);
    --page: color-mix(in srgb, var(--pair) 6%, #0c0f12);
    --code: color-mix(in srgb, var(--pair) 7%, #14171c);
    --card: rgba(20,23,29,.92); --surface: #14171c;
    --a50: color-mix(in srgb, var(--pair) 11%, #14171c);
    --a100: color-mix(in srgb, var(--pair) 19%, #171b21);
    --a200: color-mix(in srgb, var(--pair) 34%, #1b2027);
    --deep: color-mix(in srgb, var(--pair) 72%, #f2f5f8) }
  * { box-sizing: border-box }
  body { margin: 0; min-height: 100dvh; overflow-x: hidden; overflow-y: auto;
    font-family: Montserrat, system-ui, sans-serif; color: var(--ink); background: var(--page) }
  /* The SDK appends its launcher and panel straight to <body> in page mode; the
     app lives in its own flex shell so those nodes never become layout siblings. */
  #shell { min-height: 100dvh; display: flex; flex-direction: column }
  main { min-height: calc(100dvh - 52px) }
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
  .g1 { top: -24%; inset-inline-end: -18%; width: 54vw; height: 54vw;
    background: radial-gradient(circle, color-mix(in srgb, var(--pair) 20%, transparent) 0%, color-mix(in srgb, var(--pair) 7%, transparent) 46%, transparent 78%) }
  .g2 { bottom: -28%; inset-inline-start: -14%; width: 50vw; height: 50vw;
    background: radial-gradient(circle, color-mix(in srgb, var(--brand) 16%, transparent) 0%, color-mix(in srgb, var(--brand) 6%, transparent) 42%, transparent 76%); animation-delay: -9s }
  html[data-wt="dark"] .glow { opacity: .3 }
  /* A faint dot lattice gives the empty canvas a material feel. */
  #shell::before { content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--ink) 8%, transparent) 1px, transparent 1.4px);
    background-size: 24px 24px;
    mask-image: radial-gradient(75% 75% at 50% 42%, #000 30%, transparent 100%) }

  button, input, select, textarea { font: inherit; color: inherit }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; cursor: pointer;
    border-radius: 10px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 700; padding: 10px 18px;
    transition: background .2s, transform .15s, box-shadow .2s; box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--pair) 66%, transparent) }
  .btn:hover { background: var(--deep) }
  .btn:active { transform: scale(.98) }
  .btn-ghost { background: var(--surface); color: var(--muted); border: 1px solid var(--line); box-shadow: none }
  .btn-ghost:hover { background: var(--surface); color: var(--deep); border-color: var(--accent) }
  .btn-sm { font-size: 11.5px; padding: 7px 12px; border-radius: 8px }
  .field { border: 1px solid var(--line); border-radius: 9px; background: var(--surface); padding: 8px 12px;
    font-size: 13px; transition: border-color .2s, box-shadow .2s }
  .field:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pair) 18%, transparent) }
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
  .menu.open .menu-btn { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pair) 16%, transparent) }
  .menu.open .caret { transform: rotate(180deg) }
  .menu-pop { position: absolute; top: calc(100% + 6px); inset-inline-start: 0; z-index: 60; min-width: 200px; max-height: min(58dvh, 460px); overflow-y: auto; padding: 6px;
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
      radial-gradient(60% 80% at 20% 15%, color-mix(in srgb, var(--pair) 12%, transparent), transparent 70%),
      radial-gradient(50% 70% at 85% 80%, color-mix(in srgb, var(--pair) 10%, transparent), transparent 70%),
      linear-gradient(160deg, var(--a50) 0%, var(--a100) 100%) }
  html[data-wt="dark"] .map { background: linear-gradient(160deg, #141a21 0%, #101519 100%) }
  .map .grid { position: absolute; inset: 0; opacity: .5;
    background-image: linear-gradient(color-mix(in srgb, var(--pair) 12%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--pair) 12%, transparent) 1px, transparent 1px);
    background-size: 26px 26px; mask-image: radial-gradient(circle at 50% 50%, #000 40%, transparent 92%) }
  .map svg { position: absolute; inset: 0; width: 100%; height: 100% }
  .route-bg { fill: none; stroke: color-mix(in srgb, var(--pair) 18%, transparent); stroke-width: 3.5; stroke-linecap: round }
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

  /* --- On-page panels: notes and developer, always visible on the test page --- */
  .panel { display: flex; flex-direction: column; min-height: 0; padding: 16px;
    background: var(--card); backdrop-filter: blur(10px); border: 1px solid var(--line);
    border-radius: 20px; box-shadow: var(--shadow) }
  .panel h3 { display: flex; align-items: center; gap: 9px; margin: 0 0 12px; font-size: 13.5px; font-weight: 800 }
  .panel .ph-ic { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px;
    background: var(--a100); color: var(--deep); flex: none }
  #drawer textarea { width: 100%; min-height: 74px; resize: vertical }
  #drawer .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px }
  #scrim { display: none }
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
  /* The empty state fills the panel and sits dead-centre. */
  #noteList:empty { display: none }
  .empty-note { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; font-size: 11.5px; color: var(--muted);
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

  /* --- Brand identity in the header --- */
  .brand { gap: 10px }
  .brand .pw { height: 16px; display: block; flex: none }
  html[data-wt="dark"] .brand .pw { filter: brightness(0) invert(1) }
  .brand .x { color: var(--muted); font-size: 12px; font-weight: 700; flex: none }
  .brand .logo { width: 27px; height: 27px; border-radius: 9px; object-fit: cover; flex: none;
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px color-mix(in srgb, var(--brand) 45%, transparent) }
  .brand .logo.fallback { display: grid; place-items: center; background: var(--brand); color: #fff; font-weight: 800; font-size: 13px }
  .brand .ident { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; gap: 1px }
  .brand .name { font-weight: 800; font-size: 12.5px; letter-spacing: -.01em }
  .brand .tag { font-size: 8.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); white-space: nowrap }
  header { position: sticky; top: 0 }

  /* --- Hero column beside the stage --- */
  main { gap: 10px }
  .hero { position: relative; z-index: 2; text-align: center; max-width: 660px; flex: none }
  .hero .eyebrow { display: inline-flex; align-items: center; gap: 8px; margin: 0;
    font-size: 9.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--deep);
    border: 1px solid color-mix(in srgb, var(--pair) 24%, transparent); border-radius: 999px; padding: 5px 12px;
    background: color-mix(in srgb, var(--pair) 7%, var(--surface)) }
  .hero .eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pair) 22%, transparent) }
  .hero h1 { margin: 10px 0 0; font-size: clamp(20px, 3vw, 34px); font-weight: 800; line-height: 1.12; letter-spacing: -.022em;
    background: linear-gradient(94deg, var(--ink) 20%, color-mix(in srgb, var(--brand) 80%, var(--ink)) 78%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent }
  .hero .sub { margin: 9px auto 0; max-width: 34em; font-size: 12.5px; line-height: 1.7; color: var(--muted) }
  .tips { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px }
  .tips li { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 600; color: var(--muted);
    border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 6px 13px 6px 7px; backdrop-filter: blur(6px) }
  html[dir="rtl"] .tips li { padding: 6px 7px 6px 13px }
  .tips .tic { display: grid; place-items: center; width: 21px; height: 21px; border-radius: 999px;
    background: var(--a100); color: var(--deep); flex: none }
  @media (max-height: 620px) { .hero .sub, .tips { display: none } }
  @media (min-width: 1150px) and (min-height: 600px) {
    main:not(.page) { flex-direction: row; align-items: center; justify-content: center; gap: clamp(28px, 4.5vw, 76px); padding-inline: clamp(24px, 5vw, 80px) }
    main:not(.page) .hero { text-align: start; max-width: 400px }
    main:not(.page) .hero .sub { margin-inline: 0 }
    main:not(.page) .tips { flex-direction: column; align-items: flex-start; gap: 9px; margin-top: 20px }
    main:not(.page) .tips li { border: 0; background: none; padding: 0; backdrop-filter: none; font-size: 12.5px }
    main:not(.page) .stagecol { flex: 0 1 auto; width: auto; min-width: 0; align-self: stretch; justify-content: center }
  }
  body[data-view='test'] main.page .hero { display: none }
  .stagecol { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center;
    gap: 12px; flex: 1; min-height: 0; width: 100%; min-width: 0 }
  main.page .stagecol { align-self: stretch }
  /* The device floats on a branded halo. */
  #stage { position: relative }
  #stage::before { content: ''; position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%);
    width: min(78%, 430px); aspect-ratio: 1; border-radius: 999px; pointer-events: none;
    background: radial-gradient(circle, color-mix(in srgb, var(--brand) 24%, transparent) 0%, transparent 68%);
    filter: blur(26px) }
  .phone, .browser { z-index: 1 }
  .phone { box-shadow: 0 0 0 1px rgba(255,255,255,.05), 0 34px 90px -30px color-mix(in srgb, var(--brand) 46%, rgba(15,18,22,.6)) }

  /* --- Developer panel: the live script and the postMessage console --- */
  .dev-tabs { display: flex; gap: 2px; border: 1px solid var(--line); background: var(--surface); border-radius: 9px; padding: 2px; margin-bottom: 12px }
  .dev-tabs button { flex: 1; border: 0; border-radius: 7px; background: none; cursor: pointer; font-size: 11.5px; font-weight: 700;
    color: var(--muted); padding: 7px 4px; transition: all .18s }
  .dev-tabs button.on { background: var(--accent); color: #fff }
  .dev-pane { display: none; flex: 1; min-height: 0; flex-direction: column }
  .dev-pane.on { display: flex }
  .knobs { display: grid; gap: 9px; margin-bottom: 11px }
  .knob { display: flex; align-items: center; justify-content: space-between; gap: 8px }
  .knob > span { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted) }
  .knob .seg { flex: none }
  .knob .seg button { padding: 5px 9px; font-size: 10.5px }
  #devCode { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; margin: 0;
    border: 1px solid color-mix(in srgb, var(--pair) 30%, #16233a); border-radius: 14px;
    background: linear-gradient(175deg, #14263f 0%, #0d1a2e 100%); color: #d3deea;
    direction: ltr; text-align: left;
    font: 500 10.5px/1.8 'SF Mono', Menlo, Consolas, monospace; padding: 14px 16px;
    white-space: pre-wrap; word-break: break-all; tab-size: 2;
    scrollbar-width: thin; box-shadow: inset 0 1px 0 rgba(255,255,255,.04) }
  #devCode .k { color: #8fb8f0 } #devCode .s { color: #a3d99a } #devCode .hl { color: #fff; background: color-mix(in srgb, var(--pair) 55%, transparent); border-radius: 4px; padding: 0 3px }
  .dev-row { display: flex; gap: 8px; margin-top: 10px }
  .dev-row .btn { flex: 1 }
  /* Hard viewport-derived cap: however the surrounding layout flows, the log
     never grows the page — past this height it scrolls internally. */
  #evtList { list-style: none; margin: 0; padding: 0 1px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1;
    max-height: calc(100dvh - 230px) }
  #evtList li { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 7px 10px; cursor: pointer; animation: pop .2s both }
  #evtList .row1 { display: flex; align-items: center; gap: 7px; font-size: 10.5px }
  #evtList .dir { flex: none; font-weight: 800; font-size: 8.5px; letter-spacing: .05em; border-radius: 5px; padding: 2px 6px; text-transform: uppercase }
  #evtList .dir.w { background: var(--a100); color: var(--deep) }
  #evtList .dir.s { background: color-mix(in srgb, #7a5af5 16%, var(--surface)); color: #7a5af5 }
  #evtList li.mark { cursor: default; background: var(--code); border-style: dashed }
  #evtList li.mark .typ { font-family: inherit; font-weight: 800; color: var(--deep) }
  #evtList .typ { font-family: Menlo, monospace; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
  #evtList time { margin-inline-start: auto; flex: none; font-size: 9px; color: var(--muted); font-variant-numeric: tabular-nums }
  #evtList pre { display: none; margin: 7px 0 0; max-height: 180px; overflow: auto; direction: ltr; text-align: left;
    font: 500 9.5px/1.6 Menlo, Consolas, monospace; color: var(--muted); background: var(--code); border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; word-break: break-all }
  #evtList li.open pre { display: block }
  #evtList:empty { display: none }
  .evt-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; font-size: 11.5px; color: var(--muted);
    text-align: center; border: 1px dashed var(--line); border-radius: 12px; padding: 22px 16px }
  .evt-live { display: inline-flex; align-items: center; gap: 6px; font-size: 9.5px; font-weight: 800; letter-spacing: .08em;
    text-transform: uppercase; color: var(--deep) }
  .evt-live::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--accent); animation: ping-dot 1.6s ease-out infinite }
  @keyframes ping-dot { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--pair) 40%, transparent) } 60% { box-shadow: 0 0 0 5px transparent } }

  /* --- Two pages in one document: the intro (brand + steps) and the test --- */
  body[data-view='test'] .hero, body[data-view='test'] #stories { display: none }
  body[data-view='intro'] .stagecol { display: none }
  /* Page mode runs the live widget on this document; on the intro it would sit
     over the brand story, so it only appears once testing starts. */
  body[data-view='intro'] #pair-ai-widget-holder { display: none !important }
  body[data-view='intro'] main { min-height: 0; padding-top: clamp(28px, 6vh, 64px) }
  .hero .cta { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 22px }
  .hero .cta .btn { font-size: 13.5px; padding: 12px 26px; border-radius: 12px }
  .s-cta { display: flex; justify-content: center; padding: 6px 0 46px }
  .s-cta .btn { font-size: 13.5px; padding: 12px 28px; border-radius: 12px }
  /* The test page is a workbench: one tabbed side panel (notes | developer)
     beside the stage. In page mode the panel takes the side OPPOSITE the
     widget's corner, so the live widget never lands on top of it. */
  body[data-view='intro'] .sidebox { display: none }
  body[data-view='test'] main {
    display: grid; grid-template-columns: minmax(290px, 350px) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch; gap: 16px; padding: 16px clamp(14px, 2.6vw, 28px);
    height: calc(100dvh - 52px); min-height: 620px; overflow: hidden }
  body[data-view='test'] main.side-end { grid-template-columns: minmax(0, 1fr) minmax(290px, 350px) }
  body[data-view='test'] main.side-end .sidebox { order: 2 }
  body[data-view='test'] .stagecol { min-height: 0 }
  .sidebox { display: flex; flex-direction: column; gap: 10px; min-height: 0 }
  .side-tabs { display: flex; gap: 2px; border: 1px solid var(--line); background: var(--card);
    backdrop-filter: blur(10px); border-radius: 14px; padding: 3px; box-shadow: var(--shadow); flex: none }
  .side-tabs button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    border: 0; border-radius: 11px; background: none; cursor: pointer; font-size: 12px; font-weight: 800;
    color: var(--muted); padding: 9px 6px; transition: all .18s }
  .side-tabs button.on { background: var(--accent); color: #fff }
  .side-tabs button:not(.on):hover { color: var(--deep); background: var(--a50) }
  .sidebox .panel { display: none; flex: 1; min-height: 0; overflow: hidden }
  .sidebox .panel.on { display: flex }
  #noteList { min-height: 0 }
  #evtList { min-height: 0; scrollbar-width: thin; padding-inline-end: 2px }
  #devCode { min-height: 120px }
  @media (max-width: 1000px) {
    body[data-view='test'] main, body[data-view='test'] main.side-end { display: flex; flex-direction: column; height: auto; min-height: 0 }
    body[data-view='test'] .stagecol { order: 0; min-height: 72dvh }
    body[data-view='test'] .sidebox { order: 1 }
    .sidebox .panel.on { overflow: visible }
    #evtList { max-height: min(46dvh, 380px) }
    #devCode { max-height: 320px }
  }
  .dock { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 9px;
    padding: 8px 10px; border: 1px solid var(--line); border-radius: 16px;
    background: var(--card); backdrop-filter: blur(10px); box-shadow: var(--shadow);
    /* Above the stage, so the device menu opens over the phone, not behind it. */
    position: relative; z-index: 12 }
  .dock .seg.lg { border-radius: 11px }
  .dock .seg.lg button { padding: 8px 13px; font-size: 11.5px; border-radius: 9px; display: inline-flex; align-items: center; gap: 6px }
  .dock .menu-btn { padding: 9px 13px; border-radius: 11px }

  /* --- Below the fold: the Pair story and the testing journey --- */
  .hero .more { display: inline-flex; align-items: center; gap: 7px; margin-top: 18px; border: 0; background: none;
    cursor: pointer; font-size: 11.5px; font-weight: 800; color: var(--deep); padding: 4px 0 }
  .hero .more .i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px;
    background: var(--a100); animation: bob 1.8s ease-in-out infinite }
  @keyframes bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(3px) } }
  main.page ~ #stories .journey-band { margin-top: 0 }
  #stories { position: relative; z-index: 1; padding: 10px 18px 0 }
  .journey-band { max-width: 1060px; margin: 26px auto 0; background: var(--card); border: 1px solid var(--line);
    border-radius: 22px; box-shadow: var(--shadow); backdrop-filter: blur(8px); padding: clamp(24px, 4vw, 44px) }
  .s-eyebrow { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; color: var(--deep) }
  .journey-band h2, .story h2 { margin: 10px 0 0; font-size: clamp(21px, 3vw, 32px); font-weight: 800;
    letter-spacing: -.02em; line-height: 1.15 }
  .journey { list-style: none; counter-reset: j; margin: 26px 0 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 18px }
  .journey li { counter-increment: j; position: relative; border: 1px solid var(--line); border-radius: 16px;
    background: var(--surface); padding: 18px 16px 16px }
  .journey li::before { content: counter(j, decimal-leading-zero); display: inline-grid; place-items: center;
    font-size: 11px; font-weight: 800; color: var(--deep); background: var(--a100); border-radius: 8px; padding: 4px 8px }
  .journey b { display: block; margin: 11px 0 5px; font-size: 13.5px; letter-spacing: -.01em }
  .journey p { margin: 0; font-size: 11.5px; line-height: 1.65; color: var(--muted) }
  .story { max-width: 1060px; margin: 0 auto; display: grid; align-items: center;
    gap: clamp(22px, 4vw, 56px); padding: clamp(40px, 7vh, 76px) 6px }
  @media (min-width: 880px) { .story { grid-template-columns: 1fr 1fr } .story.alt .txt { order: 2 } }
  .story .txt p.body { margin: 12px 0 0; max-width: 34em; font-size: 13px; line-height: 1.75; color: var(--muted) }
  .story .dots { display: flex; align-items: center; gap: 6px; margin-top: 20px }
  .story .dots i { width: 6px; height: 6px; border-radius: 999px; background: var(--a200) }
  .story .dots i.on { width: 24px; background: var(--accent) }
  .story .dots em { font-style: normal; margin-inline-start: 6px; font-size: 10.5px; font-weight: 800; color: var(--deep) }
  .shot { position: relative; border: 1px solid var(--line); border-radius: 18px; background: var(--surface);
    box-shadow: var(--shadow); padding: 18px; overflow: hidden }
  .shot::after { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(90% 90% at 85% 0%, color-mix(in srgb, var(--pair) 8%, transparent), transparent 60%) }
  .shot .bar { display: flex; align-items: center; gap: 6px; margin-bottom: 14px }
  .shot .bar i { width: 8px; height: 8px; border-radius: 999px; background: var(--line) }
  .shot .bar em { font-style: normal; margin-inline-start: 6px; font-size: 9px; font-weight: 800; letter-spacing: .1em;
    text-transform: uppercase; color: var(--muted) }
  .shot .bar u { margin-inline-start: auto; text-decoration: none; font-size: 8.5px; font-weight: 800;
    letter-spacing: .09em; color: var(--deep); text-transform: uppercase }
  .mock-row { display: flex; gap: 14px; align-items: stretch }
  .mock-panel { flex: 1.35; border: 1px solid var(--line); border-radius: 12px; padding: 12px }
  .mock-panel .lb { font-size: 8px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: var(--deep); margin: 0 0 6px }
  .mock-field { display: flex; align-items: center; gap: 7px; border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; margin-top: 7px }
  .mock-field i { width: 13px; height: 13px; border-radius: 5px; background: var(--brand); flex: none }
  .mock-field span { font-size: 9.5px; font-weight: 600; color: var(--muted) }
  .mock-field .sw { margin-inline-start: auto; width: 22px; height: 12px; border-radius: 999px; background: var(--accent); position: relative }
  .mock-field .sw::after { content: ''; position: absolute; top: 2px; inset-inline-end: 2px; width: 8px; height: 8px; border-radius: 999px; background: #fff }
  .mock-phone { flex: 1; border: 2.5px solid var(--ink); border-radius: 18px; padding: 9px; display: flex; flex-direction: column; gap: 7px; min-height: 148px }
  .mock-phone.dark { background: #101216; border-color: #101216 }
  .mock-phone .hero-ln { height: 34px; border-radius: 9px; background: linear-gradient(120deg, color-mix(in srgb, var(--brand) 82%, #000), var(--brand)) }
  .mock-phone .ln { height: 7px; border-radius: 999px; background: var(--code) }
  .mock-phone.dark .ln { background: #23262c }
  .mock-phone .chip { height: 15px; border-radius: 999px; border: 1px solid var(--line); width: 72% }
  .mock-phone.dark .chip { border-color: #2c2f36 }
  .mock-phone .send { margin-top: auto; display: flex; gap: 6px; align-items: center }
  .mock-phone .send .fld { flex: 1; height: 16px; border-radius: 999px; border: 1px solid var(--line) }
  .mock-phone.dark .send .fld { border-color: #2c2f36 }
  .mock-phone .send .go { width: 16px; height: 16px; border-radius: 999px; background: var(--brand) }
  .mock-note { border: 1px solid var(--line); border-radius: 12px; padding: 11px 13px; margin-top: 10px }
  .mock-note p { margin: 0; font-size: 10px; line-height: 1.6; color: var(--muted) }
  .mock-note b { display: block; font-size: 9px; color: var(--deep); margin-top: 6px }
  .mock-code { background: #101318; border-radius: 12px; padding: 13px 15px; direction: ltr; text-align: left;
    font: 600 9.5px/1.9 Menlo, monospace }
  .mock-code i { font-style: normal; color: #7ea6e0 } .mock-code b { color: #9ece8f; font-weight: 600 }
  .mock-code u { text-decoration: none; color: #fff; background: color-mix(in srgb, var(--brand) 45%, transparent); border-radius: 4px; padding: 0 3px }
  .mock-code p { margin: 0; color: #c6cdd6; white-space: pre }
  .s-foot { max-width: 1060px; margin: 10px auto 0; display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 30px 0 34px; border-top: 1px solid var(--line) }
  .s-foot img { height: 15px }
  html[data-wt="dark"] .s-foot img { filter: brightness(0) invert(1) }
  .s-foot p { margin: 0; font-size: 10.5px; color: var(--muted); font-weight: 600 }
</style>
</head>
<body>
<div id="shell">
<div class="glow g1"></div>
<div class="glow g2"></div>
<div id="toasts" aria-live="polite"></div>

<header class="rise">
  <button class="brand" id="brandBtn" type="button" title="Pair">
    <img class="pw" src="/pair-wordmark.svg" alt="Pair" />
    <span class="x" aria-hidden="true">×</span>
    ${avatarUrl ? `<img class="logo" src="${esc(avatarUrl)}" alt="" />` : `<span class="logo fallback">${esc(brandInitial)}</span>`}
    <span class="ident">
      <span class="name">${esc(widget.channelName)}</span>
      <span class="tag" data-i18n="hd.tag">AI assistant preview</span>
    </span>
  </button>
  <div class="controls">
    <button class="who" id="whoBtn" type="button"><span class="av" id="whoAv"></span><span id="whoName"></span><i id="whoRole"></i></button>
  </div>
</header>

<main class="${pageMode ? 'page' : ''}">
  <section class="hero rise">
    <p class="eyebrow"><span data-i18n="h.eyebrow">Live preview</span></p>
    <h1>${esc(heroTitle)}</h1>
    <p class="sub">${heroSub ? esc(heroSub) : '<span data-i18n="h.subFallback">This is the real widget, served exactly as your visitors will get it.</span>'}</p>
    <ul class="tips">
      <li><span class="tic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.3 0-2.5-.3-3.6-.8L3 21l1.8-5.9a8.5 8.5 0 1 1 16.2-3.6Z"/></svg></span><span data-i18n="h.tip1">Chat with it — replies stream in live</span></li>
      <li><span class="tic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"/></svg></span><span data-i18n="h.tip2">Flip language and theme from the top bar</span></li>
      <li><span class="tic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span><span data-i18n="h.tip3">Spot something off? Leave a note</span></li>
    </ul>
    <div class="cta">
      <button class="btn" id="startBtn" type="button"><span data-i18n="cta.start">Start testing</span> <span class="i"></span></button>
      <button class="btn btn-ghost" id="moreBtn" type="button"><span data-i18n="h.more">How Pair works</span></button>
    </div>
  </section>
  <aside class="sidebox rise">
    <div class="side-tabs" role="tablist">
      <button id="sbNotes" type="button" class="on"><span class="i"></span><span data-i18n="n.title">Test notes</span></button>
      <button id="sbDev" type="button"><span class="i"></span><span data-i18n="dev.title">Developer</span></button>
    </div>
  <div id="drawer" class="panel on" aria-label="Test notes">
    <textarea id="noteText" class="field" maxlength="1000" data-i18n-ph="n.ph" placeholder="What's not working for you?"></textarea>
    <div class="attach-thumb" id="attachThumb"><img id="attachImg" alt="Attached screenshot" /><button type="button" id="attachRemove" aria-label="Remove screenshot">×</button></div>
    <div class="row">
      <button id="noteAttach" class="btn btn-ghost btn-sm" type="button"><span class="i"></span><span data-i18n="n.attach">Screenshot</span></button>
      <button id="noteAdd" class="btn btn-sm" type="button" data-i18n="n.save">Save note</button>
    </div>
    <input type="file" id="noteFile" accept="image/png,image/jpeg,image/webp" hidden />
    <ul id="noteList"></ul>
    <p class="empty-note" id="noteEmpty"><span class="i"></span><span data-i18n="n.empty">No notes yet.</span></p>
  </div>
  <!-- devpanel-here -->
  </aside>

  <div class="stagecol">
    <div class="dock rise">
      <div class="menu" id="devMenu">
        <button class="menu-btn" id="devBtn" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span class="lead" id="devIcon"></span><span id="devLabel"></span><span class="caret"></span>
        </button>
        <div class="menu-pop" id="devPop" role="listbox"></div>
      </div>
    </div>
    <div id="stage"></div>
    <div class="stage-actions">
      <button class="btn" id="wOpen" type="button"><span class="i"></span><span id="runLabel"></span></button>
      <button id="wClose" type="button"><span class="i"></span><span data-i18n="close">Close</span></button>
    </div>
    <p class="powered" dir="ltr"><span data-i18n="powered">Powered by</span> <img src="/pair-wordmark.svg" alt="Pair AI" /></p>
  </div>

  <aside id="devDrawer" class="panel" aria-label="Developer">
    <div class="dev-tabs" role="tablist">
      <button id="devTabScript" type="button" class="on" data-i18n="dev.script">Install script</button>
      <button id="devTabEvents" type="button" data-i18n="dev.events">postMessages</button>
    </div>
    <div class="dev-pane on" id="devPaneScript">
      <pre id="devCode" dir="ltr"></pre>
      <div class="dev-row">
        <button class="btn btn-sm" id="devCopy" type="button" data-i18n="dev.copy">Copy script</button>
      </div>
    </div>
    <div class="dev-pane" id="devPaneEvents">
      <div class="knob" style="margin-bottom:10px">
        <span class="evt-live" data-i18n="dev.live">Live</span>
        <button class="btn btn-ghost btn-sm" id="evtClear" type="button" data-i18n="dev.clear">Clear</button>
      </div>
      <ul id="evtList"></ul>
      <p class="evt-empty" id="evtEmpty"><span data-i18n="dev.empty">Messages between the SDK and the widget appear here as they happen.</span></p>
    </div>
  </aside>
</main>

<!-- Below the fold: how to test, and how Pair makes this widget -->
<section id="stories">
  <div class="journey-band rise">
    <p class="s-eyebrow" data-i18n="j.eyebrow">How to test</p>
    <h2 data-i18n="j.title">Four things to try before you leave</h2>
    <ol class="journey">
      <li><b data-i18n="j1.t">Ask something real</b><p data-i18n="j1.p">Open the widget and ask what a visitor would ask. Replies stream in live.</p></li>
      <li><b data-i18n="j2.t">Flip language & theme</b><p data-i18n="j2.p">Switch to عربي and to dark from the top bar — the whole design follows.</p></li>
      <li><b data-i18n="j3.t">Change devices</b><p data-i18n="j3.p">Try it on iPhones, Androids, tablets and desktop from the device menu.</p></li>
      <li><b data-i18n="j4.t">Leave a note</b><p data-i18n="j4.p">Anything off? Write it down — it reaches the studio with your name on it.</p></li>
    </ol>
  </div>

  <div class="story">
    <div class="txt">
      <p class="s-eyebrow" data-i18n="t1.cap">Design</p>
      <h2 data-i18n="t1.t">It starts in the studio</h2>
      <p class="body" data-i18n="t1.p">Brand colour, hero slides, quick links and prompts are picked in the Pair builder — no code, no deploy.</p>
      <p class="dots"><i class="on"></i><i></i><i></i><i></i><em data-i18n="t1.cap">Design</em></p>
    </div>
    <div class="shot">
      <p class="bar"><i></i><i></i><i></i><em data-i18n="s.studio">Widget studio</em><u data-i18n="s.live">Live preview</u></p>
      <div class="mock-row">
        <div class="mock-panel">
          <p class="lb" data-i18n="s.brand">Brand</p>
          <div class="mock-field"><i></i><span>${esc(brand)}</span></div>
          <div class="mock-field"><span>${esc(heroTitle).slice(0, 26)}</span></div>
          <div class="mock-field"><span data-i18n="s.hero">Show hero</span><span class="sw"></span></div>
        </div>
        <div class="mock-phone"><div class="hero-ln"></div><div class="ln" style="width:80%"></div><div class="ln" style="width:55%"></div><div class="chip"></div><div class="chip" style="width:58%"></div><div class="send"><span class="fld"></span><span class="go"></span></div></div>
      </div>
    </div>
  </div>

  <div class="story alt">
    <div class="txt">
      <p class="s-eyebrow" data-i18n="t2.cap">Preview</p>
      <h2 data-i18n="t2.t">Every change, seen at once</h2>
      <p class="body" data-i18n="t2.p">The builder renders the real widget as you type, in both languages and both themes, on any device.</p>
      <p class="dots"><i></i><i class="on"></i><i></i><i></i><em data-i18n="t2.cap">Preview</em></p>
    </div>
    <div class="shot">
      <p class="bar"><i></i><i></i><i></i><em data-i18n="s.preview">Live preview</em><u>EN · عربي</u></p>
      <div class="mock-row">
        <div class="mock-phone"><div class="hero-ln"></div><div class="ln" style="width:78%"></div><div class="ln" style="width:52%"></div><div class="send"><span class="fld"></span><span class="go"></span></div></div>
        <div class="mock-phone dark"><div class="hero-ln"></div><div class="ln" style="width:70%"></div><div class="ln" style="width:48%"></div><div class="send"><span class="fld"></span><span class="go"></span></div></div>
      </div>
    </div>
  </div>

  <div class="story">
    <div class="txt">
      <p class="s-eyebrow" data-i18n="t3.cap">Share</p>
      <h2 data-i18n="t3.t">One link for the whole team</h2>
      <p class="body" data-i18n="t3.p">This page is that link. Anyone can open it, switch language or theme, and leave a note on what they see.</p>
      <p class="dots"><i></i><i></i><i class="on"></i><i></i><em data-i18n="t3.cap">Share</em></p>
    </div>
    <div class="shot">
      <p class="bar"><i></i><i></i><i></i><em data-i18n="s.notes">Test notes</em><u data-i18n="s.sent">Sent to studio</u></p>
      <div class="mock-note"><p data-i18n="s.note1">"The Arabic hero reads perfectly — ship it."</p><b>Sarah · QA</b></div>
      <div class="mock-note"><p data-i18n="s.note2">"Make the launcher a little larger on mobile?"</p><b>Omar · Product</b></div>
    </div>
  </div>

  <div class="story alt">
    <div class="txt">
      <p class="s-eyebrow" data-i18n="t4.cap">Ship</p>
      <h2 data-i18n="t4.t">The same design goes live</h2>
      <p class="body" data-i18n="t4.p">The widget here runs on the real Pair SDK, reading the very design the studio serves to production.</p>
      <p class="dots"><i></i><i></i><i></i><i class="on"></i><em data-i18n="t4.cap">Ship</em></p>
    </div>
    <div class="shot">
      <p class="bar"><i></i><i></i><i></i><em data-i18n="s.script">Install script</em><u dir="ltr">&lt;/&gt;</u></p>
      <div class="mock-code"><p><i>&lt;script&gt;</i>
  window.PairAiWidgetSettings = {
    position: <u>"${esc(position)}"</u>,
    beBaseUrl: <b>"${esc(`…/${widget.widgetId.slice(0, 10)}…`)}"</b>,
  }
<i>&lt;/script&gt;</i></p></div>
    </div>
  </div>

  <div class="s-cta">
    <button class="btn" id="startBtn2" type="button"><span data-i18n="cta.start">Start testing</span> <span class="i"></span></button>
  </div>

  <footer class="s-foot">
    <img src="/pair-wordmark.svg" alt="Pair" />
    <p><span data-i18n="f.line">AI widgets, designed and shipped in one place.</span></p>
  </footer>
</section>
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

<div id="scrim" hidden></div>

<script>
  var WIDGET_ID = ${js(widget.widgetId)}
  var SDK_BASE = ${localSdk ? `location.origin + ${js(sdkBase)}` : js(sdkBase)}
  var BE_BASE = location.origin + ${js(beBase)}
  var SETTINGS = { position: ${js(position)}, type: ${js(type)}, launcherTitle: ${js(launcherTitle)} }
  var PANEL = ${JSON.stringify(savedPanel)}
  var VIEW_PATH = ${js(beBase)}
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
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
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
      'd.iphone17': 'iPhone 17', 'd.iphone17max': 'iPhone 17 Pro Max', 'd.iphone16': 'iPhone 16',
      'd.iphone': 'iPhone 15', 'd.iphonemax': 'iPhone 15 Pro Max', 'd.se': 'iPhone SE', 'd.android': 'Pixel 8',
      'd.galaxy': 'Galaxy S24', 'd.tablet': 'iPad Pro', 'd.ipadmini': 'iPad Mini',
      'd.laptop': 'Laptop', 'd.desktop': 'Desktop', 'd.page': 'On this page',
      'site.hint': 'A mock customer site — the launcher is live in the corner.',
      't.welcome': 'Welcome, <b>{n}</b> — happy testing!',
      't.nameReq': '<b>Your name</b> is required.',
      't.noteReq': 'Write the note first.',
      't.noteSent': 'Note sent to the <b>studio</b>. Thank you!',
      't.noteFail': 'Saved locally, but it did not reach the studio. <b>Check your connection.</b>',
      't.imgBig': 'Screenshot is over <b>3 MB</b>.', 't.imgOk': 'Screenshot attached.', 't.imgFail': 'Could not upload. <b>Try again.</b>',
      'hd.tag': 'AI assistant', 'h.eyebrow': 'Live preview',
      'h.subFallback': 'This is the real widget, served exactly as your visitors will get it.',
      'h.tip1': 'Chat with it — replies stream in live',
      'h.tip2': 'Flip language and theme from the top bar',
      'h.tip3': 'Spot something off? Leave a note',
      'dev.title': 'Developer', 'dev.script': 'Install script', 'dev.events': 'postMessages',
      'dev.lang': 'Language', 'dev.theme': 'Theme', 'dev.thDefault': 'Design', 'dev.thLight': 'Light', 'dev.thDark': 'Dark',
      'dev.pos': 'Position', 'dev.posR': 'Right', 'dev.posL': 'Left',
      'dev.launcher': 'Launcher', 'dev.tyStd': 'Bubble', 'dev.tyExp': 'Label', 'dev.tyIcon': 'Icon',
      'dev.copy': 'Copy script', 'dev.copied': 'Script <b>copied</b>.', 'dev.clear': 'Clear', 'dev.live': 'Live',
      'dev.empty': 'Messages between the SDK and the widget appear here as they happen.',
      'h.more': 'How Pair works', 'cta.start': 'Start testing',
      'j.eyebrow': 'How to test', 'j.title': 'Four things to try before you leave',
      'j1.t': 'Ask something real', 'j1.p': 'Open the widget and ask what a visitor would ask. Replies stream in live.',
      'j2.t': 'Flip language & theme', 'j2.p': 'Switch to عربي and to dark from the top bar — the whole design follows.',
      'j3.t': 'Change devices', 'j3.p': 'Try it on iPhones, Androids, tablets and desktop from the device menu.',
      'j4.t': 'Leave a note', 'j4.p': 'Anything off? Write it down — it reaches the studio with your name on it.',
      's.studio': 'Widget studio', 's.live': 'Live preview', 's.brand': 'Brand', 's.hero': 'Show hero',
      's.preview': 'Live preview', 's.notes': 'Test notes', 's.sent': 'Sent to studio', 's.script': 'Install script',
      's.note1': '"The Arabic hero reads perfectly — ship it."',
      's.note2': '"Make the launcher a little larger on mobile?"',
      'f.line': 'AI widgets, designed and shipped in one place.',
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
      'd.iphone17': 'آيفون 17', 'd.iphone17max': 'آيفون 17 برو ماكس', 'd.iphone16': 'آيفون 16',
      'd.iphone': 'آيفون 15', 'd.iphonemax': 'آيفون 15 برو ماكس', 'd.se': 'آيفون SE', 'd.android': 'بكسل 8',
      'd.galaxy': 'جالاكسي S24', 'd.tablet': 'آيباد برو', 'd.ipadmini': 'آيباد ميني',
      'd.laptop': 'لابتوب', 'd.desktop': 'سطح المكتب', 'd.page': 'داخل الصفحة',
      'site.hint': 'موقع عميل تجريبي — المُشغّل يعمل في الركن.',
      't.welcome': 'أهلًا <b>{n}</b> — تجربة سعيدة!',
      't.nameReq': '<b>اسمك</b> مطلوب.',
      't.noteReq': 'اكتب الملاحظة أولًا.',
      't.noteSent': 'وصلت الملاحظة إلى <b>الاستوديو</b>. شكرًا لك!',
      't.noteFail': 'حُفظت محليًا لكنها لم تصل إلى الاستوديو. <b>تحقق من الاتصال.</b>',
      't.imgBig': 'اللقطة أكبر من <b>3 ميجابايت</b>.', 't.imgOk': 'تم إرفاق اللقطة.', 't.imgFail': 'تعذّر الرفع. <b>حاول مرة أخرى.</b>',
      'hd.tag': 'مساعد ذكي', 'h.eyebrow': 'معاينة حية',
      'h.subFallback': 'هذا هو الودجت الحقيقي، يُقدَّم تمامًا كما سيصل لزوّارك.',
      'h.tip1': 'جرّب المحادثة — الردود تصل لحظيًا',
      'h.tip2': 'بدّل اللغة والثيم من الشريط العلوي',
      'h.tip3': 'لاحظت شيئًا؟ اترك ملاحظة',
      'dev.title': 'المطوّر', 'dev.script': 'سكربت التركيب', 'dev.events': 'postMessages',
      'dev.lang': 'اللغة', 'dev.theme': 'الثيم', 'dev.thDefault': 'التصميم', 'dev.thLight': 'فاتح', 'dev.thDark': 'داكن',
      'dev.pos': 'المكان', 'dev.posR': 'يمين', 'dev.posL': 'يسار',
      'dev.launcher': 'المُشغّل', 'dev.tyStd': 'فقاعة', 'dev.tyExp': 'بعنوان', 'dev.tyIcon': 'أيقونة',
      'dev.copy': 'انسخ السكربت', 'dev.copied': 'تم <b>نسخ</b> السكربت.', 'dev.clear': 'مسح', 'dev.live': 'مباشر',
      'dev.empty': 'رسائل الـ postMessage بين الـ SDK والودجت تظهر هنا لحظة حدوثها.',
      'h.more': 'كيف يعمل Pair', 'cta.start': 'ابدأ التجربة',
      'j.eyebrow': 'كيف تجرّب', 'j.title': 'أربع خطوات جرّبها قبل ما تمشي',
      'j1.t': 'اسأل سؤالًا حقيقيًا', 'j1.p': 'افتح الودجت واسأل ما قد يسأله الزائر. الردود تصل لحظيًا.',
      'j2.t': 'بدّل اللغة والثيم', 'j2.p': 'حوّل إلى English وإلى الداكن من الشريط العلوي — التصميم كله يتبعك.',
      'j3.t': 'غيّر الأجهزة', 'j3.p': 'جرّبه على الآيفون والأندرويد والتابلت وسطح المكتب من قائمة الأجهزة.',
      'j4.t': 'اترك ملاحظة', 'j4.p': 'لاحظت شيئًا؟ اكتبه — يصل إلى الاستوديو وباسمك.',
      's.studio': 'استوديو الودجت', 's.live': 'معاينة حية', 's.brand': 'العلامة', 's.hero': 'إظهار الهيرو',
      's.preview': 'معاينة حية', 's.notes': 'ملاحظات التجربة', 's.sent': 'وصلت للاستوديو', 's.script': 'سكربت التركيب',
      's.note1': '"الهيرو العربي يقرأ بشكل ممتاز — جاهز."',
      's.note2': '"ممكن نكبّر المُشغّل شوية على الموبايل؟"',
      'f.line': 'ودجتات ذكاء اصطناعي، تُصمَّم وتُطلَق من مكان واحد.',
    },
  }
  // The page chrome stays English and light; language and theme are switched
  // INSIDE the widget (its own header controls), where the postMessages show.
  var lang = 'en'
  function tr(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k }

  /* --- Static icon slots --- */
  $('tourX').innerHTML = ic('close', 16)
  $('sbNotes').querySelector('.i').innerHTML = ic('note', 14)
  $('sbDev').querySelector('.i').innerHTML = ic('code', 14)

  /* One side panel, two tabs: notes for everyone, the developer tools beside them. */
  document.querySelector('.sidebox').appendChild($('devDrawer'))
  function sideTab(which) {
    $('sbNotes').classList.toggle('on', which === 'notes')
    $('sbDev').classList.toggle('on', which === 'dev')
    $('drawer').classList.toggle('on', which === 'notes')
    $('devDrawer').classList.toggle('on', which === 'dev')
    store('pair.sidetab', which)
  }
  $('sbNotes').addEventListener('click', function () { sideTab('notes') })
  $('sbDev').addEventListener('click', function () { sideTab('dev') })
  sideTab(read('pair.sidetab') === 'dev' ? 'dev' : 'notes')
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
    try { renderDevScript() } catch (e) {}
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
    // The reload wipes the runtime, so note WHY it happened in the event log first.
    try {
      var list = evtStore()
      list.unshift({ at: Date.now(), marker: true, text: '⟳ page reload' })
      evtSave(list)
    } catch (e) {}
    var q = new URLSearchParams({
      position: 'position' in patch ? patch.position : SETTINGS.position,
      type: 'type' in patch ? patch.type : SETTINGS.type,
      launcherTitle: SETTINGS.launcherTitle,
    })
    var wl = 'wlang' in patch ? patch.wlang : WLANG
    var wt = 'wtheme' in patch ? patch.wtheme : WTHEME
    if (wl) q.set('wlang', wl)
    if (wt) q.set('wtheme', wt)
    var sf = new URLSearchParams(location.search).get('surface')
    if (sf) q.set('surface', sf)
    location.search = q.toString()
  }
  if (WTHEME) document.documentElement.setAttribute('data-wt', WTHEME)

  /* --- Surfaces: five device frames, plus the widget running on this page --- */
  var SURFACES = [
    { id: 'page', icon: 'page' },
    { id: 'iphone17', icon: 'phone', vw: 402, vh: 874, cls: 'iphone', cut: 'island', inset: 46, pad: 18 },
    { id: 'iphone17max', icon: 'phone', vw: 440, vh: 956, cls: 'iphone', cut: 'island', inset: 46, pad: 18 },
    { id: 'iphone16', icon: 'phone', vw: 393, vh: 852, cls: 'iphone', cut: 'island', inset: 46, pad: 18 },
    { id: 'iphone', icon: 'phone', vw: 390, vh: 844, cls: 'iphone', cut: 'island', inset: 46, pad: 18 },
    { id: 'iphonemax', icon: 'phone', vw: 430, vh: 932, cls: 'iphone', cut: 'island', inset: 46, pad: 18 },
    { id: 'se', icon: 'phone', vw: 375, vh: 667, cls: 'se', cut: null, inset: 0, pad: 16 },
    { id: 'android', icon: 'phone', vw: 412, vh: 915, cls: 'android', cut: 'hole', inset: 38, pad: 14 },
    { id: 'galaxy', icon: 'phone', vw: 360, vh: 780, cls: 'android', cut: 'hole', inset: 34, pad: 12 },
    { id: 'tablet', icon: 'tablet', vw: 820, vh: 1180, cls: 'tablet', cut: null, inset: 0, pad: 22 },
    { id: 'ipadmini', icon: 'tablet', vw: 744, vh: 1133, cls: 'tablet', cut: null, inset: 0, pad: 18 },
    { id: 'laptop', icon: 'desktop', vw: 1366, vh: 768, cls: 'desktop', cut: null, inset: 0, pad: 0, chrome: 38 },
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
  })
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
    var rtl = document.documentElement.dir === 'rtl'
    // Hard-pinned: an inline iframe's line box drifts under a scale transform,
    // which is what left a white gutter inside the device screen.
    frameEl.style.display = 'block'
    frameEl.style.position = 'absolute'
    frameEl.style.top = '0'
    frameEl.style.left = rtl ? 'auto' : '0'
    frameEl.style.right = rtl ? '0' : 'auto'
    frameEl.style.transformOrigin = rtl ? 'top right' : 'top left'
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
  /* --- The two views: 'intro' (brand + steps) and 'test' (the stage alone) --- */
  var VIEW_KEY = 'pair.view'
  var pendingStart = false
  function setView(v) {
    document.body.setAttribute('data-view', v)
    store(VIEW_KEY, v)
    window.scrollTo(0, 0)
    if (v === 'test') setTimeout(fitStage, 80)
  }
  function startTesting() {
    var t = read(TESTER_KEY)
    if (!(t && t.name)) { pendingStart = true; showGate(null); return }
    setView('test')
  }
  $('startBtn').addEventListener('click', startTesting)
  $('startBtn2').addEventListener('click', startTesting)
  $('startBtn').querySelector('.i').innerHTML = ic('arrow', 13)
  $('startBtn2').querySelector('.i').innerHTML = ic('arrow', 13)
  // The Pair lockup brings back the intro page (with the tour still on the map there).
  $('brandBtn').addEventListener('click', function () { setView('intro') })
  $('moreBtn').addEventListener('click', function () {
    document.getElementById('stories').scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

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
    if (pendingStart) { pendingStart = false; setView('test') }
  })
  $('whoBtn').addEventListener('click', function () { showGate(read(TESTER_KEY)) })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('tour').classList.contains('hidden')) closeTour()
  })

  /* --- Notes panel (always visible on the test page) --- */

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

  /* --- Developer panel: live install script + postMessage console --- */
  $('devTabScript').addEventListener('click', function () { devTab('Script') })
  $('devTabEvents').addEventListener('click', function () { devTab('Events') })
  function devTab(which) {
    $('devTabScript').classList.toggle('on', which === 'Script')
    $('devTabEvents').classList.toggle('on', which === 'Events')
    $('devPaneScript').classList.toggle('on', which === 'Script')
    $('devPaneEvents').classList.toggle('on', which === 'Events')
  }

  /* The script, rebuilt from the page's current knobs. Changing a knob reloads
     the page with that setting, so the widget below always runs this exact text. */
  function snippetLines(html) {
    var origin = location.origin
    var be = origin + VIEW_PATH
    var hl = html ? function (v) { return '<span class="hl">' + esc(v) + '</span>' } : function (v) { return v }
    var st = html ? function (v) { return '<span class="s">' + esc(v) + '</span>' } : function (v) { return v }
    var kw = html ? function (v) { return '<span class="k">' + esc(v) + '</span>' } : function (v) { return v }
    return [
      kw('<script>'),
      '  window.PairAiWidgetSettings = {',
      '    position: ' + hl('"' + SETTINGS.position + '"') + ',',
      '    type: ' + hl('"' + SETTINGS.type + '"') + ',',
      '    launcherTitle: ' + st(JSON.stringify(SETTINGS.launcherTitle)) + ',',
      '    panel: ' + (html ? esc(JSON.stringify(PANEL)) : JSON.stringify(PANEL)) + ',',
      '    beBaseUrl: ' + hl('"' + be + '"') + ',',
      '  }',
      "  ;(function (d, t) {",
      '    var BASE_URL = ' + hl('"' + SDK_BASE + '"'),
      "    var g = d.createElement(t), s = d.getElementsByTagName(t)[0]",
      "    g.src = BASE_URL + '/sdk.js'",
      '    g.async = true',
      '    s.parentNode.insertBefore(g, s)',
      '    g.onload = function () {',
      '      window.PairAiWidgetSDK.run({',
      '        widgetId: ' + st(JSON.stringify(WIDGET_ID)) + ',',
      '        baseUrl: BASE_URL,',
      '      })',
      '    }',
      "  })(document, 'script')",
      kw('<' + '/script>'),
    ]
  }
  function renderDevScript() {
    $('devCode').innerHTML = snippetLines(true).join('\\n')
  }
  $('devCopy').addEventListener('click', function () {
    var text = snippetLines(false).join('\\n')
    ;(navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { toast(tr('dev.copied')) })
      .catch(function () { toast(tr('t.noteFail'), 'err') })
  })


  /* postMessage console: same-origin windows on both sides of the SDK are
     tapped, so every widget:* / sdk:* message shows up as it happens. */
  var EVT_CAP = 150
  var EVT_KEY = 'pair.evts.' + WIDGET_ID
  var evtCount = 0
  function evtStore() { try { return JSON.parse(sessionStorage.getItem(EVT_KEY)) || [] } catch (e) { return [] } }
  function evtSave(list) { try { sessionStorage.setItem(EVT_KEY, JSON.stringify(list.slice(0, EVT_CAP))) } catch (e) {} }
  var tapped = typeof WeakSet !== 'undefined' ? new WeakSet() : { has: function () { return false }, add: function () {} }
  function tap(win) {
    if (!win) return
    try { if (tapped.has(win)) return; tapped.add(win) } catch (e) { return }
    try { win.addEventListener('message', onTapped) } catch (e) {}
  }
  /* One log row. Marker rows note page reloads (a language/theme change), so
     the story stays readable across them — the log itself survives the reload
     in sessionStorage. */
  function evtRow(rec) {
    evtCount++
    $('evtEmpty').style.display = 'none'
    var li = document.createElement('li')
    var d = new Date(rec.at)
    var hh = function (n) { return (n < 10 ? '0' : '') + n }
    var time = hh(d.getHours()) + ':' + hh(d.getMinutes()) + ':' + hh(d.getSeconds())
    if (rec.marker) {
      li.className = 'mark'
      li.innerHTML = '<div class="row1"><span class="typ">' + esc(rec.text) + '</span><time>' + time + '</time></div>'
    } else {
      li.innerHTML =
        '<div class="row1"><span class="dir ' + (rec.dir === 'w' ? 'w' : 's') + '">' + (rec.dir === 'w' ? 'widget' : 'sdk') + '</span>' +
        '<span class="typ">' + esc(rec.type) + '</span>' +
        '<time>' + time + '</time></div>' +
        (rec.body ? '<pre>' + esc(rec.body) + '</pre>' : '')
      li.addEventListener('click', function () { li.classList.toggle('open') })
    }
    var list = $('evtList')
    list.insertBefore(li, list.firstChild)
    while (list.children.length > EVT_CAP) list.removeChild(list.lastChild)
  }
  function evtPush(rec) {
    var list = evtStore()
    list.unshift(rec)
    evtSave(list)
    evtRow(rec)
  }
  function onTapped(e) {
    var d = e.data
    if (!d || typeof d !== 'object' || typeof d.type !== 'string') return
    var isW = d.type.indexOf('widget:') === 0
    var isS = d.type.indexOf('sdk:') === 0 || d.type.indexOf('metadata:') === 0
    if (!isW && !isS) return
    var payload = d.data !== undefined ? d.data : d.config !== undefined ? d.config : null
    var body = ''
    try { body = JSON.stringify(payload, null, 1) } catch (er) { body = String(payload) }
    if (body === 'null' || body === 'undefined') body = ''
    if (body.length > 4000) body = body.slice(0, 4000) + ' …'
    evtPush({ at: Date.now(), dir: isW ? 'w' : 's', type: d.type, body: body })
  }
  // The log lives across reloads: replay it (oldest first, so newest ends on top).
  evtStore().slice().reverse().forEach(evtRow)
  $('evtClear').addEventListener('click', function () {
    $('evtList').innerHTML = ''
    $('evtEmpty').style.display = ''
    evtCount = 0
    evtSave([])
  })
  /* In page mode the real widget docks to a corner set by its config; the
     side panel moves to the opposite side so they never overlap. */
  function placeSide() {
    if (!PAGE_MODE) return
    var h = document.getElementById('pair-ai-widget-holder')
    if (!h) return
    var main = document.querySelector('main')
    if (main) main.classList.toggle('side-end', h.classList.contains('pair-ai-position-left'))
  }
  function tapAll() {
    placeSide()
    tap(window)
    try { var w1 = document.getElementById('pair-ai-widget-iframe'); if (w1) tap(w1.contentWindow) } catch (e) {}
    try {
      if (frameEl && frameEl.contentWindow) {
        tap(frameEl.contentWindow)
        var w2 = frameEl.contentWindow.document.getElementById('pair-ai-widget-iframe')
        if (w2) tap(w2.contentWindow)
      }
    } catch (e) {}
  }
  setInterval(tapAll, 1200)

  /* --- Boot: tour once → gate once → the widget --- */
  var tester = read(TESTER_KEY)
  syncWho(tester && tester.name ? tester : { name: '—', role: '' })
  applyLang()
  renderStage()
  renderNotes()
  renderDevScript()
  tapAll()
  // Returning testers land straight on the test page; everyone else meets the
  // intro first — the story sections have replaced the old auto-opening tour.
  setView(read(VIEW_KEY) === 'test' && tester && tester.name ? 'test' : 'intro')
  store(TOUR_KEY, 1)
</script>
<style>${poweredCss}</style>
${pageMode ? sdkSnippet : ''}
</body>
</html>`)
  }),
)
