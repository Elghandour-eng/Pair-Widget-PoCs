import type { CSSProperties, ReactNode } from 'react'
import * as Hiro from '../../../../sdk-src/src/features/conversation/components/conversation-message/ai-assistant-message/widget-template/hiro-cards-view'

/**
 * Faithful dashboard previews of the widget's template cards.
 *
 * These mirror the SDK renderers rather than importing them: the SDK is a
 * separate app with its own theme and config contexts, and pulling it in here
 * would drag those along. The contract they share is the resolved `design`
 * object the server sends with every card, so a knob moved here moves the same
 * value the widget will read.
 *
 * If a renderer changes shape in the SDK, its twin here has to follow. That is
 * the cost of showing an operator the real thing instead of a JSON blob.
 */

export type Design = Record<string, string | number | boolean | undefined>
export interface CardContent {
  lang?: 'ar' | 'en'
  design?: Design
  [key: string]: unknown
}

const RATIOS: Record<string, string> = { '1:1': '1 / 1', '4:3': '4 / 3', '16:9': '16 / 9', '2:3': '2 / 3' }

interface Resolved {
  accent: string; surface: string; border: string; radius: number; padding: number
  titleSize: number; divider: string; columns: number; aspect: string
  showImage: boolean; buttonStyle: string; text: string; muted: string
  isDark: boolean; isArabic: boolean; card: CSSProperties
}

function resolve(content: CardContent, isDark: boolean): Resolved {
  const d = content.design ?? {}
  const str = (k: string, f: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : f)
  const num = (k: string, f: number) => (typeof d[k] === 'number' ? (d[k] as number) : f)
  const accent = str('accent', '#B3202C')
  const surface = str('surface', isDark ? '#181c28' : '#ffffff')
  const border = str('border', isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')
  const radius = num('radius', 16)
  return {
    accent, surface, border, radius,
    padding: num('padding', 16),
    titleSize: num('titleSize', 14),
    divider: str('divider', 'dashed'),
    columns: num('columns', 2),
    aspect: RATIOS[str('imageRatio', '1:1')] ?? '1 / 1',
    showImage: typeof d.showImage === 'boolean' ? d.showImage : true,
    buttonStyle: str('buttonStyle', 'filled'),
    text: isDark ? '#e8eaf2' : '#26272c',
    muted: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    isDark,
    isArabic: content.lang !== 'en',
    card: { background: surface, border: `1px solid ${border}`, borderRadius: radius },
  }
}

/** A photo box that keeps its shape when there is no photo, exactly as the SDK's does. */
function Img({ src, aspect, accent, glyph }: { src?: string; aspect: string; accent: string; glyph: string }) {
  const style: CSSProperties = { aspectRatio: aspect }
  if (!src) {
    return (
      <div
        className="flex w-full items-center justify-center text-[26px]"
        style={{ ...style, background: `linear-gradient(160deg, ${accent}26, ${accent}0a)` }}
      >
        {glyph}
      </div>
    )
  }
  return <img src={src} alt="" className="w-full object-cover" style={style} loading="lazy" />
}

function Shell({ d, children, width }: { d: Resolved; children: ReactNode; width?: number }) {
  return (
    <div dir={d.isArabic ? 'rtl' : 'ltr'} style={{ ...d.card, padding: d.padding, maxWidth: width ?? 330, width: '100%' }}>
      {children}
    </div>
  )
}

function Heading({ d, children }: { d: Resolved; children: ReactNode }) {
  if (!children) return null
  return <p className="mb-2.5 font-bold" style={{ color: d.accent, fontSize: d.titleSize }}>{children}</p>
}

type Row = Record<string, unknown>
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const s = (v: unknown): string => (typeof v === 'string' ? v : '')

/* -------------------------------- the cards -------------------------------- */

function PriceList({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const items = rows(content.items)
  const cur = d.isArabic ? s(content.currency) || 'د.ك' : s(content.currency_en) || 'KD'
  return (
    <Shell d={d}>
      <Heading d={d}>{d.isArabic ? s(content.title) : s(content.title_en) || s(content.title)}</Heading>
      <div className="flex flex-col">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 py-2 text-[13px]"
            style={i < items.length - 1 && d.divider !== 'none'
              ? { borderBottom: `1px ${d.divider} ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}` }
              : undefined}
          >
            <span style={{ color: d.text }}>{d.isArabic ? s(it.label) : s(it.label_en) || s(it.label)}</span>
            <span className="shrink-0 font-semibold whitespace-nowrap" style={{ color: d.accent }}>
              <bdo dir="ltr">{s(it.price)}</bdo> {cur}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function ExperiencesList({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  return (
    <Shell d={d} width={340}>
      <Heading d={d}>{d.isArabic ? s(content.title) : s(content.title_en) || s(content.title)}</Heading>
      <div className="flex flex-col gap-2.5">
        {rows(content.items).map((it, i) => (
          <div
            key={i}
            className="p-2.5"
            style={{
              borderRadius: Math.max(0, d.radius - 4),
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              ...(d.divider === 'none' ? {} : { border: `1px ${d.divider} ${d.border}` }),
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold" style={{ color: d.text }}>{s(it.name)}</span>
              {!!it.price && (
                <span className="shrink-0 text-[12px] font-semibold whitespace-nowrap" style={{ color: d.accent }}>
                  <bdo dir="ltr">{s(it.price)}</bdo> {d.isArabic ? 'د.ك' : 'KD'}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: d.muted }}>
              📍 {d.isArabic ? s(it.cinemas_ar) : s(it.cinemas_en) || s(it.cinemas_ar)}
            </p>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function LocationCards({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const cards = rows(content.cards).length ? rows(content.cards) : [content as Row]
  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-1" dir={d.isArabic ? 'rtl' : 'ltr'}>
      {cards.map((c, i) => (
        <div key={i} className="flex w-full max-w-[300px] shrink-0 flex-col overflow-hidden" style={d.card}>
          {d.showImage && <Img src={s(c.image)} aspect={d.aspect} accent={d.accent} glyph="📍" />}
          <div className="flex flex-col gap-1.5" style={{ padding: d.padding }}>
            <p className="leading-tight font-bold" style={{ color: d.text, fontSize: d.titleSize }}>
              {d.isArabic ? s(c.name_ar) || s(c.name) : s(c.name)}
            </p>
            {!!(c.address_ar || c.address) && (
              <p className="text-[12px] leading-snug" style={{ color: d.muted }}>
                {d.isArabic ? s(c.address_ar) || s(c.address) : s(c.address)}
              </p>
            )}
            {!!c.hours && <p className="text-[12px]" style={{ color: d.muted }}>🕐 {s(c.hours)}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function MenuCards({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const width = Math.round(290 / Math.max(1, d.columns))
  return (
    <div className="flex w-full flex-col gap-2" dir={d.isArabic ? 'rtl' : 'ltr'}>
      <Heading d={d}>{d.isArabic ? s(content.title) : s(content.title_en) || s(content.title)}</Heading>
      <div className="flex w-full gap-2.5 overflow-x-auto pb-1">
        {rows(content.items).slice(0, 6).map((it, i) => (
          <div key={i} className="flex shrink-0 flex-col overflow-hidden" style={{ ...d.card, width }}>
            {d.showImage && <Img src={s(it.image)} aspect={d.aspect} accent={d.accent} glyph="🍿" />}
            <div className="flex flex-1 flex-col gap-1" style={{ padding: d.padding }}>
              <span className="line-clamp-2 text-[11.5px] leading-snug font-semibold" style={{ color: d.text }}>
                {d.isArabic ? s(it.label) : s(it.label_en) || s(it.label)}
              </span>
              <span className="mt-auto text-[12px] font-bold whitespace-nowrap" style={{ color: d.accent }}>
                <bdo dir="ltr">{s(it.price)}</bdo> {d.isArabic ? 'د.ك' : 'KD'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MovieCards({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const width = Math.round(280 / Math.max(1, d.columns))
  return (
    <div className="flex w-full flex-col gap-2" dir={d.isArabic ? 'rtl' : 'ltr'}>
      <Heading d={d}>{d.isArabic ? s(content.title) : s(content.title_en) || s(content.title)}</Heading>
      <div className="flex w-full gap-2.5 overflow-x-auto pb-1">
        {rows(content.items).slice(0, 6).map((it, i) => (
          <div key={i} className="flex shrink-0 flex-col overflow-hidden" style={{ ...d.card, width }}>
            <div className="relative">
              <Img src={s(it.image)} aspect={d.aspect} accent={d.accent} glyph="🎬" />
              {!!it.rating && (
                <span
                  className="absolute top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: d.accent, insetInlineEnd: '6px' }}
                >
                  {s(it.rating)}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-0.5" style={{ padding: d.padding }}>
              <span className="line-clamp-2 text-[11.5px] leading-snug font-semibold" style={{ color: d.text }}>
                {d.isArabic ? s(it.title_ar) || s(it.title) : s(it.title)}
              </span>
              {!!(it.genre || it.duration) && (
                <span className="text-[10px]" style={{ color: d.muted }}>
                  {[s(it.genre), s(it.duration)].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MenuCategories({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  return (
    <div className="flex w-full max-w-[340px] flex-col gap-2" dir={d.isArabic ? 'rtl' : 'ltr'}>
      <Heading d={d}>{d.isArabic ? s(content.title) : s(content.title_en) || s(content.title)}</Heading>
      <div className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, d.columns)}, minmax(0, 1fr))` }}>
        {rows(content.items).slice(0, 6).map((it, i) => (
          <div
            key={i}
            className="relative overflow-hidden"
            style={{ aspectRatio: d.aspect, borderRadius: d.radius, border: `1.5px solid ${d.border}` }}
          >
            <div className="absolute inset-0">
              <Img src={s(it.image)} aspect={d.aspect} accent={d.accent} glyph="🍿" />
            </div>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.05) 70%)' }} />
            <div className="absolute inset-x-0 bottom-0 flex items-end p-2.5">
              <span className="text-[13px] leading-tight font-bold text-white">
                {d.isArabic ? s(it.label) : s(it.label_en) || s(it.label)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AppLinks({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const outline = d.buttonStyle === 'outline'
  const badge: CSSProperties = {
    borderRadius: Math.max(0, d.radius - 4),
    background: outline ? 'transparent' : isDark ? '#000' : '#111318',
    border: `1px solid ${outline ? d.accent : 'rgba(255,255,255,0.14)'}`,
  }
  const labelColor = outline ? d.accent : '#ffffff'
  return (
    <Shell d={d} width={320}>
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl text-[20px]" style={{ background: `${d.accent}1a` }}>🍿</span>
        <span className="text-[14px] leading-tight font-bold" style={{ color: d.text }}>
          {d.isArabic ? 'حمّل التطبيق' : 'Get the app'}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {[d.isArabic ? 'آب ستور' : 'App Store', d.isArabic ? 'جوجل بلاي' : 'Google Play'].map((name) => (
          <div key={name} className="flex w-full items-center gap-3 px-4 py-2.5" style={badge}>
            <span className="text-[18px]">{name.includes('App') || name.includes('آب') ? '' : '▶'}</span>
            <span className="flex flex-col">
              <span className="text-[10px] tracking-wide" style={{ color: outline ? d.muted : 'rgba(255,255,255,0.7)' }}>
                {d.isArabic ? 'حمّل من' : 'Download on'}
              </span>
              <span className="text-[15px] font-semibold" style={{ color: labelColor }}>{name}</span>
            </span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* --------------------------- Pair plugin components -------------------------- */

const TONE: Record<string, string> = { open: '#16a34a', pending: '#d97706', resolved: '#6b7280', closed: '#6b7280', low: '#6b7280', medium: '#d97706', high: '#dc2626', urgent: '#b91c1c' }
const WORD: Record<string, [string, string]> = {
  open: ['مفتوحة', 'Open'], pending: ['قيد الإنشاء', 'Pending'], resolved: ['تم الحل', 'Resolved'], closed: ['مغلقة', 'Closed'],
  low: ['منخفضة', 'Low'], medium: ['متوسطة', 'Medium'], high: ['عالية', 'High'], urgent: ['عاجلة', 'Urgent'],
}
function Pill({ k, ar }: { k: string; ar: boolean }) {
  const color = TONE[k] ?? '#6b7280'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold" style={{ color, background: `${color}1f` }}>
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {WORD[k]?.[ar ? 0 : 1] ?? k}
    </span>
  )
}

function TicketCard({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const id = s(content.ticket_id)
  return (
    <Shell d={d} width={320}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[16px]" style={{ background: `${d.accent}1a` }}>🎫</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] leading-tight" style={{ color: d.muted }}>{d.isArabic ? 'تذكرة دعم' : 'Support ticket'}</span>
          <span className="truncate text-[13px] leading-tight font-bold" style={{ color: d.text }}>{id ? `#${id}` : d.isArabic ? 'جاري الإنشاء…' : 'Being created…'}</span>
        </div>
        <Pill k={s(content.status) || 'open'} ar={d.isArabic} />
      </div>
      <p className="leading-snug font-semibold" style={{ color: d.text, fontSize: d.titleSize }}>{s(content.title)}</p>
      {s(content.description) && <p className="mt-1 text-[12.5px] leading-snug" style={{ color: d.muted }}>{s(content.description)}</p>}
      {s(content.priority) && (
        <div className="mt-2.5 flex items-center justify-between pt-2 text-[11.5px]" style={{ borderTop: `1px solid ${d.border}`, color: d.muted }}>
          <span>{d.isArabic ? 'الأولوية' : 'Priority'}</span>
          <Pill k={s(content.priority)} ar={d.isArabic} />
        </div>
      )}
    </Shell>
  )
}

function TicketList({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const items = (Array.isArray(content.items) ? content.items : []) as Array<Record<string, unknown>>
  return (
    <Shell d={d} width={320}>
      <p className="pb-2 font-bold" style={{ color: d.text, fontSize: d.titleSize }}>{d.isArabic ? 'تذاكرك' : 'Your tickets'}</p>
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2" style={{ borderTop: i === 0 || d.divider === 'none' ? undefined : `1px ${d.divider} ${d.border}` }}>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] leading-snug font-semibold" style={{ color: d.text }}>{s(t.title)}</span>
            {s(t.ticket_id) && <span className="text-[11px]" style={{ color: d.muted }}>#{s(t.ticket_id)}</span>}
          </div>
          <Pill k={s(t.status) || 'open'} ar={d.isArabic} />
        </div>
      ))}
    </Shell>
  )
}

function LinkCard({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  const outline = d.buttonStyle === 'outline'
  return (
    <Shell d={d} width={320}>
      {s(content.header) && <p className="leading-snug font-bold" style={{ color: d.text, fontSize: d.titleSize }}>{s(content.header)}</p>}
      {s(content.text) && <p className="mt-1.5 text-[13px] leading-snug" style={{ color: d.muted }}>{s(content.text)}</p>}
      <div
        className="mt-2.5 flex w-full items-center justify-center px-4 py-2.5 text-[13.5px] font-semibold"
        style={{ borderRadius: Math.max(0, d.radius - 4), background: outline ? 'transparent' : d.accent, color: outline ? d.accent : '#fff', border: `1px solid ${d.accent}` }}
      >
        {s(content.cta_text) || (d.isArabic ? 'افتح الرابط' : 'Open link')} ↗
      </div>
    </Shell>
  )
}

function ImageCard({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const d = resolve(content, isDark)
  return (
    <div dir={d.isArabic ? 'rtl' : 'ltr'} className="overflow-hidden" style={{ ...d.card, padding: d.padding, maxWidth: 320, width: '100%' }}>
      <Img src={s(content.url)} aspect={d.aspect} accent={d.accent} glyph="🖼" />
      {s(content.caption) && <p className="px-3 py-2 text-[12.5px] leading-snug" style={{ color: d.text }}>{s(content.caption)}</p>}
    </div>
  )
}

/* ---------------------------------- Hiro ----------------------------------- */

/**
 * Hiro's cards are not twins: they are the widget's own view, imported from
 * sdk-src, so the preview cannot drift from what the widget draws. Only the
 * design is resolved here, from the same `design` object the widget reads.
 */
const HIRO_VIEWS: Record<string, (p: { content: never; d: Hiro.HiroDesign }) => ReactNode> = {
  hiro_body_snapshot: Hiro.HiroBodySnapshotView as never,
  hiro_progress_trend: Hiro.HiroProgressTrendView as never,
  hiro_body_composition: Hiro.HiroBodyCompositionView as never,
  hiro_goal_progress: Hiro.HiroGoalProgressView as never,
  hiro_macro_targets: Hiro.HiroMacroTargetsView as never,
  hiro_muscle_balance: Hiro.HiroMuscleBalanceView as never,
  hiro_meal_cards: Hiro.HiroMealCardsView as never,
  hiro_meal_plan: Hiro.HiroMealPlanView as never,
  hiro_workout_plan: Hiro.HiroWorkoutPlanView as never,
  hiro_exercise_cards: Hiro.HiroExerciseCardsView as never,
  hiro_insight: Hiro.HiroInsightView as never,
}

function HiroCard({ type, content, isDark }: { type: string; content: CardContent; isDark: boolean }) {
  const View = HIRO_VIEWS[type]
  const r = resolve(content, isDark)
  const d: Hiro.HiroDesign = {
    accent: r.accent, text: r.text, muted: r.muted, padding: r.padding, titleSize: r.titleSize,
    isDark: r.isDark, isArabic: r.isArabic,
    cardStyle: { background: r.surface, border: `1px solid ${r.border}`, borderRadius: r.radius },
  }
  return <div className="w-full max-w-[360px]"><View content={content as never} d={d} /></div>
}

/* --------------------------------- the switch ------------------------------- */

/** Draws one hydrated card. Mirrors the SDK's `template-renderer` switch. */
export function CardPreview({ type, content, isDark }: { type: string; content: CardContent; isDark: boolean }) {
  switch (type) {
    case 'price_list': return <PriceList content={content} isDark={isDark} />
    case 'experiences_list': return <ExperiencesList content={content} isDark={isDark} />
    case 'location_cards': return <LocationCards content={content} isDark={isDark} />
    case 'menu_cards': return <MenuCards content={content} isDark={isDark} />
    case 'movie_cards': return <MovieCards content={content} isDark={isDark} />
    case 'menu_categories': return <MenuCategories content={content} isDark={isDark} />
    case 'app_links': return <AppLinks content={content} isDark={isDark} />
    case 'ticket_card': return <TicketCard content={content} isDark={isDark} />
    case 'ticket_list': return <TicketList content={content} isDark={isDark} />
    case 'link_card': return <LinkCard content={content} isDark={isDark} />
    case 'image_card': return <ImageCard content={content} isDark={isDark} />
    default:
      if (type in HIRO_VIEWS) return <HiroCard type={type} content={content} isDark={isDark} />
      return (
        <p className="text-xs text-muted">
          No preview for <span className="mono">{type}</span> yet.
        </p>
      )
  }
}
