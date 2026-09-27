import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { WidgetConfig } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { normalizeHeroCarousel, normalizeHeroSlides, type HeroSlide } from '@/lib/heroDesign'
import {
  actionCss, focusCss, hoverCss, inputCss, launcherCss, launcherHoverCss, loadingCss,
  cardCss, cardHoverCss, cardSubtitleCss, cardTextCss, chipCss, chipHoverCss,
  normalizeChatInput, normalizeLauncher, normalizeLoading, normalizeQuickLinks,
  normalizePrompts as normalizeChatInputPrompts, normalizeToast, resolve, shadowCss,
  textCss, toastCss, type ChatInputDesign, type LauncherDesign, type LoadingDesign, type ToastDesign,
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
  const surface = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
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
        // The real widget keeps this row LTR in both languages: ⋮ · lang badge · title, then avatar · ×.
        <div dir="ltr" className="flex items-center gap-2 px-3 py-3 transition-colors duration-300" style={{ background: headerBg }}>
          <span className="text-base leading-none" style={{ color: muted }}>⋮</span>
          <span className="shrink-0 rounded-sm px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: surface }}>
            {widgetDir === 'rtl' ? 'EN' : 'عربي'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold" style={titleStyle}>{title}</p>
            {subtitle && <p className="truncate text-[10px]" style={{ color: muted }}>{subtitle}</p>}
          </div>
          {c.avatar_url ? (
            <img src={c.avatar_url} alt="" className="size-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="size-6 shrink-0 rounded-full transition-colors duration-300" style={{ background: brand }} />
          )}
          <span className="text-lg leading-none" style={{ color: muted }}>×</span>
        </div>
      )}

      <div className="relative flex-1 space-y-4 overflow-hidden px-3 pt-2">
        {focus === 'loading' ? (
          <LoadingPreview design={normalizeLoading(get(v2, 'intro_screen.loadingState.design'))} brand={brand} />
        ) : null}
        {focus === 'toast' && <ToastPreview design={normalizeToast(c.toast_design)} brand={brand} text={get(v2, 'messages.feedback.toastMessage')} />}
        {focus === 'loading' ? null : (
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
