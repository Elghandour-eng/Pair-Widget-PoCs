import {
  ArrowLeft, BellRing, Check, ClipboardList, Download, Image as ImageIcon, Languages,
  LayoutGrid, LoaderCircle, MessagesSquare,
  Moon, Palette, PanelTop, RotateCcw, Rocket, Save, Share2, ShieldCheck, Sparkles, Star, Sun,
  TextCursorInput,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FitScale, Loading, Spinner } from '@/components/ui'
import { api, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PairWordmark } from '@/components/brand'
import {
  PREVIEW_FRAME_PATH, applyLanguage, applyTheme, deepGet, deepSet,
  isPreviewOutMsg, type PreviewEventMsg, type PreviewInMsg, type ThemeName, type WidgetLang,
} from '@/lib/builder'
import { useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'
import { ConsentPage } from './ConsentPage'
import { HeaderPage, HeroPage } from './HeaderHeroPages'
import { InputPage } from './InputPage'
import { LauncherPage, LoadingPage, ToastPage } from './LauncherLoadingToastPages'
import { MessagesPage, RatingPage } from './MessagesRatingPages'
import { PreChatPage } from './PreChatPage'
import { PromptsPage } from './PromptsPage'
import { QuickLinksPage } from './QuickLinksPage'
import { LanguagePage, ThemePage } from './ThemeLanguagePages'

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
