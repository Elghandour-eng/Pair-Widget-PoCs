import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { WidgetConfig } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { normalizeHeroCarousel, normalizeHeroSlides, type HeroSlide } from '@/lib/heroDesign'
import {
  actionCss, focusCss, hoverCss, inputCss, launcherCss, launcherHoverCss, loadingCss,
  cardCss, cardHoverCss, cardSubtitleCss, cardTextCss, chipCss, chipHoverCss,
  normalizeChatInput, normalizeConsent, normalizeCsat, normalizeLauncher, normalizeLoading,
  normalizePreChat, normalizeQuickLinks,
  normalizePrompts as normalizeChatInputPrompts, normalizeToast, resolve, shadowCss,
  textCss, toastCss, type ChatInputDesign, type ConsentDesign, type CsatDesign, type LauncherDesign,
  type LoadingDesign, type PreChatDesign, type ToastDesign,
} from '@/lib/inputDesign'
import { SlotIcon } from './IconField'
import { PairWordmark } from './brand'
import { SendIcon, asSendIcon } from './sendIcons'
import { useWebFont } from '@/lib/webfont'
import { HeroCarousel } from './HeroCarousel'

/**
 * Lightweight visual preview of a Pair widget config.
 * Reads the same fields the real widget reads (widget_v2_config.*), so a designer sees the effect of a change immediately.
 * It is intentionally approximate: the real widget is the source of truth.
 *
 * The frame follows its own config: a config with an Arabic locale renders right-to-left
 * regardless of the dashboard language.
 */
type Any = Record<string, any>
const get = (o: unknown, path: string): any => path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o)

export const PREVIEW_W = 340
export const PREVIEW_H = 560

export const WidgetPreview = memo(function WidgetPreview({ config, dark, frame = true, topInset = 0, focus }: { config: WidgetConfig | null; dark?: boolean; frame?: boolean; topInset?: number; focus?: string }) {
  const { t } = useI18n()

  // The hero: its slide list plus how the carousel and its dots behave, all from
  // the config. Keyed on a snapshot of just that subtree, so the carousel keeps
  // its place and its timer while unrelated fields are being edited — every
  // config edit replaces the whole object graph, so identity is no help here.
  const heroKey = JSON.stringify(get(config, 'widget_v2_config.intro_screen.heroSection') ?? null)
  const hero = useMemo(() => {
    const hs = JSON.parse(heroKey) as Any
    const slides = normalizeHeroSlides(hs?.heroImages)
    // Configs that predate the slide list still carry a single heroImage.url.
    const single = hs?.heroImage?.url
    return {
      slides: slides.length || typeof single !== 'string' || !single.trim() ? slides : ([{ type: 'image', url: single }] as HeroSlide[]),
      carousel: normalizeHeroCarousel(hs?.carousel),
    }
  }, [heroKey])


  // What the designer has typed into the preview's own field.
  const [typed, setTyped] = useState('')

  // Message "sent" by tapping a quick-link card; clears itself like a real send.
  const [sent, setSent] = useState<string | null>(null)
  useEffect(() => {
    if (!sent) return
    const id = setTimeout(() => setSent(null), 3200)
    return () => clearTimeout(id)
  }, [sent])

  // The channel's own font, pulled in so the preview renders it rather than a fallback.
  useWebFont((config as Any)?.styles?.fontFamily)

  // Derived before the empty state returns, so every hook below stays
  // unconditional; `get` and the normalisers already tolerate a missing config.
  const c = (config ?? {}) as Any
  const v2: Any = c.widget_v2_config ?? {}
  const brand: string = c.widget_color || '#4d98e2'
  const bg = get(v2, 'intro_screen.widgetBackground.background') || (dark ? '#0b0b0d' : '#ffffff')
  const headerEnabled = get(v2, 'header.enabled') !== false
  const headerBg = get(v2, 'header.background.enabled') ? get(v2, 'header.background.color') : 'transparent'
  const title = get(v2, 'header.content.title') || c.name || 'Widget'
  const subtitle = get(v2, 'header.content.subtitle') || ''
  const heroEnabled = get(v2, 'intro_screen.heroSection.enabled.value') !== false
  const welcomeTitle = get(v2, 'intro_screen.welcomeTitle.text') || c.welcome_title || ''
  const welcomeSub = get(v2, 'intro_screen.welcomeSubtitle.text') || c.welcome_tagline || ''
  const quickLinks: Any[] =
    get(v2, 'quick_links.showQuickLinks.value') === false ? [] : (get(v2, 'quick_links.quickLinkCards') ?? []).filter((q: Any) => q.active !== false)
  // The channel's own heading for the cards; the dashboard string is only a fallback.
  const quickLinksTitle = get(v2, 'quick_links.displaySettings.sectionTitle') || t('preview.help')
  const prompts: Any[] = get(v2, 'trending_prompts.showTrendingPrompts.value') === false ? [] : (get(v2, 'trending_prompts.promptChips') ?? [])
  const promptTitle = get(v2, 'trending_prompts.displaySettings.sectionTitle') || t('preview.tryAsking')
  const placeholder = get(v2, 'chat_input.placeholderText.text') || t('preview.placeholder')
  // The composer's whole look, from the config, with the legacy fields as fallbacks.
  const ci = normalizeChatInput({
    layout: get(v2, 'chat_input.design.layout') ?? get(v2, 'chat_input.inputLayout.type'),
    direction: get(v2, 'chat_input.design.direction') ?? get(v2, 'chat_input.direction'),
    ...(get(v2, 'chat_input.design') ?? {}),
  })
  const rs = (c: string) => resolve(c, brand)
  // Action icons default to the muted text colour; a channel can pin its own.
  const poweredBy = c.powered_by_pair_ai !== false

  const locale: string = typeof c.locale === 'string' ? c.locale : 'en'
  const widgetDir = /^(ar|he|fa|ur)/i.test(locale) ? 'rtl' : 'ltr'
  // The input row can pin its own direction from the builder; 'auto' follows the widget language.
  // 'auto' follows the widget's own language.
  const inputDir: 'rtl' | 'ltr' = ci.direction === 'rtl' || ci.direction === 'ltr' ? ci.direction : widgetDir

  const isDark = dark || isDarkColor(bg)
  const fg = isDark ? '#f5f5f5' : '#0f1216'
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'
  const titleStyle: CSSProperties = { ...(get(v2, 'header.titleStyle') ?? {}) }
  const cardStyle: CSSProperties = { ...(get(v2, 'quick_links.cardStyle') ?? {}) }
  // Quick-link cards: layout, surface, image and text, all from the config.
  const ql = normalizeQuickLinks(get(v2, 'quick_links.design'))

  // Auto-scroll the card track, so choosing it shows what it does. It yields
  // while the visitor is touching the track and never runs for someone who
  // asked for reduced motion — the same rules the widget follows.
  const cardTrackRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = cardTrackRef.current
    if (!el || ql.layout !== 'carousel' || !ql.autoScroll || quickLinks.length < 2) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let held = false
    const hold = () => { held = true }
    const release = () => { held = false }
    el.addEventListener('pointerdown', hold)
    el.addEventListener('pointerup', release)
    el.addEventListener('pointerleave', release)
    const id = window.setInterval(() => {
      if (held) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const step = el.clientWidth * 0.6
      const next = el.scrollLeft + step
      el.scrollTo({ left: next >= max - 2 ? (ql.loop ? 0 : max) : next, behavior: 'smooth' })
    }, ql.intervalMs)
    return () => {
      window.clearInterval(id)
      el.removeEventListener('pointerdown', hold)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointerleave', release)
    }
  }, [ql.layout, ql.autoScroll, ql.intervalMs, ql.loop, quickLinks.length])

  if (!config) {
    return (
      <div className="card-soft flex size-full items-center justify-center p-6 text-center text-[12.5px] text-faint/80">
        {t('preview.none')}
      </div>
    )
  }


  // Prompt chips: the whole look, from the config. The legacy chipStyle blob is
  // layered on last so a config tuned by hand still wins.
  const pr = normalizeChatInputPrompts(get(v2, 'trending_prompts.design'))
  const chipStyle: CSSProperties = { ...(get(v2, 'trending_prompts.chipStyle') ?? {}) }

  // The launcher only exists while the widget is closed, so it is shown over the
  // preview while that section is the one being edited — otherwise none of its
  // settings would change anything on screen.
  if (focus === 'launcher') {
    return (
      <div
        className={`anim-pop relative size-full overflow-hidden transition-colors duration-300 ${frame ? 'rounded-[14px] ring-[6px] ring-ink/85' : ''}`}
        style={{ background: bg, paddingTop: topInset }}
      >
        <LauncherPreview design={normalizeLauncher(c.launcher_design)} brand={brand} title={c.launcher_title} />
      </div>
    )
  }

  return (
    <div
      dir={widgetDir}
      className={`anim-pop flex size-full flex-col overflow-hidden transition-colors duration-300 ${frame ? 'rounded-[14px] ring-[6px] ring-ink/85' : ''}`}
      style={{ background: bg, color: fg, fontFamily: c.styles?.fontFamily, paddingTop: topInset }}
    >
      {headerEnabled && (
        // Mirrors the real widget header: avatar · title, then the header
        // controls (language / theme, as configured) and the close button.
        <div className="flex items-center gap-2 px-3 py-3 transition-colors duration-300" style={{ background: headerBg }}>
          {c.avatar_url ? (
            <img src={c.avatar_url} alt="" className="size-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="size-6 shrink-0 rounded-full transition-colors duration-300" style={{ background: brand }} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold" style={titleStyle}>{title}</p>
            {subtitle && <p className="truncate text-[10px]" style={{ color: muted }}>{subtitle}</p>}
          </div>
          {get(v2, 'header.controls.lang.show') !== false && (
            (get(v2, 'header.controls.lang.icon') ?? 'badge') === 'badge' ? (
              // The badge names the language a tap brings, like the real widget.
              <span className="shrink-0 rounded-sm px-1.5 py-0.5 text-[9.5px] font-bold" style={{ color: muted, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
                {widgetDir === 'rtl' ? 'EN' : 'عربي'}
              </span>
            ) : (
              <span className="grid size-5 shrink-0 place-items-center" style={{ color: muted }}>
                <SlotIcon name={get(v2, 'header.controls.lang.icon')} url={get(v2, 'header.controls.lang.iconUrl')} size={14} />
              </span>
            )
          )}
          {get(v2, 'header.controls.theme.show') !== false && (
            <span className="grid size-5 shrink-0 place-items-center" style={{ color: muted }}>
              <SlotIcon name={get(v2, 'header.controls.theme.icon') ?? 'moon'} url={get(v2, 'header.controls.theme.iconUrl')} size={14} />
            </span>
          )}
          <span className="text-lg leading-none" style={{ color: muted }}>×</span>
        </div>
      )}

      <div className="relative flex-1 space-y-4 overflow-hidden px-3 pt-2">
        {focus === 'loading' ? (
          <LoadingPreview design={normalizeLoading(get(v2, 'intro_screen.loadingState.design'))} brand={brand} />
        ) : null}
        {focus === 'toast' && <ToastPreview design={normalizeToast(c.toast_design)} brand={brand} text={get(v2, 'messages.feedback.toastMessage')} />}
        {focus === 'prechat' && (
          <PreChatPreview
            design={normalizePreChat(get(v2, 'pre_chat_form.design'))}
            brand={brand}
            message={get(v2, 'pre_chat_form.message') || 'Share your queries or comments here.'}
            fields={get(v2, 'pre_chat_form.fields')}
          />
        )}
        {focus === 'consent' && (
          <ConsentPreview design={normalizeConsent(get(v2, 'consent_screen.design'))} brand={brand} cs={get(v2, 'consent_screen') ?? {}} />
        )}
        {focus === 'rating' && (
          <CsatPreview design={normalizeCsat(get(v2, 'csat.design'))} brand={brand} texts={get(v2, 'csat') ?? {}} />
        )}
        {focus === 'loading' || focus === 'prechat' || focus === 'rating' ? null : (
        <>
        {heroEnabled && (
          hero.slides.length ? (
            <HeroCarousel
              slides={hero.slides}
              carousel={hero.carousel}
              brand={brand}
              rtl={widgetDir === 'rtl'}
              badgeFallback={title}
              overlay={(slide) =>
                // The widget overlays its welcome copy on the hero, but a designed
                // slide may carry its own — drawing both would double the text.
                slide.type === 'design' && (slide.design.title.show || slide.design.subtitle.show) ? null : (
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                    <p className="text-[15px] font-extrabold leading-tight">{welcomeTitle || t('preview.welcome')}</p>
                    {welcomeSub && <p className="mt-0.5 line-clamp-2 text-[10px] opacity-90">{welcomeSub}</p>}
                  </div>
                )
              }
            />
          ) : (
            <div
              className="relative flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-xl p-3 text-white transition-all duration-300"
              style={{ background: `linear-gradient(135deg, ${brand}, ${shade(brand, -40)})` }}
            >
              <p className="text-[15px] font-extrabold leading-tight">{welcomeTitle || t('preview.welcome')}</p>
              {welcomeSub && <p className="mt-0.5 line-clamp-2 text-[10px] opacity-90">{welcomeSub}</p>}
            </div>
          )
        )}
        {!heroEnabled && welcomeTitle && (
          <div>
            <p className="text-[17px] font-extrabold leading-tight">{welcomeTitle}</p>
            {welcomeSub && <p className="mt-0.5 text-[11.5px]" style={{ color: muted }}>{welcomeSub}</p>}
          </div>
        )}

        {quickLinks.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-[11.5px] font-bold">
              <span style={{ color: brand }} className="rtl:-scale-x-100">‹</span>
              {quickLinksTitle}
            </p>
            <style>{cardHoverCss(ql, brand, '.pv-card')}</style>
            <div
              ref={cardTrackRef}
              className={
                ql.layout === 'stack'
                  ? 'flex flex-col'
                  : ql.layout === 'grid'
                    ? 'grid grid-cols-2'
                    : 'flex overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              }
              style={{ gap: ql.gap }}
            >
              {quickLinks.map((q, i) => (
                <button
                  key={q.id ?? i}
                  type="button"
                  onClick={() => setSent(String(q.message ?? '').trim() || String(q.title ?? '').trim() || null)}
                  className="pv-card flex shrink-0 cursor-pointer flex-col overflow-hidden transition-all duration-200 active:scale-95"
                  style={{
                    ...(cardCss(ql, brand) as CSSProperties),
                    width: ql.layout === 'carousel' ? ql.cardWidth * 1.6 : undefined,
                    ...cardStyle,
                  }}
                >
                  {ql.showImage && ql.imageHeight > 0 && (
                    <div
                      style={{
                        height: ql.imageHeight,
                        borderRadius: ql.imageRadius,
                        background: q.url
                          ? `url(${q.url}) center/${ql.imageFit} no-repeat`
                          : `linear-gradient(135deg, ${shade(brand, 20)}, ${brand})`,
                      }}
                    />
                  )}
                  <div className={ql.showImage && ql.imageHeight > 0 ? 'pt-2' : ''}>
                    {ql.showTitle && <p className="truncate" style={cardTextCss(ql, brand) as CSSProperties}>{q.title}</p>}
                    {ql.showSubtitle && (
                      <p className="line-clamp-2" style={cardSubtitleCss(ql, brand) as CSSProperties}>{q.subtitle}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {prompts.length > 0 && (
          <div>
            <style>{chipHoverCss(pr, brand, '.pv-chip')}</style>
            {pr.showTitle && (
              <p
                className="mb-2 uppercase tracking-[0.09em]"
                style={{
                  color: rs(pr.titleColor),
                  fontSize: pr.titleSize,
                  fontWeight: pr.titleWeight,
                  fontFamily: pr.titleFont || undefined,
                }}
              >
                {promptTitle}
              </p>
            )}
            <div
              className={
                pr.layout === 'stack'
                  ? 'flex flex-col items-start'
                  : pr.layout === 'scroll'
                    ? 'flex overflow-x-auto pb-1'
                    : 'flex flex-wrap items-start'
              }
              style={{ gap: pr.gap }}
            >
              {prompts.slice(0, 4).map((p, i) => (
                <span
                  key={i}
                  className={`pv-chip inline-flex shrink-0 items-center transition-colors duration-200 ${pr.iconPosition === 'end' ? 'flex-row-reverse' : ''}`}
                  style={{ ...(chipCss(pr, brand) as CSSProperties), gap: pr.showIcon ? 6 : 0, ...chipStyle }}
                >
                  {pr.showIcon && (
                    <SlotIcon
                      // A prompt may carry its own icon; otherwise it takes the one set for all of them.
                      name={p.icon || pr.icon}
                      url={p.icon === 'custom' ? p.iconUrl : pr.iconUrl}
                      size={pr.iconSize}
                      color={rs(pr.iconColor)}
                    />
                  )}
                  {p.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* The message a tapped card sends, styled like the visitor's chat bubble */}
        {sent && (
          <div className="anim-pop flex justify-end">
            <span
              dir="auto"
              className="max-w-[80%] break-words rounded-2xl rounded-ee-md px-3.5 py-2 text-start text-[11.5px] leading-[1.5]"
              style={{
                background: get(v2, 'messages.customerMessages.bubbleStyle.backgroundColor') || brand,
                color: get(v2, 'messages.customerMessages.TextStyles.color') || '#ffffff',
                border: get(v2, 'messages.customerMessages.bubbleStyle.borderColor')
                  ? `1px solid ${get(v2, 'messages.customerMessages.bubbleStyle.borderColor')}`
                  : undefined,
              }}
            >
              {sent}
            </span>
          </div>
        )}
        </>
        )}
      </div>

      <div
        style={{
          background: ci.container.background === 'transparent' ? undefined : rs(ci.container.background),
          paddingInline: ci.container.paddingX,
          paddingTop: ci.container.paddingTop,
          paddingBottom: ci.container.paddingBottom,
        }}
      >
        {/* The composer, drawn from the same compiled values the widget is sent.
            The focus ring needs a rule rather than an inline style, so it rides
            along in a scoped <style>. */}
        <style>{`${focusCss(ci, brand, '.pv-input')}${hoverCss(ci, brand, '.pv-send', '.pv-action')}
          .pv-field::placeholder{color:${rs(ci.placeholder.color)};font-size:${ci.placeholder.size}px;font-weight:${ci.placeholder.weight};font-style:${ci.placeholder.italic ? 'italic' : 'normal'}}`}</style>
        <div dir={inputDir} className="flex items-center" style={{ gap: ci.field.gap }}>
          <div
            className={`pv-input flex min-w-0 flex-1 items-center transition-all duration-300 ${ci.layout === 'inset_card' ? 'shadow-inner' : ''}`}
            style={{ ...(inputCss(ci, brand) as CSSProperties), ...(get(v2, 'chat_input.styles') ?? {}) }}
          >
            {ci.actions.attach && (
              <span className="pv-action grid shrink-0 place-items-center transition-colors duration-200" style={actionCss(ci, brand) as CSSProperties}>
                <SlotIcon name={ci.actions.attachIcon} url={ci.actions.attachUrl} size={ci.actions.iconSize} />
              </span>
            )}
            {/* A real field, not a mock-up of one: typing in it is how the typed-text
                styles, the placeholder and the focus ring become visible at all.
                dir="auto" keeps bidi punctuation on the reading side of the text. */}
            <input
              dir="auto"
              className="pv-field min-w-0 flex-1 border-0 bg-transparent px-1 text-start outline-none"
              style={textCss(ci, brand) as CSSProperties}
              placeholder={placeholder}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={placeholder}
            />
            <span className="flex shrink-0 items-center" style={{ gap: ci.actions.gap }}>
              {ci.actions.emoji && (
                <span className="pv-action grid shrink-0 place-items-center transition-colors duration-200" style={actionCss(ci, brand) as CSSProperties}>
                  <SlotIcon name={ci.actions.emojiIcon} url={ci.actions.emojiUrl} size={ci.actions.iconSize} />
                </span>
              )}
              {ci.actions.voice && (
                <span className="pv-action grid shrink-0 place-items-center transition-colors duration-200" style={actionCss(ci, brand) as CSSProperties}>
                  <SlotIcon name={ci.actions.voiceIcon} url={ci.actions.voiceUrl} size={ci.actions.iconSize} />
                </span>
              )}
              {ci.send.position === 'inside' && <SendButton ci={ci} brand={brand} v2={v2} idle={!typed.trim()} />}
            </span>
          </div>
          {ci.send.position === 'outside' && <SendButton ci={ci} brand={brand} v2={v2} idle={!typed.trim()} />}
        </div>
        {poweredBy && (
          <p className="mt-1.5 text-center text-[9px]" style={{ color: muted }}>
            <span className="inline-flex items-center gap-1 align-middle">
              {t('preview.poweredBy')} <PairWordmark className="inline h-[9px]" />
            </span>
          </p>
        )}
      </div>
    </div>
  )
})

/** The default pre-chat fields, for a config the studio has not seeded yet. */
const PREVIEW_PC_FIELDS = [
  { name: 'emailAddress', type: 'email', label: 'Email Id', placeholder: 'emailAddress', required: true, enabled: true },
  { name: 'fullName', type: 'text', label: 'Full name', placeholder: 'fullName', required: false, enabled: true },
  { name: 'phoneNumber', type: 'text', label: 'Phone number', placeholder: 'phoneNumber', required: true, enabled: true },
]

/** The pre-chat form, drawn from the same compiled values the widget is sent. */
function PreChatPreview({ design, brand, message, fields }: { design: PreChatDesign; brand: string; message: string; fields?: unknown }) {
  const d = design
  const rs = (v: string) => resolve(v, brand)
  const rows = (Array.isArray(fields) && fields.length ? fields : PREVIEW_PC_FIELDS).filter(
    (f: Record<string, unknown>) => f.enabled !== false,
  )
  const inputStyle: CSSProperties = {
    background: rs(d.field.background),
    borderWidth: d.field.borderWidth,
    borderStyle: d.field.borderStyle,
    borderColor: rs(d.field.borderColor),
    borderRadius: d.field.radius,
    minHeight: Math.min(d.field.height, 34),
    color: rs(d.field.placeholderColor),
    fontSize: Math.min(d.field.textSize, 11),
    paddingInline: 10,
    display: 'flex',
    alignItems: 'center',
  }
  const labelStyle: CSSProperties = {
    color: rs(d.labels.color),
    fontSize: Math.min(d.labels.size, 11),
    fontWeight: d.labels.weight,
  }
  const card = d.card.enabled
    ? ({
        background: rs(d.card.background),
        border: `${d.card.borderWidth}px solid ${rs(d.card.borderColor)}`,
        borderRadius: d.card.radius,
        padding: d.card.padding,
        boxShadow: shadowCss(d.card.shadow, brand),
      } as CSSProperties)
    : undefined
  const row = (label: string, ph: string, required: boolean, i: number) => (
    <div key={i}>
      {d.labels.show && (
        <p className="mb-1" style={labelStyle}>
          {label}
          {required && <span style={{ color: rs(d.labels.requiredColor) }}> *</span>}
        </p>
      )}
      <div style={inputStyle}>{ph}</div>
    </div>
  )
  return (
    <div className="anim-pop relative" style={card}>
      {d.backdrop.url && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: `url(${d.backdrop.url})`, backgroundSize: `${Math.min(d.backdrop.size, 160)}px auto`, backgroundRepeat: 'repeat', opacity: d.backdrop.opacity }}
        />
      )}
      {d.banner.show && d.banner.url && (
        <img src={d.banner.url} alt="" className="mb-3 w-full" style={{ height: Math.min(d.banner.height, 72), objectFit: d.banner.fit, borderRadius: d.banner.radius }} />
      )}
      <p
        className="mb-3"
        style={{ color: rs(d.message.color), fontSize: Math.min(d.message.size, 12), fontWeight: d.message.weight, textAlign: d.message.align as CSSProperties['textAlign'] }}
      >
        {message}
      </p>
      <div className="flex flex-col" style={{ gap: Math.min(d.field.gap, 12) }}>
        {rows.map((f: Record<string, string | boolean>, i: number) => row(String(f.label ?? f.name), String(f.placeholder ?? ''), f.required === true, i))}
        {d.showMessage &&
          row(d.messageLabel, d.messagePlaceholder, true, 98)}
        <span
          className="grid place-items-center"
          style={{
            background: rs(d.button.background),
            color: rs(d.button.textColor),
            borderRadius: d.button.radius,
            height: Math.min(d.button.height, 36),
            fontSize: Math.min(d.button.textSize, 12),
            fontWeight: d.button.weight,
            width: d.button.fullWidth ? '100%' : 'fit-content',
            paddingInline: 16,
            boxShadow: shadowCss(d.button.shadow, brand),
          }}
        >
          {d.buttonText}
        </span>
      </div>
    </div>
  )
}

/** The rating survey: the in-conversation card, and the sheet as a tap opens it. */
function CsatPreview({ design, brand, texts }: { design: CsatDesign; brand: string; texts: Record<string, any> }) {
  const d = design
  const rs = (v: string) => resolve(v, brand)
  const header = texts.header || 'Customer Satisfaction Survey'
  const body = texts.body || 'How was your experience?'
  const button = texts.buttonText || 'Rate Experience'
  const submit = texts.submitText || 'Submit Feedback'
  const stars = d.forceType !== 'text_options'
  const chips = ['1 Star', '2 Star', '3 Star', '4 Star', '5 Star']
  const btn = (b: CsatDesign['submit'], extra?: CSSProperties) => ({
    fontFamily: b.fontFamily || undefined,
    fontSize: Math.min(b.textSize, 12),
    color: rs(b.textColor),
    background: rs(b.background),
    borderRadius: b.radius,
    border: b.borderWidth > 0 ? `${b.borderWidth}px solid ${rs(b.borderColor)}` : undefined,
    height: Math.min(b.height, 38),
    ...extra,
  })
  return (
    <div className="anim-pop flex h-full flex-col justify-between gap-3">
      {/* The card as it lands in the conversation after a resolve */}
      <div
        style={{
          background: rs(d.card.background),
          border: `${d.card.borderWidth}px solid ${rs(d.card.borderColor)}`,
          borderRadius: d.card.radius,
          padding: Math.min(d.card.padding, 16),
          boxShadow: shadowCss(d.card.shadow, brand),
        }}
      >
        <p className="uppercase" style={{ color: rs(d.header.color), fontSize: Math.min(d.header.size, 10), fontWeight: d.header.weight }}>{header}</p>
        <p className="mt-0.5" style={{ color: rs(d.body.color), fontSize: Math.min(d.body.size, 13), fontWeight: d.body.weight }}>{body}</p>
        <span
          className="mt-2.5 grid place-items-center"
          style={btn({ ...d.trigger }, { width: d.trigger.fullWidth ? '100%' : 'fit-content', marginInline: 'auto', paddingInline: 12 })}
        >
          {button}
        </span>
      </div>
      {/* The opened sheet */}
      <div
        className="rounded-t-2xl"
        style={{ background: rs(d.dialog.background), boxShadow: '0 -8px 30px rgba(0,0,0,.12)' }}
      >
        <p
          className="flex items-center justify-between border-b px-4 py-3 font-semibold"
          style={{ color: rs(d.dialog.titleColor), borderColor: rs(d.dialog.dividerColor), fontSize: 13 }}
        >
          {body}<span style={{ opacity: 0.5 }}>×</span>
        </p>
        <div className="flex flex-wrap gap-1.5 p-4">
          {stars ? (
            <span className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width={Math.min(d.stars.size, 18)} height={Math.min(d.stars.size, 18)} viewBox="0 0 24 24" fill={i <= 4 ? rs(d.stars.color) : 'none'} stroke={rs(d.stars.color)} strokeWidth="1.6"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" /></svg>
              ))}
            </span>
          ) : (
            chips.map((c, i) => (
              <span
                key={c}
                style={{
                  fontSize: Math.min(d.chips.textSize, 11),
                  borderRadius: d.chips.radius,
                  padding: '4px 10px',
                  background: i === 1 ? rs(d.chips.selectedBackground) : rs(d.chips.background),
                  border: `1px solid ${i === 1 ? rs(d.chips.selectedBorderColor) : rs(d.chips.borderColor)}`,
                  color: i === 1 ? rs(d.chips.selectedTextColor) : rs(d.chips.textColor),
                }}
              >
                {c}
              </span>
            ))
          )}
        </div>
        <div className="px-4 pb-4">
          <span className="grid place-items-center" style={btn(d.submit, { width: '100%' })}>{submit}</span>
        </div>
      </div>
    </div>
  )
}

/** The consent sheet, pinned over the intro the way the widget shows it. */
function ConsentPreview({ design, brand, cs }: { design: ConsentDesign; brand: string; cs: Record<string, any> }) {
  const d = design
  const rs = (v: string) => resolve(v, brand)
  const points: Array<{ icon?: string; text?: string }> = Array.isArray(cs.points) && cs.points.length
    ? cs.points
    : [
        { icon: 'chat-text', text: 'This assistant helps you discover films and track bookings.' },
        { icon: 'alert', text: 'AI suggestions may occasionally be incorrect.' },
        { icon: 'shield', text: 'Your interactions may be used to improve recommendations.' },
      ]
  return (
    <div
      className="absolute inset-0 z-10 flex items-end p-3"
      style={{ background: `color-mix(in srgb, ${rs(d.overlayColor)} ${Math.round(d.overlayOpacity * 100)}%, transparent)` }}
    >
      <div
        className="anim-pop w-full text-center"
        style={{ background: rs(d.card.background), borderRadius: d.card.radius, padding: Math.min(d.card.padding, 16), boxShadow: shadowCss(d.card.shadow, brand) }}
      >
        {d.showIllustration && (
          <span
            className="mx-auto mb-2 grid size-10 place-items-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${brand} 8%, transparent)`, color: brand }}
          >
            <SlotIcon name="doc" size={20} />
          </span>
        )}
        <p style={{ color: rs(d.title.color), fontSize: Math.min(d.title.size, 14), fontWeight: d.title.weight }}>
          {cs.title || 'Welcome to your AI Assistant'}
        </p>
        {(cs.subtitle ?? 'A few things to keep in mind') && (
          <p className="mt-0.5" style={{ color: rs(d.subtitle.color), fontSize: Math.min(d.subtitle.size, 10.5), fontWeight: d.subtitle.weight }}>
            {cs.subtitle || 'A few things to keep in mind'}
          </p>
        )}
        <div className="mt-2.5 flex flex-col text-start" style={{ gap: Math.min(d.points.gap, 9) }}>
          {points.map((pt, i) => (
            <span key={i} className="flex items-start gap-2">
              <SlotIcon name={pt.icon || 'info'} size={Math.min(d.points.iconSize, 12)} color={rs(d.points.iconColor)} className="mt-0.5" />
              <span style={{ color: rs(d.points.textColor), fontSize: Math.min(d.points.textSize, 10), lineHeight: 1.45 }}>{pt.text}</span>
            </span>
          ))}
        </div>
        {(cs.footnote ?? true) && (
          <p className="mt-2.5" style={{ color: rs(d.footnote.color), fontSize: Math.min(d.footnote.size, 8.5) }}>
            {cs.footnote || 'By continuing, you agree to our Terms of Use and Privacy Policy'}
          </p>
        )}
        {(() => {
          const raw = (cs.links ?? {}) as Record<string, any>
          const links = [
            { show: raw.terms?.show !== false, label: raw.terms?.label || 'Terms of Use', url: raw.terms?.url },
            { show: raw.privacy?.show !== false, label: raw.privacy?.label || 'Privacy Policy', url: raw.privacy?.url },
          ].filter((l) => l.show && l.url)
          if (!links.length) return null
          return (
            <p className="mt-1" style={{ fontSize: Math.min(d.footnote.size, 8.5) + 0.5 }}>
              {links.map((l, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1" style={{ color: rs(d.footnote.color) }}>·</span>}
                  <span
                    style={{
                      color: resolve(typeof raw.color === 'string' ? raw.color : '#brand', brand),
                      textDecoration: raw.underline === false ? 'none' : 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    {l.label}
                  </span>
                </span>
              ))}
            </p>
          )
        })()}
        <span
          className="mt-2.5 grid place-items-center"
          style={{
            background: rs(d.button.background),
            color: rs(d.button.textColor),
            borderRadius: d.button.radius,
            height: Math.min(d.button.height, 32),
            fontSize: Math.min(d.button.textSize, 11),
            fontWeight: d.button.weight,
            width: d.button.fullWidth ? '100%' : 'fit-content',
            marginInline: d.button.fullWidth ? undefined : 'auto',
            paddingInline: 14,
          }}
        >
          {cs.buttonText || 'Agree & Continue'}
        </span>
      </div>
    </div>
  )
}

/**
 * The loading placeholder, drawn from the config so every value is visible as
 * it is set. The sweep and the bounce live in styles.css, driven by the custom
 * properties this sets.
 */
function LoadingPreview({ design, brand }: { design: LoadingDesign; brand: string }) {
  const d = design
  const label = d.labelShow && d.labelText.trim() ? d.labelText : ''
  const caption = label && (
    <p className="mt-3 text-center" style={{ color: resolve(d.labelColor, brand), fontSize: d.labelSize }}>
      {label}
    </p>
  )

  if (d.type === 'spinner' || d.type === 'dots') {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={loadingCss(d, brand) as CSSProperties}>
        {d.type === 'spinner' ? (
          <span
            className="pv-spin inline-block rounded-full"
            style={{
              width: d.spinnerSize,
              height: d.spinnerSize,
              borderWidth: d.spinnerThickness,
              borderStyle: 'solid',
              borderColor: resolve(d.baseColor, brand),
              borderTopColor: resolve(d.spinnerColor, brand),
              animationDuration: `${d.speedMs}ms`,
            }}
          />
        ) : (
          <span className="flex items-end" style={{ gap: Math.max(2, d.spinnerSize / 4) }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="pv-dot inline-block rounded-full"
                style={{
                  width: d.spinnerSize / 2.5,
                  height: d.spinnerSize / 2.5,
                  background: resolve(d.spinnerColor, brand),
                  animationDuration: `${d.speedMs}ms`,
                  animationDelay: `${i * (d.speedMs / 6)}ms`,
                }}
              />
            ))}
          </span>
        )}
        {caption}
      </div>
    )
  }

  const block = d.type === 'pulse' ? 'pv-skel-pulse' : 'pv-skel'
  return (
    <div style={loadingCss(d, brand) as CSSProperties}>
      <div className="flex flex-col gap-2">
        {Array.from({ length: d.lines }, (_, i) => (
          <span key={i} className={block} style={{ height: d.lineHeight, width: i === d.lines - 1 ? '72%' : '100%' }} />
        ))}
      </div>
      {d.cards > 0 && (
        <div className="mt-3 flex gap-2">
          {Array.from({ length: d.cards }, (_, i) => (
            <span key={i} className={`${block} flex-1`} style={{ height: Math.min(d.cardHeight, 240) }} />
          ))}
        </div>
      )}
      {caption}
    </div>
  )
}

/** The toast, pinned where the config puts it so the position is what is judged. */
function ToastPreview({ design, brand, text }: { design: ToastDesign; brand: string; text?: string }) {
  const d = design
  const [top, side] = d.position.split('-')
  const message = (text ?? '').trim() || 'Thanks for your feedback.'
  return (
    <div
      className="pointer-events-none absolute z-10 flex"
      style={{
        [top === 'top' ? 'top' : 'bottom']: d.offset,
        left: side === 'left' ? d.offset : side === 'center' ? 0 : undefined,
        right: side === 'right' ? d.offset : side === 'center' ? 0 : undefined,
        justifyContent: side === 'center' ? 'center' : undefined,
      } as CSSProperties}
    >
      <span
        className="anim-pop inline-flex items-center gap-2 whitespace-nowrap"
        style={toastCss(d, brand) as CSSProperties}
      >
        {d.showIcon && <Check className="size-3.5 shrink-0" style={{ color: resolve(d.iconColor, brand) }} />}
        {message}
      </span>
    </div>
  )
}

/**
 * The launcher, as the visitor first meets it: pinned to its corner of the
 * frame at its own offsets, so size, radius, colour, icon, label and motion are
 * all visible as they are edited.
 */
function LauncherPreview({ design, brand, title }: { design: LauncherDesign; brand: string; title?: string }) {
  const d = design
  // 'none' has no launcher to draw: the panel simply opens by itself.
  if (d.type === 'none') return null
  const label = (d.label.text || title || '').trim()
  const showLabel = d.type === 'expanded_bubble' && d.label.show && !!label
  const attention = d.attention === 'none' ? '' : `pv-launch-${d.attention}`
  // The entrance plays once per change, so re-keying on it replays the choice
  // as soon as it is made rather than only on the next reload.
  const entrance = d.entrance === 'none' ? '' : `pv-enter-${d.entrance}`

  return (
    <div
      className="absolute"
      style={{
        bottom: d.offsetY,
        [d.position === 'left' ? 'left' : 'right']: d.offsetX,
      } as CSSProperties}
    >
      <style>{launcherHoverCss(d, '.pv-launcher')}</style>
      <div key={`${d.entrance}-${d.attention}`} className={entrance}>
        <div
          className={`pv-launcher flex items-center justify-center overflow-hidden ${attention}`}
          style={{
            ...(launcherCss(d, brand) as CSSProperties),
            width: showLabel ? undefined : d.size,
            height: d.size,
            gap: showLabel ? 8 : undefined,
            paddingInline: showLabel ? 16 : undefined,
          }}
        >
          <SlotIcon name={d.icon} url={d.iconUrl} size={d.iconSize} color={resolve(d.iconColor, brand)} />
          {showLabel && (
            <span
              className="truncate whitespace-nowrap"
              style={{ color: resolve(d.label.color, brand), fontSize: d.label.size, fontWeight: d.label.weight, fontFamily: d.label.fontFamily || undefined }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** The send button. Used inside the field or beside it, per the config. */
function SendButton({ ci, brand, v2, idle }: { ci: ChatInputDesign; brand: string; v2: Record<string, any>; idle: boolean }) {
  const legacy = (v2.chat_input?.sendButtonIcon?.styles ?? {}) as Record<string, string>
  return (
    <span
      className="pv-send flex shrink-0 items-center justify-center transition-all duration-200"
      style={{
        // The widget disables send until there is something to send, so the
        // preview does too — which is what makes that opacity visible here.
        opacity: idle ? ci.send.disabledOpacity : 1,
        backgroundColor: legacy.backgroundColor || resolve(ci.send.background, brand),
        width: ci.send.size,
        height: ci.send.size,
        borderRadius: ci.send.shape === 'circle' ? 999 : ci.send.shape === 'square' ? 0 : ci.send.radius,
        boxShadow: shadowCss(ci.send.shadow, brand),
      }}
    >
      <SendIcon
        name={asSendIcon(ci.send.icon)}
        url={ci.send.url || v2.chat_input?.sendButtonIcon?.url}
        style={{ width: ci.send.iconSize, height: ci.send.iconSize, color: legacy.iconColor || resolve(ci.send.iconColor, brand) }}
      />
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Device stage: wraps the widget preview in an iPhone, Android or website
 * frame, portrait or landscape. Sizes are the outer frame dimensions that
 * FitScale scales down to fit the page.
 * ------------------------------------------------------------------------- */
export type PreviewDevice = 'iphone' | 'android' | 'web'

const DEVICE_SIZES: Record<PreviewDevice, { w: number; h: number }> = {
  iphone: { w: 392, h: 800 },
  android: { w: 384, h: 812 },
  web: { w: 1180, h: 740 },
}

export function stageSize(device: PreviewDevice, landscape: boolean): { w: number; h: number } {
  const s = DEVICE_SIZES[device]
  return device !== 'web' && landscape ? { w: s.h, h: s.w } : s
}

export function PreviewStage({ config, dark, device, landscape, liveUrl }: { config: WidgetConfig | null; dark?: boolean; device: PreviewDevice; landscape: boolean; liveUrl?: string }) {
  if (device === 'web') return <WebFrame config={config} dark={dark} liveUrl={liveUrl} />
  return <PhoneFrame device={device} landscape={landscape} config={config} dark={dark} liveUrl={liveUrl} />
}

function PhoneFrame({ device, landscape, config, dark, liveUrl }: { device: PreviewDevice; landscape: boolean; config: WidgetConfig | null; dark?: boolean; liveUrl?: string }) {
  const iphone = device === 'iphone'
  return (
    <div className={`size-full bg-ink shadow-[0_18px_50px_rgba(15,18,22,0.35)] ${iphone ? 'rounded-[54px] p-[11px]' : 'rounded-[36px] p-[9px]'}`}>
      <div className={`relative size-full overflow-hidden bg-white ${iphone ? 'rounded-[44px]' : 'rounded-[28px]'}`}>
        {liveUrl ? (
          <iframe src={liveUrl} title="Live widget" className="size-full border-0" />
        ) : (
          <WidgetPreview config={config} dark={dark} frame={false} topInset={landscape ? 12 : 34} />
        )}
        {/* Camera cutout: Dynamic-Island pill on iPhone, punch-hole dot on Android */}
        {!landscape && (
          iphone ? (
            <span className="pointer-events-none absolute left-1/2 top-[11px] h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-ink" />
          ) : (
            <span className="pointer-events-none absolute left-1/2 top-[12px] size-[14px] -translate-x-1/2 rounded-full bg-ink" />
          )
        )}
      </div>
    </div>
  )
}

/** A mock customer page with the widget open above its launcher, honouring launcher_position. */
function WebFrame({ config, dark, liveUrl }: { config: WidgetConfig | null; dark?: boolean; liveUrl?: string }) {
  const c = (config ?? {}) as Any
  const brand: string = c.widget_color || '#4d98e2'
  const left = c.launcher_position === 'left'
  const pageBg = dark ? '#101317' : '#eef1f5'
  const blockBg = dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,18,22,0.07)'
  const chromeBg = dark ? '#1a1e24' : '#f7f8fa'

  return (
    <div dir="ltr" className="flex size-full flex-col overflow-hidden rounded-xl shadow-[0_18px_50px_rgba(15,18,22,0.25)] ring-1 ring-ink/15">
      <div className="flex shrink-0 items-center gap-2 border-b border-ink/10 px-4 py-2.5" style={{ background: chromeBg }}>
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span
          className="mono ms-3 flex-1 truncate rounded-md px-3 py-1 text-[11px]"
          style={{ background: blockBg, color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(15,18,22,0.5)' }}
        >
          customer-site.com
        </span>
      </div>

      {liveUrl ? (
        <iframe src={liveUrl} title="Live widget" className="size-full flex-1 border-0" />
      ) : (
      <div className="relative flex-1 overflow-hidden p-6" style={{ background: pageBg }}>
        {/* Skeleton of the customer's page */}
        <div className="flex items-center gap-3">
          <span className="size-8 rounded-lg" style={{ background: brand }} />
          <span className="h-3 w-24 rounded-full" style={{ background: blockBg }} />
          <span className="ms-auto flex gap-2">
            <span className="h-3 w-14 rounded-full" style={{ background: blockBg }} />
            <span className="h-3 w-14 rounded-full" style={{ background: blockBg }} />
            <span className="h-3 w-14 rounded-full" style={{ background: blockBg }} />
          </span>
        </div>
        <div className="mt-6 h-40 rounded-xl" style={{ background: blockBg }} />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="h-28 rounded-xl" style={{ background: blockBg }} />
          <div className="h-28 rounded-xl" style={{ background: blockBg }} />
          <div className="h-28 rounded-xl" style={{ background: blockBg }} />
        </div>

        {/* The widget, open above its launcher */}
        <div className={`absolute bottom-[86px] w-[320px] ${left ? 'left-6' : 'right-6'}`} style={{ height: 520 }}>
          <div className="size-full overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(15,18,22,0.35)] ring-1 ring-ink/10">
            <WidgetPreview config={config} dark={dark} frame={false} />
          </div>
        </div>
        <span
          className={`absolute bottom-6 grid size-[52px] place-items-center rounded-full text-white shadow-lg ${left ? 'left-6' : 'right-6'}`}
          style={{ background: brand }}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      </div>
      )}
    </div>
  )
}

function isDarkColor(input: string): boolean {
  const m = /#([0-9a-f]{6})/i.exec(input)
  if (!m) return /black|#000|rgb\(0/i.test(input)
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

function shade(hex: string, amt: number): string {
  const m = /#([0-9a-f]{6})/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const cl = (v: number) => Math.max(0, Math.min(255, v))
  const r = cl(((n >> 16) & 255) + amt),
    g = cl(((n >> 8) & 255) + amt),
    b = cl((n & 255) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
