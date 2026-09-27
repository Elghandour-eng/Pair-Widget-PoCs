import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Mic, Plus } from 'lucide-react'
import type { WidgetConfig } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { normalizeHeroCarousel, normalizeHeroSlides, type HeroSlide } from '@/lib/heroDesign'
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

export const WidgetPreview = memo(function WidgetPreview({ config, dark, frame = true, topInset = 0 }: { config: WidgetConfig | null; dark?: boolean; frame?: boolean; topInset?: number }) {
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

  // Message "sent" by tapping a quick-link card; clears itself like a real send.
  const [sent, setSent] = useState<string | null>(null)
  useEffect(() => {
    if (!sent) return
    const id = setTimeout(() => setSent(null), 3200)
    return () => clearTimeout(id)
  }, [sent])

  // The channel's own font, pulled in so the preview renders it rather than a fallback.
  useWebFont((config as Any)?.styles?.fontFamily)

  if (!config) {
    return (
      <div className="card-soft flex size-full items-center justify-center p-6 text-center text-[12.5px] text-faint/80">
        {t('preview.none')}
      </div>
    )
  }

  const c = config as Any
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
  const prompts: Any[] = get(v2, 'trending_prompts.showTrendingPrompts.value') === false ? [] : (get(v2, 'trending_prompts.promptChips') ?? [])
  const promptTitle = get(v2, 'trending_prompts.displaySettings.sectionTitle') || t('preview.tryAsking')
  const placeholder = get(v2, 'chat_input.placeholderText.text') || t('preview.placeholder')
  const inputLayout = get(v2, 'chat_input.inputLayout.type') || 'floating_pill'
  const voice = get(v2, 'chat_input.inputActions.voiceMessages') !== false
  const attach = get(v2, 'chat_input.inputActions.attachmentMenu') !== false
  // Action icons default to the muted text colour; a channel can pin its own.
  const actionColor = get(v2, 'chat_input.inputActions.iconColor')
  const sendIcon = asSendIcon(get(v2, 'chat_input.sendButtonIcon.icon'))
  const poweredBy = c.powered_by_pair_ai !== false

  const locale: string = typeof c.locale === 'string' ? c.locale : 'en'
  const widgetDir = /^(ar|he|fa|ur)/i.test(locale) ? 'rtl' : 'ltr'
  // The input row can pin its own direction from the builder; 'auto' follows the widget language.
  const inputDirCfg = get(v2, 'chat_input.direction')
  const inputDir: 'rtl' | 'ltr' = inputDirCfg === 'rtl' || inputDirCfg === 'ltr' ? inputDirCfg : widgetDir

  const isDark = dark || isDarkColor(bg)
  const fg = isDark ? '#f5f5f5' : '#0f1216'
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'
  const surface = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const titleStyle: CSSProperties = { ...(get(v2, 'header.titleStyle') ?? {}) }
  const cardStyle: CSSProperties = { ...(get(v2, 'quick_links.cardStyle') ?? {}) }
  const chipStyle: CSSProperties = { ...(get(v2, 'trending_prompts.chipStyle') ?? {}) }

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

      <div className="flex-1 space-y-4 overflow-hidden px-3 pt-2">
        {heroEnabled && (
          hero.slides.length ? (
            <HeroCarousel
              slides={hero.slides}
              carousel={hero.carousel}
              brand={brand}
              rtl={widgetDir === 'rtl'}
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
              {t('preview.help')}
            </p>
            <div className="flex gap-2 overflow-hidden">
              {quickLinks.slice(0, 3).map((q, i) => (
                <button
                  key={q.id ?? i}
                  type="button"
                  onClick={() => setSent(String(q.message ?? '').trim() || String(q.title ?? '').trim() || null)}
                  className="w-[150px] shrink-0 cursor-pointer overflow-hidden rounded-lg text-start transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  style={{ background: surface, ...cardStyle }}
                >
                  <div className="h-20" style={{ background: q.url ? `url(${q.url}) center/cover` : `linear-gradient(135deg, ${shade(brand, 20)}, ${brand})` }} />
                  <div className="p-2">
                    <p className="truncate text-[11px] font-bold">{q.title}</p>
                    <p className="line-clamp-2 text-[9px]" style={{ color: muted }}>{q.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {prompts.length > 0 && (
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: muted }}>{promptTitle}</p>
            <div className="flex flex-col items-start gap-1.5">
              {prompts.slice(0, 3).map((p, i) => (
                <span
                  key={i}
                  className="rounded-sm border px-3 py-1.5 text-[11px]"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)', ...chipStyle }}
                >
                  <span style={{ color: brand }}>✳ </span>
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
      </div>

      <div className="px-3.5 pb-3 pt-2">
        {/* Mirrors the real SDK's input bar (a bordered pill, 5px padding, round action
            buttons); everything in chat_input.styles overrides it, exactly like the SDK. */}
        <div
          dir={inputDir}
          className={`flex items-center gap-2 border p-[5px] transition-all duration-300 ${inputLayout === 'full_width_bar' ? 'rounded-lg' : 'rounded-full'}`}
          style={{
            background: surface,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#ECECED',
            ...(get(v2, 'chat_input.styles') ?? {}),
          }}
        >
          {attach && (
            <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
              <Plus className="size-4" style={{ color: actionColor || muted }} />
            </span>
          )}
          {/* dir="auto" keeps the ellipsis and bidi punctuation on the reading side of the text itself. */}
          <span dir="auto" className="min-w-0 flex-1 truncate px-1 text-start text-[11.5px]" style={{ color: muted }}>{placeholder}</span>
          {voice && <Mic className="size-4 shrink-0" style={{ color: actionColor || muted }} />}
          {/* Same icon and color the real widget's send button uses */}
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300"
            style={{ background: get(v2, 'chat_input.sendButtonIcon.styles.backgroundColor') || brand }}
          >
            <SendIcon
              name={sendIcon}
              url={get(v2, 'chat_input.sendButtonIcon.url')}
              className="size-3.5"
              style={{ color: get(v2, 'chat_input.sendButtonIcon.styles.iconColor') || '#ffffff' }}
            />
          </span>
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
