import { Check, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Source } from '@/lib/api'
import { LOCALES, useI18n, type MsgKey } from '@/lib/i18n'
import { PairMark } from './brand'

export { PairMark, PairWordmark, PairLockup } from './brand'

export function SourceBadge({ source }: { source: Source }) {
  const { t } = useI18n()
  return source === 'redis' ? (
    <span className="badge border border-accent-200 bg-accent-50 text-accent-deep"><span className="size-1.5 rounded-full bg-accent-deep" />{t('source.redis')}</span>
  ) : (
    <span className="badge border border-line bg-white text-accent"><span className="size-1.5 rounded-full bg-accent" />{t('source.api')}</span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n()
  const tone: Record<string, string> = {
    admin: 'border-accent bg-white text-accent-deep',
    editor: 'border-accent-200 bg-accent-50 text-accent',
    viewer: 'border-divider bg-code text-muted',
  }
  const key = (['admin', 'editor', 'viewer'].includes(role) ? `role.${role}` : 'role.viewer') as MsgKey
  return <span className={`badge border ${tone[role] ?? tone.viewer}`}>{t(key)}</span>
}

/** Locale switch. Animates the active pill and flips the document direction. */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-white p-0.5" role="group" aria-label={t('common.language')}>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={locale === l.code}
          className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all duration-200 ${locale === l.code ? 'bg-accent text-white' : 'text-muted hover:bg-accent-50 hover:text-accent-deep'}`}
        >
          {compact ? l.short : l.native}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useI18n()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className={`card raise anim-pop scroll-pane max-h-[92dvh] w-full rounded-b-none p-5 outline-none sm:rounded-xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold leading-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] leading-[1.55] text-muted">{subtitle}</p>}
          </div>
          <button className="btn-quiet -me-1.5 -mt-1 shrink-0 rounded-md p-1.5" onClick={onClose} aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <span className={`inline-block shrink-0 animate-spin rounded-full border-2 border-accent-200 border-t-accent ${className}`} role="status" />
}

export function Loading({ full }: { full?: boolean }) {
  return (
    <div className={`anim-fade flex flex-1 flex-col items-center justify-center gap-4 ${full ? 'h-dvh' : 'min-h-[50dvh] py-10'}`} role="status" aria-live="polite">
      <PairMark className="h-7 text-accent" />
      <span className="block h-[3px] w-28 overflow-hidden rounded-full bg-accent-100">
        <span className="block h-full w-1/3 rounded-full bg-accent" style={{ animation: 'track 1.15s cubic-bezier(0.65, 0, 0.35, 1) infinite' }} />
      </span>
    </div>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card anim-rise flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <PairMark className="mb-2 h-7 text-accent-200" />
      <p className="font-bold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-[13px] leading-[1.6] text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, delay = 0 }: { label: string; value: ReactNode; sub?: string; delay?: number }) {
  return (
    <div className="card lift px-4 py-3.5" style={{ '--d': delay } as React.CSSProperties}>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-none text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-faint">{sub}</p>}
    </div>
  )
}

/** Section heading with the spec's 1.5px accent rule. */
export function SectionHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="rule-head mb-3.5 justify-between">
      <span>{children}</span>
      {aside}
    </div>
  )
}

export function PageHead({ eyebrow, title, lede, action }: { eyebrow: string; title: string; lede?: string; action?: ReactNode }) {
  return (
    <div className="anim-rise flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-[1.2] tracking-[-0.005em] text-ink sm:text-[26px]">{title}</h1>
        {lede && <p className="mt-2 max-w-[52em] text-[13px] leading-[1.6] text-muted">{lede}</p>}
      </div>
      {action}
    </div>
  )
}

/** Inline confirmation tick used after copy actions. */
export function CopyIcon({ copied, fallback }: { copied: boolean; fallback: ReactNode }) {
  return copied ? <Check className="size-4 text-accent-deep" /> : <>{fallback}</>
}

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-surface/60 p-3 transition-colors duration-200 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-bold uppercase tracking-[0.09em] text-muted transition-colors hover:text-accent-deep">
        {summary}
        <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="anim-rise mt-3 space-y-3">{children}</div>
    </details>
  )
}

/** Password field with a show/hide toggle. The eye sits inside the field, on the trailing edge. */
export function PasswordInput({
  value,
  onChange,
  label,
  autoComplete = 'current-password',
  minLength,
  autoFocus,
  placeholder,
  hint,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  autoComplete?: string
  minLength?: number
  autoFocus?: boolean
  placeholder?: string
  hint?: string
}) {
  const { t } = useI18n()
  const [shown, setShown] = useState(false)
  const id = useId()

  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative" dir="ltr">
        <input
          id={id}
          className="input pe-11"
          type={shown ? 'text' : 'password'}
          dir="ltr"
          autoComplete={autoComplete}
          minLength={minLength}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={t(shown ? 'common.hidePassword' : 'common.showPassword')}
          aria-pressed={shown}
          title={t(shown ? 'common.hidePassword' : 'common.showPassword')}
          className="absolute end-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-all duration-200 hover:bg-accent-50 hover:text-accent-deep"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint && <p className="fine mt-1.5">{hint}</p>}
    </div>
  )
}

/**
 * Scales a fixed-size child down until it fits the box it is given, so the whole
 * thing is always visible without scrolling. Never scales up past 1:1.
 */
export function FitScale({ width, height, className = '', children }: { width: number; height: number; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      setScale(Math.min(1, r.width / width, r.height / height))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  return (
    <div
      ref={box}
      className={`flex min-h-0 w-full justify-center overflow-hidden ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        className="shrink-0 transition-transform duration-300 ease-out"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        {children}
      </div>
    </div>
  )
}

/** Page strip for long lists. Collapses to arrows plus a counter on narrow screens. */
export const PER_PAGE_CHOICES = [8, 16, 32, 64]

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
  perPage,
  onPerPage,
}: {
  page: number
  pageCount: number
  total: number
  from: number
  to: number
  onPage: (p: number) => void
  perPage?: number
  onPerPage?: (n: number) => void
}) {
  const { t } = useI18n()
  if (total === 0) return null

  // Always show first, last, current and its neighbours; gaps become an ellipsis.
  const pages: (number | 'gap')[] = []
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i)
    else if (pages.at(-1) !== 'gap') pages.push('gap')
  }

  const arrow = 'flex size-8 items-center justify-center rounded-md border border-line bg-white text-muted transition-all duration-200 hover:border-accent-300 hover:text-accent-deep disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="anim-fade flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <p className="fine tabular-nums">{t('pager.range', { from, to, total })}</p>
        {perPage !== undefined && onPerPage && (
          <label className="flex items-center gap-1.5">
            <span className="fine whitespace-nowrap">{t('pager.perPage')}</span>
            <select
              className="input w-auto py-1 text-[12px] font-bold"
              value={perPage}
              onChange={(e) => onPerPage(Number(e.target.value))}
              aria-label={t('pager.perPage')}
            >
              {PER_PAGE_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button className={arrow} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('pager.prev')}>
          <ChevronLeft className="size-4 rtl:-scale-x-100" />
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-[11px] font-bold text-faint">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                aria-current={p === page}
                className={`size-8 rounded-md text-[12px] font-bold tabular-nums transition-all duration-200 ${
                  p === page ? 'bg-accent text-white' : 'border border-line bg-white text-muted hover:border-accent-300 hover:text-accent-deep'
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <span className="fine tabular-nums sm:hidden">{page} / {pageCount}</span>
        <button className={arrow} onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label={t('pager.next')}>
          <ChevronRight className="size-4 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  )
}
