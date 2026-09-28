import {
  ArrowDown, ArrowLeft, ArrowUp, BellRing, Check, ClipboardList, Download, Image as ImageIcon, Languages,
  LayoutGrid, LoaderCircle, MessagesSquare,
  Moon, Palette, PanelTop, Plus, RotateCcw, Rocket, Save, Share2, ShieldCheck, Sparkles, Star, Sun,
  TextCursorInput, Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconField } from '@/components/IconField'
import { MediaInput } from '@/components/MediaInput'
import { Select } from '@/components/Select'
import { SEND_ICONS, SendIcon, asSendIcon } from '@/components/sendIcons'
import { FONT_PRESETS } from '@/lib/webfont'
import { Disclosure, FitScale, Loading, SectionHead, Spinner } from '@/components/ui'
import { api, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PairWordmark } from '@/components/brand'
import {
  BILINGUAL_PATHS, PREVIEW_FRAME_PATH, applyLanguage, applyTheme, bilingualText, currentLang, currentTheme, deepGet, deepSet, setBilingualText,
  plainBilingualText, setPlainBilingualText, translate,
  isPreviewOutMsg, type PreviewEventMsg, type PreviewInMsg, type ThemeName, type WidgetLang,
} from '@/lib/builder'
import {
  HERO_BRAND_TOKEN, HERO_DECORS, HERO_DECOR_MOTIONS, HERO_DRIFTS, HERO_ENTRANCES, HERO_LAYOUTS,
  HERO_PATTERNS, HERO_PRESETS, HERO_PRESET_IDS, normalizeHeroSlide,
} from '@/lib/heroDesign'
import {
  BORDER_STYLES, BUTTON_SHAPES, FONT_WEIGHTS, INPUT_LAYOUTS, LAUNCHER_ATTENTION, LAUNCHER_ENTRANCES,
  CARD_LAYOUTS, CHIP_LAYOUTS, ICON_POSITIONS, IMAGE_FITS, LAUNCHER_ICONS, LOADING_TYPES,
  SEND_POSITIONS, TEXT_ALIGNS, TOAST_POSITIONS,
} from '@/lib/inputDesign'
import { useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

type Section =
  | 'theme' | 'language' | 'header' | 'hero' | 'quicklinks' | 'prompts' | 'input' | 'messages'
  | 'prechat' | 'consent' | 'rating' | 'loading' | 'toast' | 'launcher'

const SECTIONS: Array<{ id: Section; icon: React.ReactNode }> = [
  { id: 'theme', icon: <Palette className="size-4" /> },
  { id: 'language', icon: <Languages className="size-4" /> },
  { id: 'header', icon: <PanelTop className="size-4" /> },
  { id: 'hero', icon: <ImageIcon className="size-4" /> },
  { id: 'quicklinks', icon: <LayoutGrid className="size-4" /> },
  { id: 'prompts', icon: <Sparkles className="size-4" /> },
  { id: 'input', icon: <TextCursorInput className="size-4" /> },
  { id: 'messages', icon: <MessagesSquare className="size-4" /> },
  { id: 'prechat', icon: <ClipboardList className="size-4" /> },
  { id: 'consent', icon: <ShieldCheck className="size-4" /> },
  { id: 'rating', icon: <Star className="size-4" /> },
  { id: 'loading', icon: <LoaderCircle className="size-4" /> },
  { id: 'toast', icon: <BellRing className="size-4" /> },
  { id: 'launcher', icon: <Rocket className="size-4" /> },
]

/**
 * Visual builder: one page per design area, edited against a draft config,
 * with a live preview frame that receives every keystroke over postMessage —
 * the same channel an embedded widget uses for live design updates.
 */
export function Builder() {
  const { widgetId = '' } = useParams()
  const toast = useToast()
  const { can } = useAuth()
  const { t } = useI18n()
  const editor = can('editor')

  const [widget, setWidget] = useState<Widget | null>(null)
  const [stored, setStored] = useState<WidgetConfig | null>(null)
  const [draft, setDraft] = useState<WidgetConfig | null>(null)
  const [section, setSection] = useState<Section>('theme')
  const [dark, setDark] = useState(false)
  const [pushedLang, setPushedLang] = useState<WidgetLang | null>(null)
  const [pushedTheme, setPushedTheme] = useState<ThemeName | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const r = await api.getWidget(widgetId)
    setWidget(r.widget)
    setStored(r.storedConfig)
    setDraft(r.storedConfig ? (structuredClone(r.storedConfig) as WidgetConfig) : null)
    setLoaded(true)
  }, [widgetId])
  useEffect(() => { load().catch((e) => toast.err((e as Error).message)) }, [load, toast])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(stored), [draft, stored])

  /* ------------------------- postMessage to the frame ------------------------- */
  const frame = useRef<HTMLIFrameElement>(null)
  const [frameReady, setFrameReady] = useState(false)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && isPreviewOutMsg(e.data)) setFrameReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!frameReady) return
    frame.current?.contentWindow?.postMessage(
      { type: 'pws:config', config: draft, dark, focus: section } satisfies PreviewInMsg,
      window.location.origin,
    )
  }, [draft, dark, section, frameReady])

  /** Push a runtime event to the frame — preview only, the draft is untouched. */
  const pushEvent = (msg: PreviewEventMsg) => {
    frame.current?.contentWindow?.postMessage(msg satisfies PreviewInMsg, window.location.origin)
    if (msg.name === 'set-language') setPushedLang(msg.value)
    if (msg.name === 'set-theme') setPushedTheme(msg.value)
  }

  /** Commit what the preview is currently showing (pushed language/theme) into the draft. */
  const applyPushed = () => {
    setDraft((d) => {
      if (!d) return d
      let next = d
      if (pushedLang) next = applyLanguage(next, pushedLang)
      if (pushedTheme) next = applyTheme(next, pushedTheme)
      return next
    })
    setPushedLang(null)
    setPushedTheme(null)
    toast.ok(t('builder.push.applied'))
  }

  /* --------------------------------- actions -------------------------------- */
  const set = (path: string, val: unknown) => setDraft((d) => (d ? deepSet(d, path, val) : d))
  const get = (path: string) => deepGet(draft, path)

  const save = async () => {
    if (!draft) return
    setBusy('save')
    try {
      const r = await api.saveConfig(widgetId, draft)
      setWidget(r.widget)
      setStored(structuredClone(draft) as WidgetConfig)
      toast.ok(t('detail.saved'))
    } catch (e) { toast.err((e as Error).message) } finally { setBusy(null) }
  }
  const reset = () => setDraft(stored ? (structuredClone(stored) as WidgetConfig) : null)
  const importApi = async () => {
    setBusy('import')
    try {
      const r = await api.importFromApi(widgetId)
      setWidget(r.widget)
      setStored(r.storedConfig)
      setDraft(structuredClone(r.storedConfig) as WidgetConfig)
      toast.ok(t('detail.imported'))
    } catch (e) { toast.err((e as Error).message) } finally { setBusy(null) }
  }

  if (!loaded || !widget) return <Loading />

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="anim-rise flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2.5">
        <Link
          to={`/widgets/${encodeURIComponent(widgetId)}`}
          title={t('builder.back')}
          aria-label={t('builder.back')}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition-all duration-200 hover:border-accent-300 hover:text-accent-deep"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.005em] text-ink sm:text-[20px]">
              {t('builder.title', { name: widget.channelName })}
            </h1>
            {dirty && <span className="badge border border-accent bg-white text-accent-deep">{t('detail.unsaved')}</span>}
          </div>
          <p className="mono truncate text-[10.5px] leading-tight text-faint">{widget.widgetId}</p>
        </div>
        <button
          className="btn-ghost btn-sm shrink-0"
          onClick={async () => {
            const url = `${window.location.origin}/api/public/widget/${encodeURIComponent(widgetId)}/embed`
            try {
              await navigator.clipboard.writeText(url)
              toast.ok(t('builder.share.copied'))
            } catch {
              window.open(url, '_blank', 'noreferrer')
            }
          }}
          title={t('builder.share')}
        >
          <Share2 className="size-4" />
          <span className="hidden md:inline">{t('builder.share')}</span>
        </button>
        {editor && (
          <div className="flex shrink-0 gap-1.5">
            <button className="btn-ghost btn-sm" onClick={reset} disabled={!dirty || !!busy} title={t('builder.reset')} aria-label={t('builder.reset')}>
              <RotateCcw className="size-4" />
            </button>
            <button className="btn-primary btn-sm px-3" onClick={save} disabled={!dirty || !!busy || !draft}>
              {busy === 'save' ? <Spinner className="size-4 border-white/40 border-t-white" /> : <Save className="size-4" />}
              <span className="hidden md:inline">{t('detail.save')}</span>
            </button>
          </div>
        )}
      </div>

      {!draft ? (
        <div className="card anim-rise m-auto max-w-md p-8 text-center">
          <p className="font-bold text-ink">{t('form.empty.title')}</p>
          <p className="mx-auto mt-1.5 text-[12.5px] leading-[1.6] text-muted">{t('builder.empty.hint')}</p>
          {editor && (
            <button className="btn-primary mt-4" onClick={importApi} disabled={!!busy}>
              {busy === 'import' ? <Spinner className="size-4 border-white/40 border-t-white" /> : <Download className="size-4" />}
              {t('detail.import')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[200px_minmax(0,1fr)_360px]">
          {/* Section rail: the builder's pages */}
          <nav className="card scroll-pane flex gap-1 overflow-x-auto p-1.5 xl:flex-col xl:overflow-y-auto" aria-label={t('builder.sections')}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-current={section === s.id}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12.5px] font-bold transition-all duration-200 ${
                  section === s.id ? 'bg-accent-50 text-accent-deep' : 'text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {s.icon}
                {t(`builder.section.${s.id}` as MsgKey)}
              </button>
            ))}
          </nav>

          {/* Active builder page */}
          <div key={section} className="card scroll-pane anim-fade p-4 sm:p-5 xl:min-h-0 xl:overflow-y-auto">
            {section === 'theme' && <ThemePage draft={draft} setDraft={setDraft} get={get} set={set} disabled={!editor} />}
            {section === 'language' && <LanguagePage draft={draft} setDraft={setDraft} disabled={!editor} />}
            {section === 'header' && <HeaderPage get={get} set={set} disabled={!editor} />}
            {section === 'hero' && <HeroPage draft={draft} setDraft={setDraft} get={get} set={set} disabled={!editor} />}
            {section === 'quicklinks' && <QuickLinksPage get={get} set={set} disabled={!editor} />}
            {section === 'prompts' && <PromptsPage get={get} set={set} disabled={!editor} />}
            {section === 'input' && <InputPage get={get} set={set} disabled={!editor} />}
            {section === 'messages' && <MessagesPage draft={draft} setDraft={setDraft} get={get} set={set} disabled={!editor} />}
            {section === 'prechat' && <PreChatPage draft={draft} setDraft={setDraft} get={get} set={set} disabled={!editor} />}
            {section === 'consent' && <ConsentPage draft={draft} setDraft={setDraft} get={get} set={set} disabled={!editor} />}
            {section === 'rating' && <RatingPage draft={draft} setDraft={setDraft} get={get} set={set} disabled={!editor} />}
            {section === 'loading' && <LoadingPage get={get} set={set} disabled={!editor} />}
            {section === 'toast' && <ToastPage get={get} set={set} disabled={!editor} />}
            {section === 'launcher' && <LauncherPage get={get} set={set} disabled={!editor} />}
          </div>

          {/* Live preview frame, fed over postMessage */}
          <div className="flex min-w-0 flex-col xl:min-h-0">
            <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
              <p className="eyebrow">{t('builder.livePreview')}</p>
              <button className="btn-ghost btn-sm" onClick={() => setDark((d) => !d)} title={t('detail.preview.dark')} aria-label={t('detail.preview.dark')}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
            <FitScale width={352} height={572} className="max-h-[72dvh] xl:max-h-none xl:flex-1">
              <div className="size-full overflow-hidden rounded-[14px] bg-ink p-1.5 shadow-[0_18px_50px_rgba(15,18,22,0.35)]">
                <iframe
                  ref={frame}
                  src={PREVIEW_FRAME_PATH}
                  title={t('builder.livePreview')}
                  className="size-full rounded-[9px] border-0 bg-white"
                />
              </div>
            </FitScale>

            {/* Runtime events, pushed to the frame over postMessage — the draft never changes. */}
            <div className="mt-2.5 flex shrink-0 flex-wrap items-center justify-center gap-2">
              <PairWordmark className="h-4 shrink-0 text-accent" />
              <span className="h-4 w-px shrink-0 bg-divider" aria-hidden />
              <div className="flex rounded-lg border border-line bg-code p-0.5" role="group" aria-label={t('builder.push.lang')}>
                <PushChip active={pushedLang === 'en'} onClick={() => pushEvent({ type: 'pws:event', name: 'set-language', value: 'en' })} label="EN" title={t('builder.push.lang')} />
                <PushChip active={pushedLang === 'ar'} onClick={() => pushEvent({ type: 'pws:event', name: 'set-language', value: 'ar' })} label="عربي" title={t('builder.push.lang')} />
              </div>
              <div className="flex rounded-lg border border-line bg-code p-0.5" role="group" aria-label={t('builder.push.theme')}>
                <PushChip active={pushedTheme === 'light'} onClick={() => pushEvent({ type: 'pws:event', name: 'set-theme', value: 'light' })} label={<Sun className="size-3.5" />} title={t('builder.theme.light')} />
                <PushChip active={pushedTheme === 'dark'} onClick={() => pushEvent({ type: 'pws:event', name: 'set-theme', value: 'dark' })} label={<Moon className="size-3.5" />} title={t('builder.theme.dark')} />
              </div>
              {editor && (
                <button
                  className="btn-ghost btn-sm"
                  onClick={applyPushed}
                  disabled={!pushedLang && !pushedTheme}
                  title={t('builder.push.apply')}
                >
                  <Check className="size-3.5" />
                  {t('builder.push.apply')}
                </button>
              )}
            </div>
            <p className="fine mt-2 text-center">{t('builder.postMessageNote')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function PushChip({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold transition-all duration-200 ${
        active ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

/* --------------------------------- controls -------------------------------- */

type Get = (path: string) => any
type Set = (path: string, val: unknown) => void
interface PageProps { get: Get; set: Set; disabled: boolean }

function Field({ label, path, get, set, disabled, placeholder }: { label: string; path: string; placeholder?: string } & PageProps) {
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
function BilingualField({
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

function ColorField({ label, path, get, set, disabled }: { label: string; path: string } & PageProps) {
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

function ToggleField({ label, path, get, set, disabled }: { label: string; path: string } & PageProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px] font-bold text-ink transition-all duration-200 hover:border-accent-300 hover:bg-white">
      {label}
      <input type="checkbox" className="size-4 shrink-0 accent-[#4d98e2]" checked={get(path) !== false && get(path) !== undefined} onChange={(e) => set(path, e.target.checked)} disabled={disabled} />
    </label>
  )
}

function SelectField({ label, path, options, get, set, disabled }: { label: string; path: string; options: string[] } & PageProps) {
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
function NumField({ label, path, min, max, step, fallback, unit, get, set, disabled }: { label: string; path: string; min: number; max: number; step: number; fallback: number; unit?: string } & PageProps) {
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
function FontField({ label, path, get, set, disabled, allowInherit }: { label: string; path: string; allowInherit?: boolean } & PageProps) {
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
function ChoiceField({ label, path, options, keyPrefix, fallback, get, set, disabled }: { label: string; path: string; options: string[]; keyPrefix: string; fallback: string } & PageProps) {
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
function BrandColorField({ label, path, get, set, disabled }: { label: string; path: string } & PageProps) {
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

/* ----------------------------------- pages ---------------------------------- */

function ThemePage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const active = currentTheme(draft)
  const apply = (theme: ThemeName) => setDraft((d) => (d ? applyTheme(d, theme) : d))

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.theme.presets')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <ThemeCard name="dark" active={active === 'dark'} onClick={() => apply('dark')} disabled={disabled} label={t('builder.theme.dark')} note={t('builder.theme.darkNote')} />
          <ThemeCard name="light" active={active === 'light'} onClick={() => apply('light')} disabled={disabled} label={t('builder.theme.light')} note={t('builder.theme.lightNote')} />
        </div>
        <p className="callout mt-3.5">{t('builder.theme.note')}</p>
      </section>
      <section>
        <SectionHead>{t('form.brand')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.name')} path="name" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.color')} path="widget_color" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.widgetBg')} path="widget_v2_config.intro_screen.widgetBackground.background" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.theme.fontPreset')} path="styles.fontFamily" get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}

function ThemeCard({ name, active, onClick, disabled, label, note }: { name: ThemeName; active: boolean; onClick: () => void; disabled: boolean; label: string; note: string }) {
  const darkChip = name === 'dark'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`card lift flex items-center gap-3.5 p-4 text-start transition-all duration-200 ${active ? 'ring-2 ring-accent' : ''}`}
    >
      <span
        className="grid size-12 shrink-0 place-items-center rounded-xl border"
        style={{ background: darkChip ? '#000000' : '#FFFFFF', borderColor: darkChip ? '#2C2C2E' : '#E5E5EA', color: darkChip ? '#FFFFFF' : '#000000' }}
      >
        {darkChip ? <Moon className="size-5" /> : <Sun className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-muted">{note}</span>
      </span>
    </button>
  )
}

function LanguagePage({ draft, setDraft, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void; disabled: boolean }) {
  const { t } = useI18n()
  const active = currentLang(draft)
  const apply = (lang: WidgetLang) => setDraft((d) => (d ? applyLanguage(d, lang) : d))

  return (
    <div className="space-y-5">
      <section>
        <SectionHead>{t('builder.lang.title')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <LangCard flag="🇺🇸" label={t('locale.en')} note={t('builder.lang.enNote')} active={active === 'en'} onClick={() => apply('en')} disabled={disabled} />
          <LangCard flag="🇰🇼" label={t('locale.ar')} note={t('builder.lang.arNote')} active={active === 'ar'} onClick={() => apply('ar')} disabled={disabled} />
        </div>
      </section>
      <p className="callout">{t('builder.lang.note')}</p>
    </div>
  )
}

function LangCard({ flag, label, note, active, onClick, disabled }: { flag: string; label: string; note: string; active: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={active} className={`card lift flex items-center gap-3.5 p-4 text-start transition-all duration-200 ${active ? 'ring-2 ring-accent' : ''}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-[22px]" aria-hidden>{flag}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-muted">{note}</span>
      </span>
    </button>
  )
}

/** Like BilingualField, but for plain string paths (value at `<path>`, translations at `<path>_i18n`). */
function PlainBiField({
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
function ItemBiInputs({
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

function HeaderPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.header')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.headerTitle')} path="widget_v2_config.header.content.title" get={get} set={set} disabled={disabled} />
          <Field label={t('form.headerSubtitle')} path="widget_v2_config.header.content.subtitle" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.headerBg')} path="widget_v2_config.header.background.color" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.header.titleColor')} path="widget_v2_config.header.titleStyle.color" get={get} set={set} disabled={disabled} />
          <div className="grid content-end gap-2">
            <ToggleField label={t('form.headerShow')} path="widget_v2_config.header.enabled" get={get} set={set} disabled={disabled} />
            <ToggleField label={t('form.headerBgOn')} path="widget_v2_config.header.background.enabled" get={get} set={set} disabled={disabled} />
          </div>
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.header.controls')}</SectionHead>
        <p className="callout mb-4">{t('builder.header.controlsHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.header.langToggle')} path="widget_v2_config.header.controls.lang.show" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.header.themeToggle')} path="widget_v2_config.header.controls.theme.show" get={get} set={set} disabled={disabled} />
          {get('widget_v2_config.header.controls.lang.show') !== false && (
            <IconField
              label={t('builder.header.langIcon')} set="lang"
              value={get('widget_v2_config.header.controls.lang.icon')} url={get('widget_v2_config.header.controls.lang.iconUrl')}
              onChange={(v) => set('widget_v2_config.header.controls.lang.icon', v)} onUrlChange={(v) => set('widget_v2_config.header.controls.lang.iconUrl', v)}
              disabled={disabled}
            />
          )}
          {get('widget_v2_config.header.controls.theme.show') !== false && (
            <IconField
              label={t('builder.header.themeIcon')} set="theme"
              value={get('widget_v2_config.header.controls.theme.icon')} url={get('widget_v2_config.header.controls.theme.iconUrl')}
              onChange={(v) => set('widget_v2_config.header.controls.theme.icon', v)} onUrlChange={(v) => set('widget_v2_config.header.controls.theme.iconUrl', v)}
              disabled={disabled}
            />
          )}
        </div>
      </section>
      <section>
        <SectionHead>{t('form.avatar')}</SectionHead>
        <MediaInput label={t('form.avatar')} value={get('avatar_url') ?? ''} onChange={(v) => set('avatar_url', v)} disabled={disabled} />
      </section>
    </div>
  )
}

/* ------------------------------------ hero ---------------------------------- */

const HERO = 'widget_v2_config.intro_screen.heroSection'
const HERO_IMAGES = `${HERO}.heroImages`
const HERO_SINGLE = `${HERO}.heroImage.url`
const HERO_CAROUSEL = `${HERO}.carousel`

/** A hero slide as stored in the config: an uploaded image, or an editable design. */
type StoredSlide = { type?: 'image' | 'design'; url?: string; design?: unknown; style?: string }

function HeroPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const raw = get(HERO_IMAGES)
  const stored: StoredSlide[] = Array.isArray(raw) && raw.length ? raw : [{ type: 'image', url: get(HERO_SINGLE) ?? '' }]
  const slides = stored.map((s) => normalizeHeroSlide(s))

  const write = (next: StoredSlide[]) => {
    set(HERO_IMAGES, next)
    // The SDK's legacy single-hero field still has to point at something drawable.
    set(HERO_SINGLE, next.find((s) => s.type !== 'design' && s.url?.trim())?.url ?? '')
  }
  const patch = (i: number, p: StoredSlide) => write(stored.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...stored]
    const [s] = next.splice(i, 1)
    next.splice(i + dir, 0, s)
    write(next)
  }
  /** Switching to a design writes a whole one, so every field below has a real value to show. */
  const setType = (i: number, v: string) =>
    write(stored.map((s, j) => (j !== i ? s : v === 'design' ? { type: 'design', design: HERO_PRESETS['cinescape-night'].design } : { type: 'image', url: s.url ?? '' })))

  const filled = slides.filter((s) => s !== null).length

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.intro')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <BilingualField label={t('form.welcomeTitle')} path={BILINGUAL_PATHS[0]} draft={draft} setDraft={setDraft} disabled={disabled} />
          <BilingualField label={t('form.welcomeSubtitle')} path={BILINGUAL_PATHS[1]} draft={draft} setDraft={setDraft} disabled={disabled} />
          <ToggleField label={t('form.heroShow')} path={`${HERO}.enabled.value`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('form.introShow')} path="widget_v2_config.intro_screen.showIntroScreen.value" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <CarouselSection get={get} set={set} disabled={disabled} />

      <section>
        <SectionHead
          aside={
            !disabled && (
              <div className="-my-1 flex items-center gap-1">
                <button className="btn-quiet btn-sm normal-case" onClick={() => write([...stored, { type: 'image', url: '' }])}>
                  <Plus className="size-3.5" />
                  {t('builder.hero.add')}
                </button>
                <button className="btn-quiet btn-sm normal-case" onClick={() => write([...stored, { type: 'design', design: HERO_PRESETS['cinescape-night'].design }])}>
                  <Plus className="size-3.5" />
                  {t('builder.hero.addDesign')}
                </button>
              </div>
            )
          }
        >
          {t('builder.hero.list', { count: filled })}
        </SectionHead>
        <p className="callout mb-3">{t('builder.hero.hint')}</p>
        <ul className="space-y-3">
          {stored.map((s, i) => (
            <li key={i} className="row-in rounded-xl border border-line bg-surface/40 p-3.5" style={{ '--d': i } as React.CSSProperties}>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="eyebrow">{t('builder.hero.slide', { n: i + 1 })}</span>
                <div className="flex items-center gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={disabled || i === 0} title={t('builder.moveUp')} aria-label={t('builder.moveUp')}><ArrowUp className="size-3.5" /></button>
                  <button className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={disabled || i === stored.length - 1} title={t('builder.moveDown')} aria-label={t('builder.moveDown')}><ArrowDown className="size-3.5" /></button>
                  <button className="btn-danger btn-sm" onClick={() => write(stored.filter((_, j) => j !== i))} disabled={disabled || stored.length === 1} title={t('common.delete')} aria-label={t('common.delete')}><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{t('builder.hero.type')}</label>
                  <Select
                    label={t('builder.hero.type')}
                    value={s.type === 'design' || s.design ? 'design' : 'image'}
                    onChange={(v) => setType(i, v)}
                    disabled={disabled}
                    options={[
                      { value: 'image', label: t('builder.hero.type.image') },
                      { value: 'design', label: t('builder.hero.type.design') },
                    ]}
                  />
                </div>
                {s.type === 'design' || s.design ? (
                  <div className="sm:col-span-2">
                    <DesignEditor base={`${HERO_IMAGES}.${i}.design`} onPreset={(id) => patch(i, { type: 'design', design: HERO_PRESETS[id].design })} get={get} set={set} disabled={disabled} />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <MediaInput label={t('builder.hero.image', { n: i + 1 })} value={s.url ?? ''} onChange={(v) => patch(i, { type: 'image', url: v })} disabled={disabled} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** How long a slide is held, how slides change, and how the dots look. */
function CarouselSection({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${HERO_CAROUSEL}.${k}`
  const d = (k: string) => `${HERO_CAROUSEL}.dots.${k}`
  return (
    <section>
      <SectionHead>{t('builder.hero.carousel')}</SectionHead>
      <p className="callout mb-3">{t('builder.hero.carouselHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('builder.hero.autoplay')} path={p('autoplay')} get={get} set={set} disabled={disabled} />
        <ChoiceField label={t('builder.hero.transition')} path={p('transition')} options={['fade', 'slide']} keyPrefix="builder.hero.transition" fallback="fade" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.interval')} path={p('intervalMs')} min={800} max={15000} step={100} fallback={3500} unit="ms" get={get} set={set} disabled={disabled} />
      </div>

      <p className="eyebrow mt-5 mb-2">{t('builder.hero.dots')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('builder.hero.dots.show')} path={d('show')} get={get} set={set} disabled={disabled} />
        <ChoiceField label={t('builder.hero.dots.shape')} path={d('shape')} options={['pill', 'dot', 'bar']} keyPrefix="builder.hero.dots.shape" fallback="pill" get={get} set={set} disabled={disabled} />
        <ChoiceField label={t('builder.hero.dots.position')} path={d('position')} options={['below', 'overlay']} keyPrefix="builder.hero.dots.position" fallback="below" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.size')} path={d('size')} min={2} max={20} step={1} fallback={5} unit="px" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.activeWidth')} path={d('activeWidth')} min={2} max={60} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.gap')} path={d('gap')} min={0} max={24} step={1} fallback={6} unit="px" get={get} set={set} disabled={disabled} />
        <BrandColorField label={t('builder.hero.dots.activeColor')} path={d('activeColor')} get={get} set={set} disabled={disabled} />
        <BrandColorField label={t('builder.hero.dots.inactiveColor')} path={d('inactiveColor')} get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.inactiveOpacity')} path={d('inactiveOpacity')} min={0} max={1} step={0.05} fallback={0.35} get={get} set={set} disabled={disabled} />
      </div>
    </section>
  )
}

/** Every value of one designed slide. Grouped, because there are a lot of them. */
function DesignEditor({ base, onPreset, get, set, disabled }: { base: string; onPreset: (id: string) => void } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${base}.${k}`
  const gradient = get(p('background.type')) === 'gradient'
  const patterned = (get(p('pattern.asset')) ?? 'none') !== 'none'
  const shape = get(p('decor.shape')) ?? 'none'
  const decorated = shape !== 'none'

  return (
    <div className="space-y-2.5">
      <div>
        <label className="label">{t('builder.hero.preset')}</label>
        <div className="flex flex-wrap gap-1.5">
          {HERO_PRESET_IDS.map((id) => (
            <button key={id} className="btn-ghost btn-sm normal-case" onClick={() => onPreset(id)} disabled={disabled}>
              {HERO_PRESETS[id].label}
            </button>
          ))}
        </div>
        <p className="fine mt-1.5">{t('builder.hero.presetHint')}</p>
      </div>

      <Disclosure summary={t('builder.hero.bg')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.bg.type')} path={p('background.type')} options={['color', 'gradient']} keyPrefix="builder.hero.bg.type" fallback="color" get={get} set={set} disabled={disabled} />
          {gradient ? (
            <>
              <NumField label={t('builder.hero.bg.angle')} path={p('background.angle')} min={0} max={360} step={5} fallback={135} unit="°" get={get} set={set} disabled={disabled} />
              <ColorField label={t('builder.hero.bg.from')} path={p('background.from')} get={get} set={set} disabled={disabled} />
              <ColorField label={t('builder.hero.bg.to')} path={p('background.to')} get={get} set={set} disabled={disabled} />
            </>
          ) : (
            <ColorField label={t('builder.hero.bg.color')} path={p('background.color')} get={get} set={set} disabled={disabled} />
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.hero.pattern')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.pattern.asset')} path={p('pattern.asset')} options={[...HERO_PATTERNS]} keyPrefix="builder.hero.pattern.asset" fallback="none" get={get} set={set} disabled={disabled} />
          {patterned && (
            <>
              <ColorField label={t('builder.hero.pattern.color')} path={p('pattern.color')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.pattern.opacity')} path={p('pattern.opacity')} min={0} max={1} step={0.01} fallback={0.9} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.pattern.scale')} path={p('pattern.scale')} min={0.25} max={4} step={0.05} fallback={1} unit="×" get={get} set={set} disabled={disabled} />
              <ChoiceField label={t('builder.hero.pattern.target')} path={p('pattern.target')} options={['background', 'decor']} keyPrefix="builder.hero.pattern.target" fallback="background" get={get} set={set} disabled={disabled} />
              <ToggleField label={t('builder.hero.pattern.fade')} path={p('pattern.fade')} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.hero.decor')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.decor.shape')} path={p('decor.shape')} options={[...HERO_DECORS]} keyPrefix="builder.hero.decor.shape" fallback="none" get={get} set={set} disabled={disabled} />
          {decorated && (
            <>
              <NumField label={t('builder.hero.decor.opacity')} path={p('decor.opacity')} min={0} max={1} step={0.05} fallback={1} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.x')} path={p('decor.x')} min={-200} max={400} step={1} fallback={192} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.y')} path={p('decor.y')} min={-200} max={300} step={1} fallback={24} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.w')} path={p('decor.w')} min={8} max={600} step={1} fallback={200} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.h')} path={p('decor.h')} min={8} max={500} step={1} fallback={173} get={get} set={set} disabled={disabled} />
              <ColorField label={t('builder.hero.decor.color')} path={p('decor.color')} get={get} set={set} disabled={disabled} />
              {(shape === 'chevron-pair' || shape === 'triple-chevron') && (
                <ColorField label={t('builder.hero.decor.color2')} path={p('decor.color2')} get={get} set={set} disabled={disabled} />
              )}
              {shape === 'wedge' && (
                <NumField label={t('builder.hero.decor.point')} path={p('decor.point')} min={0.02} max={1} step={0.01} fallback={0.32} get={get} set={set} disabled={disabled} />
              )}
              <ColorField label={t('builder.hero.decor.fill')} path={p('decor.fill')} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        <p className="fine mt-2">{t('builder.hero.decor.hint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.hero.copy')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.layout')} path={p('layout')} options={[...HERO_LAYOUTS]} keyPrefix="builder.hero.layout" fallback="text-left" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.hero.badge.show')} path={p('badge.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.hero.badge.text')} path={p('badge.text')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.hero.badge.logo')} path={p('badge.showLogo')} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.hero.badge.color')} path={p('badge.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.badge.size')} path={p('badge.size')} min={6} max={28} step={0.5} fallback={11} unit="px" get={get} set={set} disabled={disabled} />

          <ToggleField label={t('builder.hero.title.show')} path={p('title.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.hero.title.text')} path={p('title.text')} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.hero.title.color')} path={p('title.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.title.size')} path={p('title.size')} min={8} max={48} step={0.5} fallback={24} unit="px" get={get} set={set} disabled={disabled} />

          <ToggleField label={t('builder.hero.subtitle.show')} path={p('subtitle.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.hero.subtitle.text')} path={p('subtitle.text')} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.hero.subtitle.color')} path={p('subtitle.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.subtitle.size')} path={p('subtitle.size')} min={6} max={32} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.hero.copyHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.hero.motion')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.motion.entrance')} path={p('motion.entrance')} options={[...HERO_ENTRANCES]} keyPrefix="builder.hero.motion.entrance" fallback="rise" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.motion.entranceMs')} path={p('motion.entranceMs')} min={0} max={3000} step={50} fallback={600} unit="ms" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.hero.motion.decor')} path={p('motion.decor')} options={[...HERO_DECOR_MOTIONS]} keyPrefix="builder.hero.motion.decor" fallback="slide" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.motion.decorMs')} path={p('motion.decorMs')} min={0} max={3000} step={50} fallback={700} unit="ms" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.hero.motion.drift')} path={p('motion.drift')} options={[...HERO_DRIFTS]} keyPrefix="builder.hero.motion.drift" fallback="none" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.motion.driftMs')} path={p('motion.driftMs')} min={2000} max={120000} step={500} fallback={40000} unit="ms" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.hero.motionHint')}</p>
      </Disclosure>
    </div>
  )
}

interface QuickLinkCard { id?: string; title?: string; subtitle?: string; url?: string; active?: boolean; message?: string }

const QUICKLINKS = 'widget_v2_config.quick_links.design'

function QuickLinksPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const q = (k: string) => `${QUICKLINKS}.${k}`
  const carousel = (get(q('layout')) ?? 'carousel') === 'carousel'
  const PATH = 'widget_v2_config.quick_links.quickLinkCards'
  const cards: QuickLinkCard[] = Array.isArray(get(PATH)) ? get(PATH) : []
  const update = (next: QuickLinkCard[]) => set(PATH, next)
  const patch = (i: number, p: Partial<QuickLinkCard>) => update(cards.map((c, j) => (j === i ? { ...c, ...p } : c)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...cards]
    const [c] = next.splice(i, 1)
    next.splice(i + dir, 0, c)
    update(next)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('form.quickLinks')} path="widget_v2_config.quick_links.showQuickLinks.value" get={get} set={set} disabled={disabled} />
        <Field label={t('builder.cards.sectionTitle')} path="widget_v2_config.quick_links.displaySettings.sectionTitle" get={get} set={set} disabled={disabled} />
      </div>

      <SectionHead
        aside={
          !disabled && (
            <button
              className="btn-quiet btn-sm -my-1 normal-case"
              onClick={() => update([...cards, { id: `card-${Date.now().toString(36)}`, title: '', subtitle: '', url: '', active: true }])}
            >
              <Plus className="size-3.5" />
              {t('builder.cards.add')}
            </button>
          )
        }
      >
        {t('builder.cards.list', { count: cards.length })}
      </SectionHead>

      {cards.length === 0 && <p className="callout">{t('builder.cards.empty')}</p>}
      <ul className="space-y-3">
        {cards.map((c, i) => (
          <li key={c.id ?? i} className="row-in rounded-xl border border-line bg-surface/40 p-3.5" style={{ '--d': i } as React.CSSProperties}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="eyebrow">{t('builder.cards.card', { n: i + 1 })}</span>
              <div className="flex items-center gap-1">
                <label className="me-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-muted">
                  <input type="checkbox" className="size-3.5 accent-[#4d98e2]" checked={c.active !== false} onChange={(e) => patch(i, { active: e.target.checked })} disabled={disabled} />
                  {t('builder.cards.active')}
                </label>
                <button className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={disabled || i === 0} title={t('builder.moveUp')} aria-label={t('builder.moveUp')}><ArrowUp className="size-3.5" /></button>
                <button className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={disabled || i === cards.length - 1} title={t('builder.moveDown')} aria-label={t('builder.moveDown')}><ArrowDown className="size-3.5" /></button>
                <button className="btn-danger btn-sm" onClick={() => update(cards.filter((_, j) => j !== i))} disabled={disabled} title={t('common.delete')} aria-label={t('common.delete')}><Trash2 className="size-3.5" /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">{t('builder.cards.title')}</label>
                <input className="input" value={c.title ?? ''} onChange={(e) => patch(i, { title: e.target.value })} disabled={disabled} />
              </div>
              <div>
                <label className="label">{t('builder.cards.subtitle')}</label>
                <input className="input" value={c.subtitle ?? ''} onChange={(e) => patch(i, { subtitle: e.target.value })} disabled={disabled} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t('builder.cards.message')}</label>
                <input
                  className="input"
                  value={c.message ?? ''}
                  placeholder={c.title || t('builder.cards.messagePlaceholder')}
                  onChange={(e) => patch(i, { message: e.target.value })}
                  disabled={disabled}
                />
                <p className="fine mt-1.5">{t('builder.cards.messageHint')}</p>
              </div>
              <div className="sm:col-span-2">
                <MediaInput label={t('builder.cards.image')} value={c.url ?? ''} onChange={(v) => patch(i, { url: v })} disabled={disabled} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Disclosure summary={t('builder.cards.layout')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.cards.layoutMode')} path={q('layout')} options={[...CARD_LAYOUTS]} keyPrefix="builder.cards.layoutMode" fallback="carousel" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.chips.gap')} path={q('gap')} min={0} max={32} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
          {carousel && (
            <>
              <ToggleField label={t('builder.cards.autoScroll')} path={q('autoScroll')} get={get} set={set} disabled={disabled} />
              <ToggleField label={t('builder.cards.loop')} path={q('loop')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.cards.interval')} path={q('intervalMs')} min={800} max={20000} step={100} fallback={3000} unit="ms" get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.cards.cardWidth')} path={q('cardWidth')} min={48} max={320} step={2} fallback={92} unit="px" get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        {carousel && <p className="fine mt-2">{t('builder.cards.autoScrollHint')}</p>}
      </Disclosure>

      <Disclosure summary={t('builder.cards.surface')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.chips.bg')} path={q('background')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={q('radius')} min={0} max={60} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.borderStyle')} path={q('borderStyle')} options={[...BORDER_STYLES]} keyPrefix="builder.input.borderStyle" fallback="solid" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={q('borderWidth')} min={0} max={8} step={0.5} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={q('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.padding')} path={q('padding')} min={0} max={40} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBg')} path={q('hoverBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBorder')} path={q('hoverBorderColor')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={q('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cards.imageStyle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.cards.showImage')} path={q('showImage')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.imageHeight')} path={q('imageHeight')} min={0} max={260} step={2} fallback={84} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.cards.imageFit')} path={q('imageFit')} options={[...IMAGE_FITS]} keyPrefix="builder.cards.imageFit" fallback="cover" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.imageRadius')} path={q('imageRadius')} min={0} max={60} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cards.text')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.cards.showCardTitle')} path={q('showTitle')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cards.showSubtitle')} path={q('showSubtitle')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.cards.titleColor')} path={q('titleColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.titleSize')} path={q('titleSize')} min={8} max={28} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.cards.titleWeight')} path={q('titleWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="700" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.cards.titleFont')} path={q('titleFont')} get={get} set={set} disabled={disabled} allowInherit />
          <BrandColorField label={t('builder.cards.subColor')} path={q('subtitleColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.subSize')} path={q('subtitleSize')} min={7} max={24} step={0.5} fallback={10.5} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.cards.subWeight')} path={q('subtitleWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.cards.subFont')} path={q('subtitleFont')} get={get} set={set} disabled={disabled} allowInherit />
          <ChoiceField label={t('builder.chips.align')} path={q('align')} options={[...TEXT_ALIGNS]} keyPrefix="builder.align" fallback="start" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

interface PromptChip { text?: string; icon?: string; iconUrl?: string }

const PROMPTS = 'widget_v2_config.trending_prompts.design'

function PromptsPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const PATH = 'widget_v2_config.trending_prompts.promptChips'
  const chips: PromptChip[] = Array.isArray(get(PATH)) ? get(PATH) : []
  const update = (next: PromptChip[]) => set(PATH, next)
  const patch = (i: number, p: Partial<PromptChip>) => update(chips.map((c, j) => (j === i ? { ...c, ...p } : c)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...chips]
    const [c] = next.splice(i, 1)
    next.splice(i + dir, 0, c)
    update(next)
  }
  const p = (k: string) => `${PROMPTS}.${k}`
  const iconsOn = get(p('showIcon')) === true

  return (
    <div className="space-y-2.5">
      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('form.trending')} path="widget_v2_config.trending_prompts.showTrendingPrompts.value" get={get} set={set} disabled={disabled} />
          <Field label={t('form.promptsTitle')} path="widget_v2_config.trending_prompts.displaySettings.sectionTitle" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <section>
        <SectionHead
          aside={
            !disabled && (
              <button className="btn-quiet btn-sm -my-1 normal-case" onClick={() => update([...chips, { text: '' }])}>
                <Plus className="size-3.5" />
                {t('builder.chips.add')}
              </button>
            )
          }
        >
          {t('builder.chips.list', { count: chips.length })}
        </SectionHead>
        {chips.length === 0 && <p className="callout">{t('builder.chips.empty')}</p>}
        <ul className="space-y-2">
          {chips.map((c, i) => (
            <li key={i} className="row-in rounded-xl border border-line bg-surface/40 p-2.5" style={{ '--d': i } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  value={c.text ?? ''}
                  placeholder={t('builder.chips.placeholder')}
                  onChange={(e) => patch(i, { text: e.target.value })}
                  disabled={disabled}
                />
                <button className="btn-ghost btn-sm shrink-0" onClick={() => move(i, -1)} disabled={disabled || i === 0} title={t('builder.moveUp')} aria-label={t('builder.moveUp')}><ArrowUp className="size-3.5" /></button>
                <button className="btn-ghost btn-sm shrink-0" onClick={() => move(i, 1)} disabled={disabled || i === chips.length - 1} title={t('builder.moveDown')} aria-label={t('builder.moveDown')}><ArrowDown className="size-3.5" /></button>
                <button className="btn-danger btn-sm shrink-0" onClick={() => update(chips.filter((_, j) => j !== i))} disabled={disabled} title={t('common.delete')} aria-label={t('common.delete')}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {iconsOn && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <IconField
                    label={t('builder.chips.chipIcon', { n: i + 1 })} set="card" allowNone
                    value={c.icon} url={c.iconUrl}
                    onChange={(v) => patch(i, { icon: v })} onUrlChange={(v) => patch(i, { iconUrl: v })}
                    disabled={disabled}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        {iconsOn && chips.length > 0 && <p className="fine mt-2">{t('builder.chips.chipIconHint')}</p>}
      </section>

      <Disclosure summary={t('builder.chips.section')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.chips.showTitle')} path={p('showTitle')} get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.chips.layout')} path={p('layout')} options={[...CHIP_LAYOUTS]} keyPrefix="builder.chips.layout" fallback="wrap" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.titleColor')} path={p('titleColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.chips.titleSize')} path={p('titleSize')} min={8} max={28} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.chips.titleWeight')} path={p('titleWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="700" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.chips.titleFont')} path={p('titleFont')} get={get} set={set} disabled={disabled} allowInherit />
          <NumField label={t('builder.chips.gap')} path={p('gap')} min={0} max={32} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.chips.surface')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.chips.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.borderStyle')} path={p('borderStyle')} options={[...BORDER_STYLES]} keyPrefix="builder.input.borderStyle" fallback="solid" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={8} step={0.5} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('paddingX')} min={0} max={40} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('paddingY')} min={0} max={40} step={1} fallback={7} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBg')} path={p('hoverBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBorder')} path={p('hoverBorderColor')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.chips.text')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.textColor')} path={p('textColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('textSize')} min={8} max={28} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('textWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.input.font')} path={p('textFont')} get={get} set={set} disabled={disabled} allowInherit />
          <ChoiceField label={t('builder.chips.align')} path={p('align')} options={[...TEXT_ALIGNS]} keyPrefix="builder.align" fallback="start" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.chips.icon')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.chips.showIcon')} path={p('showIcon')} get={get} set={set} disabled={disabled} />
          {iconsOn && (
            <>
              <ChoiceField label={t('builder.chips.iconPos')} path={p('iconPosition')} options={[...ICON_POSITIONS]} keyPrefix="builder.chips.iconPos" fallback="start" get={get} set={set} disabled={disabled} />
              <IconField
                label={t('builder.chips.defaultIcon')} set="card"
                value={get(p('icon'))} url={get(p('iconUrl'))}
                onChange={(v) => set(p('icon'), v)} onUrlChange={(v) => set(p('iconUrl'), v)}
                disabled={disabled}
              />
              <NumField label={t('builder.input.iconSize')} path={p('iconSize')} min={6} max={40} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
              <BrandColorField label={t('builder.chips.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        {iconsOn && <p className="fine mt-2">{t('builder.chips.iconHint')}</p>}
      </Disclosure>
    </div>
  )
}

/* ------------------------------ input & launcher ---------------------------- */

const INPUT = 'widget_v2_config.chat_input.design'
const LAUNCHER = 'launcher_design'

/** Shadow controls, shared by every surface that casts one. */
function ShadowFields({ base, get, set, disabled }: { base: string } & PageProps) {
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

function InputPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${INPUT}.${k}`
  const sendIcon = asSendIcon(get(p('send.icon')))

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('form.input')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('form.inputLayout')} path={p('layout')} options={[...INPUT_LAYOUTS]} keyPrefix="builder.input.layout" fallback="floating_pill" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.direction')} path={p('direction')} options={['auto', 'ltr', 'rtl']} keyPrefix="builder.input.dir" fallback="auto" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <Disclosure summary={t('builder.input.field')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.fieldBg')} path={p('field.background')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('field.radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.minHeight')} path={p('field.minHeight')} min={28} max={120} step={1} fallback={46} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.gap')} path={p('field.gap')} min={0} max={32} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('field.paddingX')} min={0} max={40} step={1} fallback={5} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('field.paddingY')} min={0} max={40} step={1} fallback={5} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.borderStyle')} path={p('field.borderStyle')} options={[...BORDER_STYLES]} keyPrefix="builder.input.borderStyle" fallback="solid" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('field.borderWidth')} min={0} max={12} step={0.5} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('field.borderColor')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.focus')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.focusBorder')} path={p('field.focusBorderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.ringWidth')} path={p('field.focusRingWidth')} min={0} max={12} step={0.5} fallback={3} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.ringColor')} path={p('field.focusRingColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.ringOpacity')} path={p('field.focusRingOpacity')} min={0} max={1} step={0.02} fallback={0.18} get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.input.focusHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.input.shadow')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('field.shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.typing')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontField label={t('builder.input.font')} path={p('text.fontFamily')} get={get} set={set} disabled={disabled} allowInherit />
          <NumField label={t('builder.input.textSize')} path={p('text.size')} min={9} max={28} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('text.weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.textColor')} path={p('text.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.lineHeight')} path={p('text.lineHeight')} min={1} max={2.4} step={0.05} fallback={1.5} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.placeholder')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.placeholder')} path="widget_v2_config.chat_input.placeholderText.text" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.phColor')} path={p('placeholder.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.phSize')} path={p('placeholder.size')} min={9} max={28} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.phWeight')} path={p('placeholder.weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.phItalic')} path={p('placeholder.italic')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.send')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t('builder.input.sendIcon')}</label>
            <Select
              label={t('builder.input.sendIcon')}
              value={sendIcon}
              onChange={(v) => set(p('send.icon'), v)}
              disabled={disabled}
              options={SEND_ICONS.map((name) => ({ value: name, label: t(`builder.input.sendIcon.${name}`), icon: <SendIcon name={name} className="size-3.5" /> }))}
            />
          </div>
          <ChoiceField label={t('builder.input.shape')} path={p('send.shape')} options={[...BUTTON_SHAPES]} keyPrefix="builder.shape" fallback="circle" get={get} set={set} disabled={disabled} />
          {sendIcon === 'custom' && (
            <div className="sm:col-span-2">
              <MediaInput label={t('builder.input.sendIcon.customImage')} value={get(p('send.url')) ?? ''} onChange={(v) => set(p('send.url'), v)} disabled={disabled} />
            </div>
          )}
          <NumField label={t('builder.input.btnSize')} path={p('send.size')} min={20} max={72} step={1} fallback={36} unit="px" get={get} set={set} disabled={disabled} />
          {get(p('send.shape')) === 'rounded' && (
            <NumField label={t('builder.input.radius')} path={p('send.radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          )}
          <NumField label={t('builder.input.iconSize')} path={p('send.iconSize')} min={6} max={40} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.sendBg')} path={p('send.background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.sendFg')} path={p('send.iconColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.hoverBg')} path={p('send.hoverBackground')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.disabledOpacity')} path={p('send.disabledOpacity')} min={0} max={1} step={0.05} fallback={0.4} get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.sendPos')} path={p('send.position')} options={[...SEND_POSITIONS]} keyPrefix="builder.input.sendPos" fallback="inside" get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('send.shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.actions')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('form.voice')} path={p('actions.voice')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.attach')} path={p('actions.attach')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.emoji')} path={p('actions.emoji')} get={get} set={set} disabled={disabled} />
          <div />
          {get(p('actions.voice')) !== false && (
            <IconField
              label={t('builder.input.voiceIcon')} set="voice"
              value={get(p('actions.voiceIcon'))} url={get(p('actions.voiceUrl'))}
              onChange={(v) => set(p('actions.voiceIcon'), v)} onUrlChange={(v) => set(p('actions.voiceUrl'), v)}
              disabled={disabled}
            />
          )}
          {get(p('actions.attach')) !== false && (
            <IconField
              label={t('builder.input.attachIcon')} set="attach"
              value={get(p('actions.attachIcon'))} url={get(p('actions.attachUrl'))}
              onChange={(v) => set(p('actions.attachIcon'), v)} onUrlChange={(v) => set(p('actions.attachUrl'), v)}
              disabled={disabled}
            />
          )}
          {get(p('actions.emoji')) === true && (
            <IconField
              label={t('builder.input.emojiIcon')} set="emoji"
              value={get(p('actions.emojiIcon'))} url={get(p('actions.emojiUrl'))}
              onChange={(v) => set(p('actions.emojiIcon'), v)} onUrlChange={(v) => set(p('actions.emojiUrl'), v)}
              disabled={disabled}
            />
          )}
          <ChoiceField label={t('builder.input.shape')} path={p('actions.shape')} options={[...BUTTON_SHAPES]} keyPrefix="builder.shape" fallback="circle" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.btnSize')} path={p('actions.size')} min={20} max={72} step={1} fallback={36} unit="px" get={get} set={set} disabled={disabled} />
          {get(p('actions.shape')) === 'rounded' && (
            <NumField label={t('builder.input.radius')} path={p('actions.radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          )}
          <NumField label={t('builder.input.iconSize')} path={p('actions.iconSize')} min={6} max={40} step={0.5} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.actionBg')} path={p('actions.background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.actionColor')} path={p('actions.iconColor')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.hoverBg')} path={p('actions.hoverBackground')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.gap')} path={p('actions.gap')} min={0} max={24} step={1} fallback={2} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.input.container')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.containerBg')} path={p('container.background')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('container.paddingX')} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padTop')} path={p('container.paddingTop')} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padBottom')} path={p('container.paddingBottom')} min={0} max={48} step={1} fallback={24} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

function LauncherPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${LAUNCHER}.${k}`
  const icon = get(p('icon')) ?? 'bubble'
  const expanded = (get(p('type')) ?? 'standard') === 'expanded_bubble'

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.section.launcher')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('form.launcherStyle')} path={p('type')} options={['standard', 'expanded_bubble', 'chat_icon', 'icon_only', 'none']} keyPrefix="builder.launcher.type" fallback="standard" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('form.launcherPosition')} path={p('position')} options={['right', 'left']} keyPrefix="builder.launcher.pos" fallback="right" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.offsetX')} path={p('offsetX')} min={0} max={120} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.offsetY')} path={p('offsetY')} min={0} max={120} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('form.poweredBy')} path="powered_by_pair_ai" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <Disclosure summary={t('builder.launcher.shape')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label={t('builder.launcher.size')} path={p('size')} min={32} max={96} step={1} fallback={56} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.launcher.gradient')} path={p('useGradient')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.launcher.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          {get(p('useGradient')) === true && (
            <>
              <BrandColorField label={t('builder.hero.bg.to')} path={p('gradientTo')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.bg.angle')} path={p('gradientAngle')} min={0} max={360} step={5} fallback={135} unit="°" get={get} set={set} disabled={disabled} />
            </>
          )}
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={12} step={0.5} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.launcher.icon')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <IconField
            label={t('builder.launcher.icon')} set="launcher" allowNone
            value={get(p('icon'))} url={get(p('iconUrl'))}
            onChange={(v) => set(p('icon'), v)} onUrlChange={(v) => set(p('iconUrl'), v)}
            disabled={disabled}
          />
          {icon !== 'none' && (
            <>
              <NumField label={t('builder.input.iconSize')} path={p('iconSize')} min={8} max={64} step={1} fallback={22} unit="px" get={get} set={set} disabled={disabled} />
              {icon !== 'custom' && <BrandColorField label={t('builder.launcher.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />}
            </>
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.launcher.label')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.launcher.labelShow')} path={p('label.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.launcher.title')} path="launcher_title" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.launcher.labelColor')} path={p('label.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('label.size')} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('label.weight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="500" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.input.font')} path={p('label.fontFamily')} get={get} set={set} disabled={disabled} allowInherit />
        </div>
        {!expanded && <p className="fine mt-2">{t('builder.launcher.labelHint')}</p>}
      </Disclosure>

      <Disclosure summary={t('builder.panel.head')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label={t('builder.panel.width')} path={p('panel.width')} min={260} max={720} step={4} fallback={400} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.panel.maxHeight')} path={p('panel.maxHeight')} min={320} max={1200} step={10} fallback={700} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.panel.minHeight')} path={p('panel.minHeight')} min={200} max={800} step={10} fallback={250} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.panel.bottom')} path={p('panel.bottom')} min={0} max={220} step={2} fallback={104} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('panel.radius')} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.panel.hint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.launcher.motion')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.launcher.entrance')} path={p('entrance')} options={[...LAUNCHER_ENTRANCES]} keyPrefix="builder.launcher.entrance" fallback="pop" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.launcher.attention')} path={p('attention')} options={[...LAUNCHER_ATTENTION]} keyPrefix="builder.launcher.attention" fallback="none" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.launcher.hoverScale')} path={p('hoverScale')} min={1} max={1.3} step={0.01} fallback={1.04} unit="×" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.launcher.motionHint')}</p>
      </Disclosure>
    </div>
  )
}

/* ------------------------------ loading & toast ----------------------------- */

const LOADING = 'widget_v2_config.intro_screen.loadingState.design'
const TOAST = 'toast_design'

/** The placeholder shown while the first reply is still loading. */
function LoadingPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${LOADING}.${k}`
  const type = get(p('type')) ?? get('widget_v2_config.intro_screen.loadingState.type') ?? 'shimmer'
  const skeleton = type === 'shimmer' || type === 'pulse'

  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.load.head')}</SectionHead>
        <p className="callout mb-3">{t('builder.load.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.load.type')} path={p('type')} options={[...LOADING_TYPES]} keyPrefix="builder.load.type" fallback="shimmer" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.load.speed')} path={p('speedMs')} min={300} max={6000} step={50} fallback={1600} unit="ms" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      {skeleton && (
        <Disclosure summary={t('builder.load.skeleton')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandColorField label={t('builder.load.base')} path={p('baseColor')} get={get} set={set} disabled={disabled} />
            <BrandColorField label={t('builder.load.highlight')} path={p('highlightColor')} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={60} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.lines')} path={p('lines')} min={0} max={8} step={1} fallback={3} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.lineHeight')} path={p('lineHeight')} min={2} max={40} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.cards')} path={p('cards')} min={0} max={6} step={1} fallback={3} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.cardHeight')} path={p('cardHeight')} min={20} max={400} step={4} fallback={220} unit="px" get={get} set={set} disabled={disabled} />
          </div>
        </Disclosure>
      )}

      {!skeleton && (
        <Disclosure summary={t('builder.load.spinner')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandColorField label={t('builder.load.spinnerColor')} path={p('spinnerColor')} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.load.spinnerSize')} path={p('spinnerSize')} min={8} max={72} step={1} fallback={22} unit="px" get={get} set={set} disabled={disabled} />
            {type === 'spinner' && (
              <NumField label={t('builder.load.spinnerThickness')} path={p('spinnerThickness')} min={1} max={10} step={0.5} fallback={2.5} unit="px" get={get} set={set} disabled={disabled} />
            )}
          </div>
        </Disclosure>
      )}

      <Disclosure summary={t('builder.load.label')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.load.labelShow')} path={p('labelShow')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.load.labelText')} path={p('labelText')} get={get} set={set} disabled={disabled} placeholder="Thinking…" />
          <BrandColorField label={t('builder.launcher.labelColor')} path={p('labelColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('labelSize')} min={8} max={24} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

/** The confirmation that slides in after an action. */
function ToastPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${TOAST}.${k}`
  return (
    <div className="space-y-2.5">
      <section>
        <SectionHead>{t('builder.toast.head')}</SectionHead>
        <p className="callout mb-3">{t('builder.toast.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.toast.position')} path={p('position')} options={[...TOAST_POSITIONS]} keyPrefix="builder.toast.pos" fallback="bottom-center" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.toast.offset')} path={p('offset')} min={0} max={80} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.toast.duration')} path={p('durationMs')} min={800} max={15000} step={100} fallback={3000} unit="ms" get={get} set={set} disabled={disabled} />
          <Field label={t('builder.toast.text')} path="widget_v2_config.messages.feedback.toastMessage" get={get} set={set} disabled={disabled} placeholder="Thanks for your feedback." />
        </div>
      </section>

      <Disclosure summary={t('builder.toast.look')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.toast.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.toast.fg')} path={p('textColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={8} step={0.5} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('paddingX')} min={0} max={40} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('paddingY')} min={0} max={40} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('fontSize')} min={9} max={24} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('fontWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="500" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.toast.icon')} path={p('showIcon')} get={get} set={set} disabled={disabled} />
          {get(p('showIcon')) !== false && (
            <BrandColorField label={t('builder.toast.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />
          )}
          <ToggleField label={t('builder.toast.fullWidth')} path={p('fullWidth')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

function MessagesPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const AI = 'widget_v2_config.messages.aiMessages'
  const LO = 'widget_v2_config.messages.loadingOlder'
  const CU = 'widget_v2_config.messages.customerMessages'
  const FB = 'widget_v2_config.messages.feedback'
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.msgs.ai')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.msgs.style')} path={`${AI}.messageStyle`} options={['bubble', 'plain', 'card']} keyPrefix="builder.msgs.style" fallback="bubble" get={get} set={set} disabled={disabled} />
          <div />
          <ColorField label={t('builder.msgs.cardBg')} path={`${AI}.CardStyles.backgroundColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${AI}.CardStyles.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${AI}.CardStyles.borderWidth`} min={0} max={8} step={1} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${AI}.CardStyles.borderRadius`} min={0} max={40} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${AI}.CardStyles.padding`} min={0} max={32} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${AI}.TextStyles.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${AI}.TextStyles.fontSize`} min={10} max={22} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${AI}.TextStyles.fontWeight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.msgs.showIcon')} path={`${AI}.showAiIcon`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.msgs.aiShimmer')} path={`${AI}.showShimmer`} get={get} set={set} disabled={disabled} />
          <MediaInput label={t('builder.msgs.iconUrl')} value={get(`${AI}.iconUrl`) ?? ''} onChange={(v) => set(`${AI}.iconUrl`, v)} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.user')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.msgs.btype')} path={`${CU}.bubbleType`} options={['filled', 'outline']} keyPrefix="builder.msgs.btype" fallback="filled" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.msgs.brandColor')} path={`${CU}.useBrandColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.userBubbleBg')} path={`${CU}.bubbleStyle.backgroundColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${CU}.bubbleStyle.borderColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.userBubbleText')} path={`${CU}.TextStyles.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CU}.TextStyles.fontSize`} min={10} max={22} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${CU}.TextStyles.fontWeight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${CU}.bubbleStyle.padding`} min={0} max={32} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <Field label={t('form.bubbleRadius')} path={`${CU}.bubbleStyle.borderRadius`} get={get} set={set} disabled={disabled} placeholder="18px 18px 4px 18px" />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.loadMoreHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PlainBiField label={t('builder.msgs.loadMoreText')} path={`${LO}.text`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Loading older messages…" />
          </div>
          <ColorField label={t('builder.msgs.loadMoreBg')} path={`${LO}.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${LO}.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.loadMoreSpinner')} path={`${LO}.spinnerColor`} get={get} set={set} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.feedbackHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.msgs.feedback')} path={`${FB}.showFeedbackButtons`} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.msgs.toastMsg')} path={`${FB}.toastMessage`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.fbIconSize')} path={`${FB}.style.iconSize`} min={12} max={40} step={1} fallback={24} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.fbIconColor')} path={`${FB}.style.iconColor`} get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}


/* --------------------------------- pre-chat -------------------------------- */

const PC = 'widget_v2_config.pre_chat_form'
const PCD = `${PC}.design`

type PreChatFieldRow = {
  name: string; type: string; label: string; placeholder: string
  required: boolean; enabled: boolean; order: number; field_type: string
  /** Hand-typed translations, applied by the language switch. */
  i18n?: Partial<Record<WidgetLang, { label?: string; placeholder?: string }>>
}

const PC_DEFAULT_FIELDS: PreChatFieldRow[] = [
  { name: 'emailAddress', type: 'email', label: 'Email Id', placeholder: 'emailAddress', required: true, enabled: true, order: 1, field_type: 'standard' },
  { name: 'fullName', type: 'text', label: 'Full name', placeholder: 'fullName', required: false, enabled: true, order: 2, field_type: 'standard' },
  { name: 'phoneNumber', type: 'text', label: 'Phone number', placeholder: 'phoneNumber', required: true, enabled: true, order: 3, field_type: 'standard' },
]

/**
 * The pre-chat form page: whether the form gates the conversation, the copy it
 * opens with, the three contact fields, and the design of every part of it.
 * Fields are edited as whole rows and written back as one array, so the shape
 * stays a real array whatever path arithmetic would have made of it.
 */
function PreChatPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const live = currentLang(draft)
  const stored = get(`${PC}.fields`)
  const fields: PreChatFieldRow[] = Array.isArray(stored) && stored.length ? stored : PC_DEFAULT_FIELDS
  const patchField = (i: number, patch: Partial<PreChatFieldRow>) =>
    set(`${PC}.fields`, fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  // One language of a field's label/placeholder: the translation is stored on
  // the item, and the live value follows the widget's current language.
  const writeFieldText = (i: number, key: 'label' | 'placeholder', lang: WidgetLang, v: string) =>
    set(`${PC}.fields`, fields.map((f, j) => {
      if (j !== i) return f
      const next: PreChatFieldRow = { ...f, i18n: { ...(f.i18n ?? {}), [lang]: { ...((f.i18n ?? {})[lang] ?? {}), [key]: v } } }
      if (live === lang) next[key] = v
      return next
    }))

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.prechat')}</SectionHead>
        <p className="callout mb-4">{t('builder.pc.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.enable')} path={`${PC}.enabled`} get={get} set={set} disabled={disabled} />
          <div />
          <PlainBiField label={t('builder.pc.message')} path={`${PC}.message`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Share your queries or comments here." />
        </div>
      </section>

      <section>
        <SectionHead>{t('builder.pc.fields')}</SectionHead>
        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.name} className="card space-y-3 p-3.5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="mono text-[11px] font-bold text-ink">{f.name}</span>
                <span className="badge">{f.type}</span>
                <span className="ms-auto flex gap-4">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-muted">
                    <input type="checkbox" checked={f.enabled !== false} disabled={disabled} onChange={(e) => patchField(i, { enabled: e.target.checked })} />
                    {t('builder.pc.field.enabled')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-muted">
                    <input type="checkbox" checked={!!f.required} disabled={disabled} onChange={(e) => patchField(i, { required: e.target.checked })} />
                    {t('builder.pc.field.required')}
                  </label>
                </span>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className="label">{t('builder.pc.field.label')}</label>
                  <ItemBiInputs live={live} value={f.label} i18n={{ en: f.i18n?.en?.label, ar: f.i18n?.ar?.label }}
                    onWrite={(lang, v) => writeFieldText(i, 'label', lang, v)} disabled={disabled} />
                </div>
                <div>
                  <label className="label">{t('builder.pc.field.placeholder')}</label>
                  <ItemBiInputs live={live} value={f.placeholder ?? ''} i18n={{ en: f.i18n?.en?.placeholder, ar: f.i18n?.ar?.placeholder }}
                    onWrite={(lang, v) => writeFieldText(i, 'placeholder', lang, v)} disabled={disabled} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Disclosure summary={t('builder.pc.design.message')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.message.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.message.size`} min={9} max={28} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${PCD}.message.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.chips.align')} path={`${PCD}.message.align`} options={[...TEXT_ALIGNS]} keyPrefix="builder.align" fallback="start" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.labels')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.labelsShow')} path={`${PCD}.labels.show`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.labels.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.labels.size`} min={8} max={24} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${PCD}.labels.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="600" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.pc.design.requiredColor')} path={`${PCD}.labels.requiredColor`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.inputs')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${PCD}.field.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${PCD}.field.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${PCD}.field.borderWidth`} min={0} max={8} step={1} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${PCD}.field.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${PCD}.field.height`} min={28} max={72} step={1} fallback={40} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.gap')} path={`${PCD}.field.gap`} min={4} max={40} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.field.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.field.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.pc.design.placeholderColor')} path={`${PCD}.field.placeholderColor`} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.pc.design.focus')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.pc.design.focusBorder')} path={`${PCD}.field.focusBorderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.ring')} path={`${PCD}.field.focusRingWidth`} min={0} max={12} step={1} fallback={3} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.pc.design.ringColor')} path={`${PCD}.field.focusRingColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.ringOpacity')} path={`${PCD}.field.focusRingOpacity`} min={0} max={1} step={0.02} fallback={0.18} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.messageBox')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.messageBoxOn')} path={`${PCD}.showMessage`} get={get} set={set} disabled={disabled} />
          <div />
          <PlainBiField label={t('builder.pc.design.messageLabel')} path={`${PCD}.messageLabel`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Message" />
          <PlainBiField label={t('builder.pc.design.messagePh')} path={`${PCD}.messagePlaceholder`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Type your message here..." />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.button')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlainBiField label={t('builder.pc.design.buttonText')} path={`${PCD}.buttonText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Start Chat" />
          <ToggleField label={t('builder.pc.design.fullWidth')} path={`${PCD}.button.fullWidth`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path={`${PCD}.button.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${PCD}.button.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${PCD}.button.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${PCD}.button.height`} min={30} max={72} step={1} fallback={44} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${PCD}.button.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${PCD}.button.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="600" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.hoverBg')} path={`${PCD}.button.hoverBackground`} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={`${PCD}.button.shadow`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.media')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.bannerOn')} path={`${PCD}.banner.show`} get={get} set={set} disabled={disabled} />
          <div />
          <MediaInput label={t('builder.pc.design.banner')} value={get(`${PCD}.banner.url`) ?? ''} onChange={(v) => set(`${PCD}.banner.url`, v)} disabled={disabled} />
          <div className="grid gap-4">
            <NumField label={t('builder.pc.design.bannerH')} path={`${PCD}.banner.height`} min={32} max={280} step={2} fallback={96} unit="px" get={get} set={set} disabled={disabled} />
            <ChoiceField label={t('builder.cards.imageFit')} path={`${PCD}.banner.fit`} options={[...IMAGE_FITS]} keyPrefix="builder.fit" fallback="cover" get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.msgs.radius')} path={`${PCD}.banner.radius`} min={0} max={60} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          </div>
          <MediaInput label={t('builder.pc.design.backdrop')} value={get(`${PCD}.backdrop.url`) ?? ''} onChange={(v) => set(`${PCD}.backdrop.url`, v)} disabled={disabled} />
          <div className="grid gap-4">
            <NumField label={t('builder.pc.design.backdropOpacity')} path={`${PCD}.backdrop.opacity`} min={0} max={1} step={0.02} fallback={0.06} get={get} set={set} disabled={disabled} />
            <NumField label={t('builder.pc.design.backdropSize')} path={`${PCD}.backdrop.size`} min={40} max={800} step={10} fallback={220} unit="px" get={get} set={set} disabled={disabled} />
          </div>
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.pc.design.card')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.pc.design.cardOn')} path={`${PCD}.card.enabled`} get={get} set={set} disabled={disabled} />
          <div />
          <ColorField label={t('builder.input.fieldBg')} path={`${PCD}.card.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${PCD}.card.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${PCD}.card.borderWidth`} min={0} max={8} step={1} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${PCD}.card.radius`} min={0} max={60} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${PCD}.card.padding`} min={0} max={48} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={`${PCD}.card.shadow`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

/* ------------------------------- consent gate ------------------------------ */

const CS = 'widget_v2_config.consent_screen'
const CSD = `${CS}.design`

type ConsentPointRow = { icon: string; text: string; i18n?: Partial<Record<WidgetLang, { text?: string }>> }

const CS_DEFAULT_POINTS: ConsentPointRow[] = [
  { icon: 'chat-text', text: 'This assistant helps you discover films, get recommendations and track bookings.' },
  { icon: 'alert', text: 'AI suggestions may occasionally be incorrect. Please review details before purchasing.' },
  { icon: 'shield', text: 'Your interactions may be used to improve recommendations and your experience.' },
]

/**
 * The welcome gate page: the consent sheet's copy, its points (each with an
 * icon), and the design of the sheet, texts and agree button.
 */
function ConsentPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const live = currentLang(draft)
  const stored = get(`${CS}.points`)
  const points: ConsentPointRow[] = Array.isArray(stored) && stored.length ? stored : CS_DEFAULT_POINTS
  const write = (next: ConsentPointRow[]) => set(`${CS}.points`, next)
  const patchPoint = (i: number, patch: Partial<ConsentPointRow>) =>
    write(points.map((pt, j) => (j === i ? { ...pt, ...patch } : pt)))
  const writePointText = (i: number, lang: WidgetLang, v: string) =>
    write(points.map((pt, j) => {
      if (j !== i) return pt
      const next: ConsentPointRow = { ...pt, i18n: { ...(pt.i18n ?? {}), [lang]: { text: v } } }
      if (live === lang) next.text = v
      return next
    }))

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.consent')}</SectionHead>
        <p className="callout mb-4">{t('builder.cs.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.cs.enable')} path={`${CS}.enabled`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cs.illustration')} path={`${CSD}.showIllustration`} get={get} set={set} disabled={disabled} />
          <PlainBiField label={t('builder.cs.title')} path={`${CS}.title`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Welcome to your AI Assistant" />
          <PlainBiField label={t('builder.cs.subtitle')} path={`${CS}.subtitle`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="A few things to keep in mind" />
          <PlainBiField label={t('builder.cs.footnote')} path={`${CS}.footnote`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="By continuing, you agree to our" />
          <PlainBiField label={t('builder.cs.buttonText')} path={`${CS}.buttonText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Agree & Continue" />
        </div>
      </section>

      <section>
        <SectionHead>{t('builder.cs.points')}</SectionHead>
        <div className="space-y-3">
          {points.map((pt, i) => (
            <div key={i} className="card space-y-3 p-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <IconField
                  label={t('builder.pc.field.label')} set="consent"
                  value={pt.icon} url={undefined}
                  onChange={(v) => patchPoint(i, { icon: v })} onUrlChange={() => {}}
                  disabled={disabled}
                />
                <div className="flex items-end gap-2">
                  <button
                    className="btn-ghost btn-sm ms-auto"
                    onClick={() => write(points.filter((_, j) => j !== i))}
                    disabled={disabled || points.length <= 1}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">{t('builder.cs.point.text')}</label>
                <ItemBiInputs live={live} textarea value={pt.text} i18n={{ en: pt.i18n?.en?.text, ar: pt.i18n?.ar?.text }}
                  onWrite={(lang, v) => writePointText(i, lang, v)} disabled={disabled} />
              </div>
            </div>
          ))}
          <button className="btn-ghost btn-sm" onClick={() => write([...points, { icon: 'info', text: '' }])} disabled={disabled || points.length >= 6}>
            <Plus className="size-4" />
            {t('builder.cs.addPoint')}
          </button>
        </div>
      </section>

      <Disclosure summary={t('builder.cs.links')}>
        <p className="callout mb-4">{t('builder.cs.links.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={`${t('builder.cs.links.terms')} — ${t('builder.cs.links.show')}`} path={`${CS}.links.terms.show`} get={get} set={set} disabled={disabled} />
          <ToggleField label={`${t('builder.cs.links.privacy')} — ${t('builder.cs.links.show')}`} path={`${CS}.links.privacy.show`} get={get} set={set} disabled={disabled} />
          <PlainBiField label={`${t('builder.cs.links.terms')} — ${t('builder.cs.links.label')}`} path={`${CS}.links.terms.label`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Terms of Use" />
          <Field label={`${t('builder.cs.links.terms')} — ${t('builder.cs.links.url')}`} path={`${CS}.links.terms.url`} get={get} set={set} disabled={disabled} placeholder="https://…" />
          <PlainBiField label={`${t('builder.cs.links.privacy')} — ${t('builder.cs.links.label')}`} path={`${CS}.links.privacy.label`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Privacy Policy" />
          <Field label={`${t('builder.cs.links.privacy')} — ${t('builder.cs.links.url')}`} path={`${CS}.links.privacy.url`} get={get} set={set} disabled={disabled} placeholder="https://…" />
          <ColorField label={t('builder.cs.links.color')} path={`${CS}.links.color`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cs.links.underline')} path={`${CS}.links.underline`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.sheet')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${CSD}.card.background`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${CSD}.card.radius`} min={0} max={60} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${CSD}.card.padding`} min={0} max={48} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.cs.overlay')} path={`${CSD}.overlayColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cs.overlayOpacity')} path={`${CSD}.overlayOpacity`} min={0} max={1} step={0.05} fallback={0.45} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.texts')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.cs.title')} path={`${CSD}.title.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.title.size`} min={10} max={32} step={0.5} fallback={17} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.cs.subtitle')} path={`${CSD}.subtitle.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.subtitle.size`} min={8} max={24} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.cs.footnote')} path={`${CSD}.footnote.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.footnote.size`} min={7} max={18} step={0.5} fallback={10.5} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.pointsStyle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.msgs.text')} path={`${CSD}.points.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.points.textSize`} min={8} max={20} step={0.5} fallback={12.5} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.chips.iconColor')} path={`${CSD}.points.iconColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.iconSize')} path={`${CSD}.points.iconSize`} min={10} max={32} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.gap')} path={`${CSD}.points.gap`} min={4} max={32} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cs.design.button')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${CSD}.button.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${CSD}.button.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${CSD}.button.radius`} min={0} max={999} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${CSD}.button.height`} min={30} max={72} step={1} fallback={44} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CSD}.button.textSize`} min={9} max={24} step={0.5} fallback={13.5} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${CSD}.button.weight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="600" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.pc.design.fullWidth')} path={`${CSD}.button.fullWidth`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}

/* ------------------------------- rating (CSAT) ----------------------------- */

const RT = 'widget_v2_config.csat'
const RTD = `${RT}.design`

/**
 * The rating survey page: the texts the survey shows (overriding what the
 * survey message carries), which type it renders as, and the design of the
 * card, the sheet, the chips or stars, and both buttons.
 */
function RatingPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.rating')}</SectionHead>
        <p className="callout mb-4">{t('builder.rt.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.rt.type')} path={`${RTD}.forceType`} options={['auto', 'star', 'text_options']} keyPrefix="builder.rt.type" fallback="auto" get={get} set={set} disabled={disabled} />
          <div />
          <PlainBiField label={t('builder.rt.header')} path={`${RT}.header`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Customer Satisfaction Survey" />
          <PlainBiField label={t('builder.rt.question')} path={`${RT}.body`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="How was your experience?" />
          <PlainBiField label={t('builder.rt.trigger')} path={`${RT}.buttonText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Rate Experience" />
          <PlainBiField label={t('builder.rt.submit')} path={`${RT}.submitText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Submit Feedback" />
        </div>
      </section>

      <Disclosure summary={t('builder.rt.card')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.card.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.card.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${RTD}.card.borderWidth`} min={0} max={8} step={1} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.card.radius`} min={0} max={60} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${RTD}.card.padding`} min={0} max={48} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <div />
          <ColorField label={t('builder.rt.header')} path={`${RTD}.header.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.header.size`} min={8} max={20} step={0.5} fallback={11} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.question')} path={`${RTD}.body.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.body.size`} min={10} max={26} step={0.5} fallback={15} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.rt.trigger')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontField label={t('builder.rt.font')} path={`${RTD}.trigger.fontFamily`} allowInherit get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.trigger.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.trigger.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.trigger.background`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.trigger.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${RTD}.trigger.borderWidth`} min={0} max={8} step={1} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.trigger.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${RTD}.trigger.height`} min={28} max={72} step={1} fallback={36} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.pc.design.fullWidth')} path={`${RTD}.trigger.fullWidth`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={`${t('builder.rt.chips')} · ${t('builder.rt.stars')}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.chips.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.chips.borderColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.chips.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.chips.radius`} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.selBg')} path={`${RTD}.chips.selectedBackground`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.selBorder')} path={`${RTD}.chips.selectedBorderColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.selText')} path={`${RTD}.chips.selectedTextColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.chips.textSize`} min={9} max={20} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.stars')} path={`${RTD}.stars.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.iconSize')} path={`${RTD}.stars.size`} min={12} max={36} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.rt.sheet')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.dialog.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.dialog.titleColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.dialog.dividerColor`} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.rt.submit')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontField label={t('builder.rt.font')} path={`${RTD}.submit.fontFamily`} allowInherit get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.submit.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.submit.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.submit.background`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.submit.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${RTD}.submit.borderWidth`} min={0} max={8} step={1} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.submit.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${RTD}.submit.height`} min={30} max={72} step={1} fallback={48} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
