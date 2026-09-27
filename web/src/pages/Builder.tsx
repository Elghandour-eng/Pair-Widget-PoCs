import {
  ArrowDown, ArrowLeft, ArrowUp, Check, Download, Image as ImageIcon, Languages, LayoutGrid, MessagesSquare,
  Moon, Palette, PanelTop, Plus, RotateCcw, Rocket, Save, Sparkles, Sun, TextCursorInput, Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MediaInput } from '@/components/MediaInput'
import { Select } from '@/components/Select'
import { SEND_ICONS, SendIcon, asSendIcon } from '@/components/sendIcons'
import { FONT_PRESETS } from '@/lib/webfont'
import { Disclosure, FitScale, Loading, SectionHead, Spinner } from '@/components/ui'
import { api, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PairWordmark } from '@/components/brand'
import {
  PREVIEW_FRAME_PATH, applyLanguage, applyTheme, currentLang, currentTheme, deepGet, deepSet,
  isPreviewOutMsg, type PreviewEventMsg, type PreviewInMsg, type ThemeName, type WidgetLang,
} from '@/lib/builder'
import {
  HERO_BRAND_TOKEN, HERO_DECORS, HERO_DECOR_MOTIONS, HERO_DRIFTS, HERO_ENTRANCES, HERO_LAYOUTS,
  HERO_PATTERNS, HERO_PRESETS, HERO_PRESET_IDS, normalizeHeroSlide,
} from '@/lib/heroDesign'
import { useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

type Section = 'theme' | 'language' | 'header' | 'hero' | 'quicklinks' | 'prompts' | 'input' | 'messages' | 'launcher'

const SECTIONS: Array<{ id: Section; icon: React.ReactNode }> = [
  { id: 'theme', icon: <Palette className="size-4" /> },
  { id: 'language', icon: <Languages className="size-4" /> },
  { id: 'header', icon: <PanelTop className="size-4" /> },
  { id: 'hero', icon: <ImageIcon className="size-4" /> },
  { id: 'quicklinks', icon: <LayoutGrid className="size-4" /> },
  { id: 'prompts', icon: <Sparkles className="size-4" /> },
  { id: 'input', icon: <TextCursorInput className="size-4" /> },
  { id: 'messages', icon: <MessagesSquare className="size-4" /> },
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
      { type: 'pws:config', config: draft, dark } satisfies PreviewInMsg,
      window.location.origin,
    )
  }, [draft, dark, frameReady])

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
            {section === 'hero' && <HeroPage get={get} set={set} disabled={!editor} />}
            {section === 'quicklinks' && <QuickLinksPage get={get} set={set} disabled={!editor} />}
            {section === 'prompts' && <PromptsPage get={get} set={set} disabled={!editor} />}
            {section === 'input' && <InputPage get={get} set={set} disabled={!editor} />}
            {section === 'messages' && <MessagesPage get={get} set={set} disabled={!editor} />}
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
          <div>
            <label className="label">{t('builder.theme.fontPreset')}</label>
            <Select
              label={t('builder.theme.fontPreset')}
              value={FONT_PRESETS.some((f) => f.value === get('styles.fontFamily')) ? get('styles.fontFamily') : 'custom'}
              onChange={(v) => v !== 'custom' && set('styles.fontFamily', v)}
              disabled={disabled}
              options={[...FONT_PRESETS, { value: 'custom', label: t('builder.theme.fontCustom') }]}
            />
          </div>
          <Field label={t('form.fontFamily')} path="styles.fontFamily" get={get} set={set} disabled={disabled} placeholder="'Jost', Futura, sans-serif" />
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

function HeroPage({ get, set, disabled }: PageProps) {
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
          <Field label={t('form.welcomeTitle')} path="widget_v2_config.intro_screen.welcomeTitle.text" get={get} set={set} disabled={disabled} />
          <Field label={t('form.welcomeSubtitle')} path="widget_v2_config.intro_screen.welcomeSubtitle.text" get={get} set={set} disabled={disabled} />
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

function QuickLinksPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
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
    </div>
  )
}

interface PromptChip { text?: string }

function PromptsPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const PATH = 'widget_v2_config.trending_prompts.promptChips'
  const chips: PromptChip[] = Array.isArray(get(PATH)) ? get(PATH) : []
  const update = (next: PromptChip[]) => set(PATH, next)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('form.trending')} path="widget_v2_config.trending_prompts.showTrendingPrompts.value" get={get} set={set} disabled={disabled} />
        <Field label={t('form.promptsTitle')} path="widget_v2_config.trending_prompts.displaySettings.sectionTitle" get={get} set={set} disabled={disabled} />
      </div>

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
        {chips.map((p, i) => (
          <li key={i} className="row-in flex items-center gap-2" style={{ '--d': i } as React.CSSProperties}>
            <input
              className="input"
              value={p.text ?? ''}
              placeholder={t('builder.chips.placeholder')}
              onChange={(e) => update(chips.map((c, j) => (j === i ? { ...c, text: e.target.value } : c)))}
              disabled={disabled}
            />
            <button className="btn-danger btn-sm shrink-0" onClick={() => update(chips.filter((_, j) => j !== i))} disabled={disabled} title={t('common.delete')} aria-label={t('common.delete')}>
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <section>
        <SectionHead>{t('builder.chips.style')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.chips.border')} path="widget_v2_config.trending_prompts.chipStyle.borderColor" get={get} set={set} disabled={disabled} />
          <Field label={t('form.radius')} path="widget_v2_config.trending_prompts.chipStyle.borderRadius" get={get} set={set} disabled={disabled} placeholder="1.25rem" />
        </div>
      </section>
    </div>
  )
}

function InputPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.input')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.placeholder')} path="widget_v2_config.chat_input.placeholderText.text" get={get} set={set} disabled={disabled} />
          <SelectField label={t('form.inputLayout')} path="widget_v2_config.chat_input.inputLayout.type" options={['floating_pill', 'full_width_bar']} get={get} set={set} disabled={disabled} />
          <div>
            <label className="label">{t('builder.input.direction')}</label>
            <Select
              label={t('builder.input.direction')}
              value={get('widget_v2_config.chat_input.direction') === 'ltr' || get('widget_v2_config.chat_input.direction') === 'rtl' ? get('widget_v2_config.chat_input.direction') : 'auto'}
              onChange={(v) => set('widget_v2_config.chat_input.direction', v)}
              disabled={disabled}
              options={[
                { value: 'auto', label: t('builder.input.direction.auto') },
                { value: 'ltr', label: 'LTR' },
                { value: 'rtl', label: 'RTL' },
              ]}
            />
          </div>
          <div>
            <label className="label">{t('builder.input.sendIcon')}</label>
            <Select
              label={t('builder.input.sendIcon')}
              value={asSendIcon(get('widget_v2_config.chat_input.sendButtonIcon.icon'))}
              onChange={(v) => set('widget_v2_config.chat_input.sendButtonIcon.icon', v)}
              disabled={disabled}
              options={SEND_ICONS.map((name) => ({
                value: name,
                label: t(`builder.input.sendIcon.${name}`),
                icon: <SendIcon name={name} className="size-3.5" />,
              }))}
            />
          </div>
          <ColorField label={t('builder.input.sendBg')} path="widget_v2_config.chat_input.sendButtonIcon.styles.backgroundColor" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.sendFg')} path="widget_v2_config.chat_input.sendButtonIcon.styles.iconColor" get={get} set={set} disabled={disabled} />
          {asSendIcon(get('widget_v2_config.chat_input.sendButtonIcon.icon')) === 'custom' && (
            <div className="sm:col-span-2">
              <MediaInput
                label={t('builder.input.sendIcon.customImage')}
                value={get('widget_v2_config.chat_input.sendButtonIcon.url') ?? ''}
                onChange={(v) => set('widget_v2_config.chat_input.sendButtonIcon.url', v)}
                disabled={disabled}
              />
            </div>
          )}
          <ColorField label={t('builder.input.actionColor')} path="widget_v2_config.chat_input.inputActions.iconColor" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path="widget_v2_config.chat_input.styles.backgroundColor" get={get} set={set} disabled={disabled} />
          <Field label={t('builder.input.padding')} path="widget_v2_config.chat_input.styles.padding" get={get} set={set} disabled={disabled} placeholder="10px 16px" />
          <ToggleField label={t('form.voice')} path="widget_v2_config.chat_input.inputActions.voiceMessages" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.input.attach')} path="widget_v2_config.chat_input.inputActions.attachmentMenu" get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}

function MessagesPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.msgs.ai')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.msgs.cardBg')} path="widget_v2_config.messages.aiMessages.CardStyles.backgroundColor" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path="widget_v2_config.messages.aiMessages.TextStyles.color" get={get} set={set} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.user')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('form.userBubbleBg')} path="widget_v2_config.messages.customerMessages.bubbleStyle.backgroundColor" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.userBubbleText')} path="widget_v2_config.messages.customerMessages.TextStyles.color" get={get} set={set} disabled={disabled} />
          <Field label={t('form.bubbleRadius')} path="widget_v2_config.messages.customerMessages.bubbleStyle.borderRadius" get={get} set={set} disabled={disabled} placeholder="18px 18px 4px 18px" />
          <ToggleField label={t('builder.msgs.feedback')} path="widget_v2_config.messages.feedback.showFeedbackButtons" get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}

function LauncherPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.launcher')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('form.launcherStyle')} path="launcher_style" options={['standard', 'expanded_bubble', 'chat_icon', 'icon_only']} get={get} set={set} disabled={disabled} />
          <SelectField label={t('form.launcherPosition')} path="launcher_position" options={['right', 'left']} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.launcher.title')} path="launcher_title" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.launcher.bg')} path="launcher_styles.backgroundColor" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('form.poweredBy')} path="powered_by_pair_ai" get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}
