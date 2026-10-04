import { useState } from 'react'
import { CheckCircle2, Clock, Dumbbell, Flame, Info, Play, TriangleAlert, Utensils } from 'lucide-react'

import type {
  HiroBodyCompositionTemplate,
  HiroBodySnapshotTemplate,
  HiroExercise,
  HiroExerciseCardsTemplate,
  HiroGoalProgressTemplate,
  HiroInsightTemplate,
  HiroMacroTargetsTemplate,
  HiroMeal,
  HiroMealCardsTemplate,
  HiroMealPlanTemplate,
  HiroMuscleBalanceTemplate,
  HiroProgressTrendTemplate,
  HiroWorkoutPlanTemplate,
} from '../../../../types/hiro-templates'

/**
 * The design a Hiro card is drawn with, already resolved: the widget computes it
 * from its theme (use-template-design), the studio's Templates page from its
 * own preview controls. Kept free of either app's context so both draw the very
 * same card from this one file.
 */
export interface HiroDesign {
  accent: string
  text: string
  muted: string
  padding: number
  titleSize: number
  isDark: boolean
  isArabic: boolean
  cardStyle: { background: string; border: string; borderRadius: number }
}
/**
 * Hiro's cards: the visitor's own body scans, nutrition and training. Every
 * number on them came from Hiro's APIs through the agent's tools; a card draws
 * only what it was given and leaves out what it was not.
 *
 * Shared look: a white card, the widget's accent for the data, and three
 * status colours — healthy, below range, above range — that mean the same thing
 * on every card.
 */

const GOOD = '#16A34A'
const LOW = '#D97706'
const HIGH = '#DC2626'

const T = {
  en: {
    low: 'Low',
    healthy: 'Healthy',
    high: 'High',
    range: 'Healthy',
    score: 'Body score',
    toGo: 'to go',
    reached: 'Goal reached',
    kcal: 'kcal',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    total: 'Day total',
    target: 'Target',
    sets: 'sets',
    reps: 'reps',
    rest: 'rest',
    min: 'min',
    since: 'since',
    diff: 'difference',
    of: 'of',
    start: 'Start',
    now: 'Now',
    goal: 'Goal',
  },
  ar: {
    low: 'منخفض',
    healthy: 'صحي',
    high: 'مرتفع',
    range: 'الطبيعي',
    score: 'تقييم الجسم',
    toGo: 'متبقي',
    reached: 'وصلت للهدف',
    kcal: 'سعرة',
    protein: 'بروتين',
    carbs: 'كربوهيدرات',
    fat: 'دهون',
    total: 'إجمالي اليوم',
    target: 'الهدف',
    sets: 'مجموعات',
    reps: 'تكرار',
    rest: 'راحة',
    min: 'دقيقة',
    since: 'منذ',
    diff: 'الفرق',
    of: 'من',
    start: 'البداية',
    now: 'الآن',
    goal: 'الهدف',
  },
}
const words = (d: HiroDesign) => (d.isArabic ? T.ar : T.en)

const fmt = (n: number | undefined, digits = 1): string => {
  if (n === undefined || !Number.isFinite(n)) return '–'
  const r = Math.round(n * 10 ** digits) / 10 ** digits
  return r.toLocaleString('en-US', { maximumFractionDigits: digits })
}

const shortDate = (iso: string | undefined, ar: boolean): string => {
  if (!iso) return ''
  const t = Date.parse(iso.replace(' ', 'T'))
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString(ar ? 'ar-KW' : 'en-GB', { day: 'numeric', month: 'short' })
}

/** The card shell every Hiro card shares: surface, heading, optional corner text. */
function Shell({
  d,
  title,
  aside,
  children,
}: {
  d: HiroDesign
  title?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="mt-2 flex w-full flex-col gap-3"
      dir={d.isArabic ? 'rtl' : 'ltr'}
      style={{
        ...d.cardStyle,
        padding: d.padding,
        boxShadow: d.isDark ? undefined : '0 6px 22px rgba(30,60,120,0.07)',
      }}
    >
      {(title || aside) && (
        <div className="flex items-start justify-between gap-3">
          {title && (
            <p className="leading-snug font-semibold" style={{ color: d.text, fontSize: d.titleSize }}>
              {title}
            </p>
          )}
          {aside}
        </div>
      )}
      {children}
    </div>
  )
}

/* ---------------------------------- media ---------------------------------- */

/**
 * A card's picture or video. A video shows its poster (the item's image, or a
 * tinted panel) with a play button, and plays inline on tap — no new window,
 * no autoplay with sound. A picture that fails to load falls back to the same
 * tinted panel with the card's glyph, so a broken link never leaves a hole.
 */
function Media({
  image,
  video,
  alt,
  height,
  d,
  Glyph,
}: {
  image?: string
  video?: string
  alt: string
  height: number
  d: HiroDesign
  Glyph: typeof Utensils
}) {
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  const panel = (
    <div
      className="grid w-full place-items-center"
      style={{ height, background: `linear-gradient(150deg, ${d.accent}26, ${d.accent}0a)` }}
    >
      <Glyph className="size-7" style={{ color: d.accent }} />
    </div>
  )
  if (video) {
    if (playing) {
      return (
        <video
          src={video}
          poster={image}
          controls
          autoPlay
          playsInline
          className="w-full bg-black object-contain"
          style={{ height }}
        />
      )
    }
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="relative block w-full cursor-pointer"
        aria-label={`Play: ${alt}`}
      >
        {image && !broken ? (
          <img
            src={image}
            alt={alt}
            className="w-full object-cover"
            style={{ height }}
            onError={() => setBroken(true)}
          />
        ) : (
          panel
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/15">
          <span className="grid size-11 place-items-center rounded-full shadow-lg" style={{ background: d.accent }}>
            <Play className="ms-0.5 size-5 fill-white text-white" />
          </span>
        </span>
      </button>
    )
  }
  if (image && !broken)
    return (
      <img src={image} alt={alt} className="w-full object-cover" style={{ height }} onError={() => setBroken(true)} />
    )
  return panel
}

/* -------------------------------- body scan -------------------------------- */

function statusOf(v: number, min?: number, max?: number): 'low' | 'healthy' | 'high' | null {
  if (min === undefined && max === undefined) return null
  if (min !== undefined && v < min) return 'low'
  if (max !== undefined && v > max) return 'high'
  return 'healthy'
}
const statusColor = { low: LOW, healthy: GOOD, high: HIGH }

/**
 * Off-range is not always bad: more muscle than the range is a good thing. A
 * reading past the range on the side the tile calls better reads as healthy,
 * while still saying which side of the range it is on.
 */
function toneOf(s: 'low' | 'healthy' | 'high', better?: 'up' | 'down'): string {
  if ((s === 'high' && better === 'up') || (s === 'low' && better === 'down')) return GOOD
  return statusColor[s]
}

export function HiroBodySnapshotView({ content, d }: { content: HiroBodySnapshotTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const w = words(d)
  const items = c.items ?? []
  if (!items.length) return null
  return (
    <Shell
      d={d}
      title={c.title}
      aside={
        c.score !== undefined ? (
          <div className="flex shrink-0 flex-col items-end" style={{ color: d.muted }}>
            <span className="text-[20px] leading-none font-bold" style={{ color: d.accent }}>
              {fmt(c.score, 0)}
            </span>
            <span className="text-[10px]">{w.score}</span>
          </div>
        ) : c.date ? (
          <span className="shrink-0 text-[11px]" style={{ color: d.muted }}>
            {shortDate(c.date, d.isArabic)}
          </span>
        ) : undefined
      }
    >
      {c.score !== undefined && c.date && (
        <span className="-mt-2 text-[11px]" style={{ color: d.muted }}>
          {shortDate(c.date, d.isArabic)}
        </span>
      )}
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => {
          const s = statusOf(it.value, it.min, it.max)
          const lo = it.min ?? it.value
          const hi = it.max ?? it.value
          // the range bar spans a little beyond the healthy band either side
          const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1)
          const from = lo - span * 0.5
          const to = hi + span * 0.5
          const pos = Math.min(100, Math.max(0, ((it.value - from) / (to - from)) * 100))
          return (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-xl p-2.5"
              style={{ background: d.isDark ? 'rgba(255,255,255,0.04)' : '#F5F7FB' }}
            >
              <span className="text-[11px] leading-tight" style={{ color: d.muted }}>
                {it.label}
              </span>
              <span className="leading-none font-bold" style={{ color: d.text, fontSize: 18 }}>
                {fmt(it.value)}
                {it.unit && (
                  <span className="ms-0.5 text-[11px] font-medium" style={{ color: d.muted }}>
                    {it.unit}
                  </span>
                )}
              </span>
              {s && (
                <>
                  <div
                    className="relative mt-0.5 h-1.5 w-full rounded-full"
                    style={{ background: d.isDark ? 'rgba(255,255,255,0.1)' : '#E4E8F0' }}
                  >
                    <div
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        background: `${GOOD}55`,
                        insetInlineStart: `${((lo - from) / (to - from)) * 100}%`,
                        width: `${((hi - lo) / (to - from)) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-white"
                      style={{ background: toneOf(s, it.better), insetInlineStart: `calc(${pos}% - 5px)` }}
                    />
                  </div>
                  <span className="text-[10.5px] font-semibold" style={{ color: toneOf(s, it.better) }}>
                    {w[s]}
                    {it.min !== undefined && it.max !== undefined && (
                      <span className="font-normal" style={{ color: d.muted }}>
                        {' '}
                        · {w.range} {fmt(it.min)}–{fmt(it.max)}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

/* --------------------------------- trends ---------------------------------- */

function Sparkline({ points, color }: { points: Array<{ value: number }>; color: string }) {
  const W = 120
  const H = 36
  if (points.length < 2) {
    return (
      <svg width={W} height={H} aria-hidden>
        <circle cx={W / 2} cy={H / 2} r={3.5} fill={color} />
      </svg>
    )
  }
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = 4
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2)
  const y = (v: number) => (max === min ? H / 2 : pad + (1 - (v - min) / (max - min)) * (H - pad * 2))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`
  const id = `g${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r="3" fill={color} />
    </svg>
  )
}

export function HiroProgressTrendView({
  content,
  d,
}: {
  content: HiroProgressTrendTemplate['content']
  d: HiroDesign
}) {
  const c = content ?? {}
  const w = words(d)
  const series = (c.series ?? []).filter((s) => s.points?.length)
  if (!series.length) return null
  return (
    <Shell d={d} title={c.title}>
      {c.verdict && (
        <p className="-mt-1 text-[13px] leading-relaxed" style={{ color: d.text }}>
          {c.verdict}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {series.map((s, i) => {
          const first = s.points[0]
          const last = s.points[s.points.length - 1]
          const change = last.value - first.value
          const good = s.better ? (s.better === 'down' ? change <= 0 : change >= 0) : undefined
          const color = good === undefined ? d.accent : good ? GOOD : HIGH
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl p-2.5"
              style={{ background: d.isDark ? 'rgba(255,255,255,0.04)' : '#F5F7FB' }}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11.5px]" style={{ color: d.muted }}>
                  {s.label}
                </span>
                <span className="text-[17px] leading-none font-bold" style={{ color: d.text }}>
                  {fmt(last.value)}
                  {s.unit && (
                    <span className="ms-0.5 text-[11px] font-medium" style={{ color: d.muted }}>
                      {s.unit}
                    </span>
                  )}
                </span>
                {s.points.length > 1 && (
                  <span className="text-[11px] font-semibold" style={{ color }}>
                    {change > 0 ? '+' : change < 0 ? '−' : '±'}
                    {fmt(Math.abs(change))}
                    {s.unit ? ` ${s.unit}` : ''}
                    <span className="font-normal" style={{ color: d.muted }}>
                      {' '}
                      {w.since} {shortDate(first.date, d.isArabic)}
                    </span>
                  </span>
                )}
              </div>
              <Sparkline points={s.points} color={color} />
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

/* ------------------------------- composition ------------------------------- */

const PART_COLORS = ['#218EE7', '#F59E0B', '#22C3E6', '#A78BFA', '#34D399', '#F472B6']

export function HiroBodyCompositionView({
  content,
  d,
}: {
  content: HiroBodyCompositionTemplate['content']
  d: HiroDesign
}) {
  const c = content ?? {}
  const parts = c.parts ?? []
  if (!parts.length) return null
  const sum = parts.reduce((a, p) => a + p.kg, 0)
  const total = c.total && c.total >= sum ? c.total : sum
  return (
    <Shell d={d} title={c.title}>
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full"
        style={{ background: d.isDark ? 'rgba(255,255,255,0.08)' : '#E9EDF4' }}
      >
        {parts.map((p, i) => (
          <div
            key={i}
            style={{
              width: `${(p.kg / total) * 100}%`,
              background: i === 0 ? d.accent : i === 0 ? d.accent : PART_COLORS[i % PART_COLORS.length],
            }}
            title={p.label}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: i === 0 ? d.accent : i === 0 ? d.accent : PART_COLORS[i % PART_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: d.text }}>
              {p.label}
            </span>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: d.text }}>
              {fmt(p.kg)}
              <span className="ms-0.5 text-[10.5px] font-normal" style={{ color: d.muted }}>
                kg · {fmt((p.kg / total) * 100, 0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ---------------------------------- goal ----------------------------------- */

export function HiroGoalProgressView({ content, d }: { content: HiroGoalProgressTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const w = words(d)
  if (c.current === undefined || c.target === undefined) return null
  const start = c.start ?? c.current
  const whole = Math.abs(c.target - start)
  const done = whole === 0 ? 1 : Math.min(1, Math.max(0, Math.abs(c.current - start) / whole))
  // moving away from the goal counts as no progress, never as negative
  const towards = whole === 0 || Math.sign(c.target - start) === Math.sign(c.current - start) || c.current === start
  const left = Math.abs(c.target - c.current)
  const reached =
    left < 0.05 || (c.start !== undefined && Math.sign(c.target - c.start) !== Math.sign(c.target - c.current))
  const unit = c.unit ? ` ${c.unit}` : ''
  return (
    <Shell
      d={d}
      title={c.label}
      aside={
        <span className="shrink-0 text-[12px] font-semibold" style={{ color: reached ? GOOD : d.accent }}>
          {reached ? w.reached : `${fmt(left)}${unit} ${w.toGo}`}
        </span>
      }
    >
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: d.isDark ? 'rgba(255,255,255,0.08)' : '#E9EDF4' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${(reached ? 1 : towards ? done : 0) * 100}%`,
            background: `linear-gradient(90deg, ${d.accent}AA, ${d.accent})`,
          }}
        />
      </div>
      <div className="flex justify-between text-[11.5px]" style={{ color: d.muted }}>
        <span>
          {c.start !== undefined ? `${w.start} ${fmt(c.start)}${unit} · ` : ''}
          {w.now}{' '}
          <b style={{ color: d.text }}>
            {fmt(c.current)}
            {unit}
          </b>
        </span>
        <span>
          {w.goal}{' '}
          <b style={{ color: d.text }}>
            {fmt(c.target)}
            {unit}
          </b>
        </span>
      </div>
      {c.note && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: d.text }}>
          {c.note}
        </p>
      )}
    </Shell>
  )
}

/* --------------------------------- macros ---------------------------------- */

/** Protein wears the widget's own colour; carbs and fat stay fixed so they read the same everywhere. */
const macroColors = (d: HiroDesign) => ({ protein: d.accent, carbs: '#F59E0B', fat: '#F472B6' })

export function HiroMacroTargetsView({ content, d }: { content: HiroMacroTargetsTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const w = words(d)
  if (c.calories === undefined) return null
  const kcal = { protein: (c.protein_g ?? 0) * 4, carbs: (c.carbs_g ?? 0) * 4, fat: (c.fat_g ?? 0) * 9 }
  const sum = kcal.protein + kcal.carbs + kcal.fat || 1
  const R = 34
  const C = 2 * Math.PI * R
  let offset = 0
  const arcs = (['protein', 'carbs', 'fat'] as const).map((k) => {
    const len = (kcal[k] / sum) * C
    const arc = { k, len, offset }
    offset += len
    return arc
  })
  return (
    <Shell d={d} title={c.title}>
      <div className="flex items-center gap-4">
        <div className="relative grid shrink-0 place-items-center" style={{ width: 92, height: 92 }}>
          <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90" aria-hidden>
            <circle
              cx="46"
              cy="46"
              r={R}
              fill="none"
              stroke={d.isDark ? 'rgba(255,255,255,0.08)' : '#E9EDF4'}
              strokeWidth="10"
            />
            {arcs.map((a) => (
              <circle
                key={a.k}
                cx="46"
                cy="46"
                r={R}
                fill="none"
                stroke={macroColors(d)[a.k]}
                strokeWidth="10"
                strokeDasharray={`${a.len} ${C - a.len}`}
                strokeDashoffset={-a.offset}
              />
            ))}
          </svg>
          <div className="absolute flex flex-col items-center leading-none">
            <span className="text-[17px] font-bold" style={{ color: d.text }}>
              {fmt(c.calories, 0)}
            </span>
            <span className="mt-0.5 text-[10px]" style={{ color: d.muted }}>
              {w.kcal}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <div className="flex justify-between text-[12px]">
                <span style={{ color: d.text }}>{w[k]}</span>
                <span className="font-semibold tabular-nums" style={{ color: d.text }}>
                  {fmt(c[`${k}_g`], 0)} g
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: d.isDark ? 'rgba(255,255,255,0.08)' : '#E9EDF4' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(kcal[k] / sum) * 100}%`, background: macroColors(d)[k] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {c.note && (
        <p className="text-[11.5px] leading-relaxed" style={{ color: d.muted }}>
          {c.note}
        </p>
      )}
    </Shell>
  )
}

/* ------------------------------ muscle balance ----------------------------- */

export function HiroMuscleBalanceView({
  content,
  d,
}: {
  content: HiroMuscleBalanceTemplate['content']
  d: HiroDesign
}) {
  const c = content ?? {}
  const w = words(d)
  const segs = c.segments ?? []
  if (!segs.length) return null
  const by = (k: string) => segs.find((s) => s.key === k)
  const pairs = [
    [by('left_arm'), by('right_arm')],
    [by('left_leg'), by('right_leg')],
  ].filter(([a, b]) => a && b) as Array<[NonNullable<ReturnType<typeof by>>, NonNullable<ReturnType<typeof by>>]>
  const rest = segs.filter((s) => !pairs.flat().includes(s))
  const unit = c.unit ?? ''
  return (
    <Shell d={d} title={c.title}>
      <div className="flex flex-col gap-2.5">
        {pairs.map(([a, b], i) => {
          const max = Math.max(a.value, b.value) || 1
          const gap = Math.abs(a.value - b.value) / max
          const color = gap > 0.06 ? LOW : GOOD
          return (
            <div
              key={i}
              className="rounded-xl p-2.5"
              style={{ background: d.isDark ? 'rgba(255,255,255,0.04)' : '#F5F7FB' }}
            >
              {[a, b].map((s, j) => (
                <div key={j} className="flex items-center gap-2 py-0.5">
                  <span className="w-[72px] shrink-0 truncate text-[11.5px]" style={{ color: d.muted }}>
                    {s.label}
                  </span>
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full"
                    style={{ background: d.isDark ? 'rgba(255,255,255,0.08)' : '#E4E8F0' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(s.value / max) * 100}%`, background: d.accent }}
                    />
                  </div>
                  <span
                    className="w-[52px] shrink-0 text-end text-[12px] font-semibold tabular-nums"
                    style={{ color: d.text }}
                  >
                    {fmt(s.value, 2)} {unit}
                  </span>
                </div>
              ))}
              <span className="text-[10.5px] font-semibold" style={{ color }}>
                {fmt(gap * 100, 1)}% {w.diff}
              </span>
            </div>
          )
        })}
        {rest.map((s, i) => (
          <div key={i} className="flex justify-between text-[12px]" style={{ color: d.text }}>
            <span style={{ color: d.muted }}>{s.label}</span>
            <b>
              {fmt(s.value, 2)} {unit}
            </b>
          </div>
        ))}
      </div>
      {c.note && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: d.text }}>
          {c.note}
        </p>
      )}
    </Shell>
  )
}

/* ---------------------------------- meals ---------------------------------- */

function MacroLine({ m, d }: { m: HiroMeal; d: HiroDesign }) {
  const w = words(d)
  const bits = [
    m.protein_g !== undefined && { k: 'P', v: m.protein_g, c: macroColors(d).protein, t: w.protein },
    m.carbs_g !== undefined && { k: 'C', v: m.carbs_g, c: macroColors(d).carbs, t: w.carbs },
    m.fat_g !== undefined && { k: 'F', v: m.fat_g, c: macroColors(d).fat, t: w.fat },
  ].filter(Boolean) as Array<{ k: string; v: number; c: string; t: string }>
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px]" style={{ color: d.muted }}>
      {bits.map((b) => (
        <span key={b.k} className="flex items-center gap-1" title={b.t}>
          <span className="size-1.5 rounded-full" style={{ background: b.c }} />
          {fmt(b.v, 0)}g {b.t}
        </span>
      ))}
    </div>
  )
}

export function HiroMealCardsView({ content, d }: { content: HiroMealCardsTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const w = words(d)
  const items = c.items ?? []
  if (!items.length) return null
  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={d.isArabic ? 'rtl' : 'ltr'}>
      {c.title && (
        <p className="font-semibold" style={{ color: d.text, fontSize: d.titleSize }}>
          {c.title}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((m, i) => (
          <div
            key={i}
            className="flex w-[200px] shrink-0 snap-start flex-col overflow-hidden"
            style={{ ...d.cardStyle, boxShadow: d.isDark ? undefined : '0 6px 22px rgba(30,60,120,0.07)' }}
          >
            <Media
              image={m.image}
              video={m.video}
              alt={m.name}
              height={m.image || m.video ? 112 : 84}
              d={d}
              Glyph={Utensils}
            />
            <div className="flex flex-1 flex-col gap-1.5" style={{ padding: 12 }}>
              {m.category && (
                <span className="text-[10.5px] font-semibold tracking-wide uppercase" style={{ color: d.accent }}>
                  {m.category}
                </span>
              )}
              <span className="line-clamp-2 text-[13px] leading-snug font-semibold" style={{ color: d.text }}>
                {m.name}
              </span>
              {m.calories !== undefined && (
                <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: d.text }}>
                  <Flame className="size-3.5" style={{ color: LOW }} />
                  {fmt(m.calories, 0)} {w.kcal}
                </span>
              )}
              <MacroLine m={m} d={d} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HiroMealPlanView({ content, d }: { content: HiroMealPlanTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const w = words(d)
  const meals = c.meals ?? []
  if (!meals.length) return null
  return (
    <Shell
      d={d}
      title={c.name}
      aside={
        c.target_calories !== undefined ? (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: `${d.accent}14`, color: d.accent }}
          >
            {w.target} {fmt(c.target_calories, 0)} {w.kcal}
          </span>
        ) : undefined
      }
    >
      {c.goal && (
        <span className="-mt-2 text-[11.5px]" style={{ color: d.muted }}>
          {c.goal}
        </span>
      )}
      <div className="flex flex-col">
        {meals.map((m, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-2"
            style={{ borderTop: i ? `1px solid ${d.isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F6'}` : undefined }}
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${d.accent}14` }}>
              <Utensils className="size-4" style={{ color: d.accent }} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {m.category && (
                <span className="text-[10.5px] font-semibold uppercase" style={{ color: d.muted }}>
                  {m.category}
                </span>
              )}
              <span className="text-[13px] font-semibold" style={{ color: d.text }}>
                {m.name}
              </span>
              <MacroLine m={m} d={d} />
            </div>
            {m.calories !== undefined && (
              <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: d.text }}>
                {fmt(m.calories, 0)}
                <span className="ms-0.5 text-[10px] font-normal" style={{ color: d.muted }}>
                  {w.kcal}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
      {c.totals && (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: d.isDark ? 'rgba(255,255,255,0.05)' : '#F5F7FB' }}
        >
          <span className="text-[12px] font-semibold" style={{ color: d.text }}>
            {w.total}
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: d.muted }}>
            <b style={{ color: d.text }}>
              {fmt(c.totals.calories, 0)} {w.kcal}
            </b>{' '}
            · {fmt(c.totals.protein_g, 0)}g {w.protein} · {fmt(c.totals.carbs_g, 0)}g {w.carbs} ·{' '}
            {fmt(c.totals.fat_g, 0)}g {w.fat}
          </span>
        </div>
      )}
    </Shell>
  )
}

/* -------------------------------- training --------------------------------- */

function dosage(e: HiroExercise, d: HiroDesign): string {
  const w = words(d)
  const parts: string[] = []
  if (e.sets && e.reps) parts.push(`${e.sets} × ${e.reps} ${w.reps}`)
  else if (e.sets) parts.push(`${e.sets} ${w.sets}`)
  else if (e.reps) parts.push(`${e.reps} ${w.reps}`)
  if (e.duration_seconds)
    parts.push(e.duration_seconds >= 60 ? `${fmt(e.duration_seconds / 60, 1)} ${w.min}` : `${e.duration_seconds}s`)
  if (e.rest_seconds) parts.push(`${w.rest} ${e.rest_seconds}s`)
  return parts.join(' · ')
}

function Chip({ d, children }: { d: HiroDesign; children: React.ReactNode }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: `${d.accent}12`, color: d.accent }}
    >
      {children}
    </span>
  )
}

export function HiroWorkoutPlanView({ content, d }: { content: HiroWorkoutPlanTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const w = words(d)
  const blocks = c.blocks ?? []
  if (!blocks.length) return null
  return (
    <Shell d={d} title={c.name}>
      {(c.image || c.video) && (
        <div className="-mt-1 overflow-hidden rounded-xl">
          <Media image={c.image} video={c.video} alt={c.name ?? ''} height={150} d={d} Glyph={Dumbbell} />
        </div>
      )}
      <div className="-mt-1 flex flex-wrap gap-1.5">
        {c.duration_minutes !== undefined && (
          <Chip d={d}>
            <Clock className="size-3" /> {fmt(c.duration_minutes, 0)} {w.min}
          </Chip>
        )}
        {c.estimated_calories !== undefined && (
          <Chip d={d}>
            <Flame className="size-3" /> {fmt(c.estimated_calories, 0)} {w.kcal}
          </Chip>
        )}
        {c.difficulty && <Chip d={d}>{c.difficulty}</Chip>}
        {c.goal && <Chip d={d}>{c.goal}</Chip>}
      </div>
      {c.muscles && c.muscles.length > 0 && (
        <span className="text-[11.5px]" style={{ color: d.muted }}>
          {c.muscles.join(' · ')}
        </span>
      )}
      <div className="flex flex-col gap-3">
        {blocks.map((b, i) => (
          <div key={i} className="flex flex-col gap-1">
            {b.name && (
              <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: d.accent }}>
                {b.name}
              </span>
            )}
            {b.exercises.map((e, j) => (
              <div
                key={j}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
                style={{ background: d.isDark ? 'rgba(255,255,255,0.04)' : '#F5F7FB' }}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: d.accent }}
                >
                  {j + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: d.text }}>
                  {e.name}
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: d.muted }}>
                  {dosage(e, d)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  )
}

export function HiroExerciseCardsView({
  content,
  d,
}: {
  content: HiroExerciseCardsTemplate['content']
  d: HiroDesign
}) {
  const c = content ?? {}
  const items = c.items ?? []
  if (!items.length) return null
  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={d.isArabic ? 'rtl' : 'ltr'}>
      {c.title && (
        <p className="font-semibold" style={{ color: d.text, fontSize: d.titleSize }}>
          {c.title}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((e, i) => (
          <div
            key={i}
            className="flex w-[210px] shrink-0 snap-start flex-col overflow-hidden"
            style={{ ...d.cardStyle, boxShadow: d.isDark ? undefined : '0 6px 22px rgba(30,60,120,0.07)' }}
          >
            {(e.image || e.video) && (
              <Media image={e.image} video={e.video} alt={e.name} height={118} d={d} Glyph={Dumbbell} />
            )}
            <div className="flex flex-1 flex-col gap-2" style={{ padding: 12 }}>
              <div className="flex items-center gap-2">
                <div
                  className="grid size-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${d.accent}14` }}
                >
                  <Dumbbell className="size-4" style={{ color: d.accent }} />
                </div>
                <span className="line-clamp-2 text-[13px] leading-snug font-semibold" style={{ color: d.text }}>
                  {e.name}
                </span>
              </div>
              {e.muscles && e.muscles.length > 0 && (
                <span className="text-[11px]" style={{ color: d.muted }}>
                  {e.muscles.join(' · ')}
                </span>
              )}
              {dosage(e, d) && <Chip d={d}>{dosage(e, d)}</Chip>}
              {e.description && (
                <p className="line-clamp-3 text-[11.5px] leading-relaxed" style={{ color: d.text }}>
                  {e.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- insights --------------------------------- */

const TONES = {
  good: { color: GOOD, Icon: CheckCircle2 },
  watch: { color: LOW, Icon: TriangleAlert },
  info: { color: '', Icon: Info },
}

export function HiroInsightView({ content, d }: { content: HiroInsightTemplate['content']; d: HiroDesign }) {
  const c = content ?? {}
  const points = c.points ?? []
  if (!points.length) return null
  const tone = TONES[c.tone ?? 'info']
  const color = tone.color || d.accent
  return (
    <div
      className="mt-2 flex w-full flex-col gap-2 rounded-2xl p-3.5"
      dir={d.isArabic ? 'rtl' : 'ltr'}
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}
    >
      <div className="flex items-center gap-2">
        <tone.Icon className="size-4 shrink-0" style={{ color }} />
        <span className="text-[13.5px] font-semibold" style={{ color: d.text }}>
          {c.title}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 ps-6">
        {points.map((p, i) => (
          <li key={i} className="list-disc text-[12.5px] leading-relaxed" style={{ color: d.text }}>
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
