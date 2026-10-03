import { Select } from '@/components/Select'
import { FONT_PRESETS } from '@/lib/webfont'
import { type WidgetConfig } from '@/lib/api'
import {
  bilingualText, currentLang, plainBilingualText, setBilingualText, setPlainBilingualText, translate,
  type WidgetLang,
} from '@/lib/builder'
import { HERO_BRAND_TOKEN } from '@/lib/heroDesign'
import { useI18n, type MsgKey } from '@/lib/i18n'

/* --------------------------------- controls -------------------------------- */

export type Get = (path: string) => any
export type Set = (path: string, val: unknown) => void
export interface PageProps { get: Get; set: Set; disabled: boolean }

export function Field({ label, path, get, set, disabled, placeholder }: { label: string; path: string; placeholder?: string } & PageProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" placeholder={placeholder} value={get(path) ?? ''} onChange={(e) => set(path, e.target.value)} disabled={disabled} />
    </div>
  )
}

/**
 * One field per language. Both are stored (`<path>.i18n.en` / `.ar`), and the
 * one matching the widget's current language is also what the widget shows, so
 * switching language on the Language page swaps in copy the channel wrote
 * instead of the built-in dictionary's guess.
 */
export function BilingualField({
  label, path, draft, setDraft, disabled,
}: {
  label: string
  path: string
  draft: WidgetConfig
  setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const live = currentLang(draft)
  const write = (lang: WidgetLang, v: string) => setDraft((d) => (d ? setBilingualText(d, path, lang, v) : d))
  return (
    <div className="sm:col-span-2">
      <label className="label">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['en', 'ar'] as const).map((lang) => (
          <div key={lang} className="relative">
            <input
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="input pe-12"
              value={bilingualText(draft, path, lang)}
              onChange={(e) => write(lang, e.target.value)}
              disabled={disabled}
              aria-label={`${label} — ${t(`locale.${lang}`)}`}
            />
            {/* The badge marks which of the two the widget is currently showing. */}
            <span
              dir="ltr"
              className={`pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${live === lang ? 'bg-accent text-white' : 'bg-surface text-faint'}`}
            >
              {lang}
            </span>
          </div>
        ))}
      </div>
      <p className="fine mt-1.5">{t('builder.bilingual.hint')}</p>
    </div>
  )
}

export function ColorField({ label, path, get, set, disabled }: { label: string; path: string } & PageProps) {
  const value = get(path) ?? ''
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1 transition-colors duration-200 hover:border-accent-300"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => set(path, e.target.value)}
          disabled={disabled}
          aria-label={label}
        />
        <input className="input mono" dir="ltr" value={value} onChange={(e) => set(path, e.target.value)} disabled={disabled} />
      </div>
    </div>
  )
}

/** `fallback` is what the widget does when the config says nothing — an unset toggle shows as that. */
export function ToggleField({ label, path, get, set, disabled, fallback = false }: { label: string; path: string; fallback?: boolean } & PageProps) {
  const value = get(path)
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px] font-bold text-ink transition-all duration-200 hover:border-accent-300 hover:bg-white">
      {label}
      <input type="checkbox" className="size-4 shrink-0 accent-[#4d98e2]" checked={value === undefined ? fallback : value !== false} onChange={(e) => set(path, e.target.checked)} disabled={disabled} />
    </label>
  )
}

export function SelectField({ label, path, options, get, set, disabled }: { label: string; path: string; options: string[] } & PageProps) {
  const { t } = useI18n()
  return (
    <div>
      <label className="label">{label}</label>
      <Select
        label={label}
        value={get(path) ?? ''}
        onChange={(v) => set(path, v)}
        disabled={disabled}
        placeholder={t('common.none')}
        options={options.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))}
      />
    </div>
  )
}

/** A number, as a slider paired with a box — the slider to feel it, the box to be exact. */
export function NumField({ label, path, min, max, step, fallback, unit, get, set, disabled }: { label: string; path: string; min: number; max: number; step: number; fallback: number; unit?: string } & PageProps) {
  const raw = get(path)
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
  const commit = (v: number) => set(path, Math.min(max, Math.max(min, Number.isFinite(v) ? v : fallback)))
  return (
    <div>
      <label className="label flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="mono text-[10px] font-normal text-faint normal-case">{value}{unit}</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value} disabled={disabled}
          onChange={(e) => commit(Number(e.target.value))}
          className="h-[42px] min-w-0 flex-1 cursor-pointer accent-[#4d98e2] disabled:cursor-not-allowed disabled:opacity-45"
          aria-label={label}
        />
        <input
          type="number" min={min} max={max} step={step} value={value} disabled={disabled}
          onChange={(e) => commit(Number(e.target.value))}
          className="input mono w-20 shrink-0 px-2 text-center" dir="ltr" aria-label={label}
        />
      </div>
    </div>
  )
}

/**
 * A font family, chosen from the offered stacks rather than typed. `custom`
 * keeps the free-text stack available for a channel that loads its own webfont.
 * An empty value means "inherit the widget's font".
 */
export function FontField({ label, path, get, set, disabled, allowInherit }: { label: string; path: string; allowInherit?: boolean } & PageProps) {
  const { t } = useI18n()
  const value = get(path) ?? ''
  const known = FONT_PRESETS.some((f) => f.value === value)
  const mode = value === '' && allowInherit ? 'inherit' : known ? value : 'custom'
  return (
    <>
      <div>
        <label className="label">{label}</label>
        <Select
          label={label}
          value={mode}
          onChange={(v) => {
            if (v === 'inherit') set(path, '')
            else if (v !== 'custom') set(path, v)
          }}
          disabled={disabled}
          options={[
            ...(allowInherit ? [{ value: 'inherit', label: t('builder.font.inherit') }] : []),
            ...FONT_PRESETS.map((f) => ({ value: f.value, label: f.label })),
            { value: 'custom', label: t('builder.theme.fontCustom') },
          ]}
        />
      </div>
      {mode === 'custom' && (
        <Field label={t('form.fontFamily')} path={path} get={get} set={set} disabled={disabled} placeholder="'Jost', sans-serif" />
      )}
    </>
  )
}

/** A fixed set of choices whose labels are translated from `<keyPrefix>.<value>`. */
export function ChoiceField({ label, path, options, keyPrefix, fallback, get, set, disabled }: { label: string; path: string; options: string[]; keyPrefix: string; fallback: string } & PageProps) {
  const { t } = useI18n()
  return (
    <div>
      <label className="label">{label}</label>
      <Select
        label={label}
        value={get(path) ?? fallback}
        onChange={(v) => set(path, v)}
        disabled={disabled}
        options={options.map((o) => ({ value: o, label: t(`${keyPrefix}.${o}` as MsgKey) }))}
      />
    </div>
  )
}

/**
 * A colour that may instead follow the channel's brand colour. Dots default to
 * the brand, so that has to stay expressible rather than being frozen to a hex.
 */
export function BrandColorField({ label, path, get, set, disabled }: { label: string; path: string } & PageProps) {
  const { t } = useI18n()
  const value = get(path) ?? ''
  const isBrand = value === HERO_BRAND_TOKEN
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1 transition-colors duration-200 hover:border-accent-300 disabled:cursor-not-allowed disabled:opacity-45"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => set(path, e.target.value)}
          disabled={disabled || isBrand}
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => set(path, isBrand ? '#A1A1A6' : HERO_BRAND_TOKEN)}
          disabled={disabled}
          className={`btn-sm shrink-0 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-all duration-200 ${isBrand ? 'border-accent bg-accent-50 text-accent-deep' : 'border-line bg-white text-muted hover:border-accent-300'}`}
        >
          {t('builder.hero.dots.brand')}
        </button>
        {!isBrand && <input className="input mono" dir="ltr" value={value} onChange={(e) => set(path, e.target.value)} disabled={disabled} />}
      </div>
    </div>
  )
}

/** Like BilingualField, but for plain string paths (value at `<path>`, translations at `<path>_i18n`). */
export function PlainBiField({
  label, path, draft, setDraft, disabled, placeholder,
}: {
  label: string
  path: string
  draft: WidgetConfig
  setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  const { t } = useI18n()
  const live = currentLang(draft)
  const write = (lang: WidgetLang, v: string) => setDraft((d) => (d ? setPlainBilingualText(d, path, lang, v) : d))
  return (
    <div className="sm:col-span-2">
      <label className="label">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['en', 'ar'] as const).map((lang) => (
          <div key={lang} className="relative">
            <input
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="input pe-12"
              value={plainBilingualText(draft, path, lang)}
              onChange={(e) => write(lang, e.target.value)}
              disabled={disabled}
              placeholder={lang === 'en' ? placeholder : undefined}
              aria-label={`${label} — ${t(`locale.${lang}`)}`}
            />
            <span
              dir="ltr"
              className={`pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${live === lang ? 'bg-accent text-white' : 'bg-surface text-faint'}`}
            >
              {lang}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** One EN/AR input pair for a field inside a list item (label, placeholder, point text). */
export function ItemBiInputs({
  live, value, i18n, onWrite, disabled, textarea,
}: {
  live: WidgetLang
  value: string
  i18n: Partial<Record<WidgetLang, string>>
  onWrite: (lang: WidgetLang, v: string) => void
  disabled?: boolean
  textarea?: boolean
}) {
  const shown = (lang: WidgetLang) => i18n[lang] ?? (live === lang ? value : (translate(value, lang) ?? ''))
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(['en', 'ar'] as const).map((lang) => {
        const common = {
          dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const),
          value: shown(lang),
          disabled,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onWrite(lang, e.target.value),
        }
        return (
          <div key={lang} className="relative">
            {textarea ? (
              <textarea className="input min-h-16 resize-y pe-12" {...common} />
            ) : (
              <input className="input pe-12" {...common} />
            )}
            <span
              dir="ltr"
              className={`pointer-events-none absolute end-2 top-2.5 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${live === lang ? 'bg-accent text-white' : 'bg-surface text-faint'}`}
            >
              {lang}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Shadow controls, shared by every surface that casts one. */
export function ShadowFields({ base, get, set, disabled }: { base: string } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${base}.${k}`
  return (
    <>
      <NumField label={t('builder.sh.spread')} path={p('size')} min={0} max={80} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
      <NumField label={t('builder.sh.y')} path={p('y')} min={-40} max={40} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
      <NumField label={t('builder.sh.blur')} path={p('blur')} min={0} max={80} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
      <BrandColorField label={t('builder.sh.color')} path={p('color')} get={get} set={set} disabled={disabled} />
      <NumField label={t('builder.sh.opacity')} path={p('opacity')} min={0} max={1} step={0.01} fallback={0.08} get={get} set={set} disabled={disabled} />
    </>
  )
}
