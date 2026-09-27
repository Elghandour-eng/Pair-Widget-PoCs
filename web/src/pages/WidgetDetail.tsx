import { ArrowLeft, Copy, Database, Download, Globe, Monitor, Moon, RefreshCw, RotateCcw, Save, Search, Smartphone, Sun, Tablet, Trash2, Wand2, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PreviewStage, stageSize, type PreviewDevice } from '@/components/WidgetPreview'
import { EmbedPanel } from '@/components/EmbedPanel'
import { Select } from '@/components/Select'
import { MediaInput } from '@/components/MediaInput'
import { CopyIcon, FitScale, Loading, Modal, Pagination, SectionHead, Spinner } from '@/components/ui'
import { api, publicConfigUrl, FEEDBACK_STATUSES, type AuditEntry, type FeedbackNote, type FeedbackStatus, type Source, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAuditLabel, useFormatDate, useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

type Tab = 'design' | 'json' | 'embed' | 'compare' | 'activity' | 'notes'
const TABS: Tab[] = ['design', 'json', 'embed', 'compare', 'activity', 'notes']

export function WidgetDetail() {
  const { widgetId = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const { t } = useI18n()
  const fmt = useFormatDate()
  const auditLabel = useAuditLabel()

  const [widget, setWidget] = useState<Widget | null>(null)
  const [stored, setStored] = useState<WidgetConfig | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [live, setLive] = useState<WidgetConfig | null>(null)
  const [liveErr, setLiveErr] = useState<string | null>(null)
  const [sdkBaseUrl, setSdkBaseUrl] = useState('')
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<Tab>('design')
  const [dark, setDark] = useState(false)
  const [device, setDevice] = useState<PreviewDevice>('iphone')
  const [landscape, setLandscape] = useState(false)
  const [liveSdk, setLiveSdk] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.getWidget(widgetId)
      setWidget(r.widget)
      setStored(r.storedConfig)
      setAudit(r.audit)
      setSdkBaseUrl(r.sdkBaseUrl)
      setDraft(JSON.stringify(r.storedConfig ?? {}, null, 2))
    } catch (e) {
      toast.err((e as Error).message)
      nav('/widgets')
    }
  }, [widgetId, nav, toast])

  const loadLive = useCallback(() => {
    setLiveErr(null)
    api.resolveConfig(widgetId, 'api').then((r) => setLive(r.config)).catch((e) => { setLive(null); setLiveErr((e as Error).message) })
  }, [widgetId])

  useEffect(() => { load(); loadLive() }, [load, loadLive])

  const parsed = useMemo<{ ok: true; value: WidgetConfig } | { ok: false; error: string }>(() => {
    try {
      const v = JSON.parse(draft)
      if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'Config must be a JSON object' }
      return { ok: true, value: v }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }, [draft])

  const dirty = useMemo(() => JSON.stringify(stored ?? {}) !== (parsed.ok ? JSON.stringify(parsed.value) : '__invalid__'), [stored, parsed])
  const previewConfig = widget?.source === 'api' && !dirty && !stored ? live : parsed.ok ? parsed.value : stored

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try { await fn() } catch (e) { toast.err((e as Error).message) } finally { setBusy(null) }
  }
  const save = () => run('save', async () => {
    if (!parsed.ok) throw new Error(parsed.error)
    const r = await api.saveConfig(widgetId, parsed.value)
    setWidget(r.widget); setStored(parsed.value); toast.ok(t('detail.saved')); load()
  })
  const importApi = () => run('import', async () => {
    const r = await api.importFromApi(widgetId)
    setWidget(r.widget); setStored(r.storedConfig); setDraft(JSON.stringify(r.storedConfig, null, 2)); setLive(r.storedConfig)
    toast.ok(t('detail.imported')); load()
  })
  const switchSource = (source: Source) => run('source', async () => {
    const r = await api.updateWidget(widgetId, { source })
    setWidget(r.widget); toast.ok(t('detail.switched', { source: t(`source.${source}` as MsgKey) })); load()
  })
  const remove = () => run('delete', async () => { await api.deleteWidget(widgetId); toast.ok(t('detail.deleted')); nav('/widgets') })
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicConfigUrl(widgetId))
      setCopied(true)
      toast.ok(t('detail.copied'))
      setTimeout(() => setCopied(false), 1600)
    } catch (e) { toast.err((e as Error).message) }
  }

  if (!widget) return <Loading />
  const editor = can('editor')
  const stage = stageSize(device, landscape)
  const previewState = dirty ? t('detail.preview.draft') : widget.source === 'redis' || stored ? t('detail.preview.redis') : t('detail.preview.live')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      {/* One compact strip: identity, source switch and the save actions */}
      <div className="anim-rise flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2.5">
        <Link
          to="/widgets"
          title={t('detail.back')}
          aria-label={t('detail.back')}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition-all duration-200 hover:border-accent-300 hover:text-accent-deep"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.005em] text-ink sm:text-[20px]">{widget.channelName}</h1>
            {dirty && <span className="badge border border-accent bg-white text-accent-deep">{t('detail.unsaved')}</span>}
          </div>
          <p className="mono truncate text-[10.5px] leading-tight text-faint">{widget.widgetId}</p>
        </div>

        <div className="flex shrink-0 rounded-lg border border-line bg-code p-0.5" title={widget.source === 'redis' ? t('detail.source.redisHint') : t('detail.source.apiHint')}>
          <SourceToggle active={widget.source === 'api'} onClick={() => switchSource('api')} disabled={!editor || !!busy} icon={<Globe className="size-3.5" />} label={t('source.api')} />
          <SourceToggle
            active={widget.source === 'redis'}
            onClick={() => switchSource('redis')}
            disabled={!editor || !!busy || !stored}
            icon={<Database className="size-3.5" />}
            label={t('source.redis')}
            title={!stored ? t('detail.source.needConfig') : undefined}
          />
        </div>

        <div className="flex shrink-0 gap-1.5">
          <Link to={`/widgets/${encodeURIComponent(widgetId)}/builder`} className="btn-ghost btn-sm" title={t('detail.openBuilder')}>
            <Wand2 className="size-4" />
            <span className="hidden md:inline">{t('detail.openBuilder')}</span>
          </Link>
          <button className="btn-ghost btn-sm" onClick={copyUrl} title={t('detail.copyUrl')} aria-label={t('detail.copyUrl')}>
            <CopyIcon copied={copied} fallback={<Copy className="size-4" />} />
          </button>
          {editor && (
            <button className="btn-ghost btn-sm" onClick={importApi} disabled={!!busy} title={t('detail.import')} aria-label={t('detail.import')}>
              {busy === 'import' ? <Spinner className="size-4" /> : <Download className="size-4" />}
            </button>
          )}
          {can('admin') && (
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)} title={t('detail.delete')} aria-label={t('detail.delete')}>
              <Trash2 className="size-4" />
            </button>
          )}
          {editor && (
            <button className="btn-primary btn-sm px-3" onClick={save} disabled={!!busy || !parsed.ok || !dirty}>
              {busy === 'save' ? <Spinner className="size-4 border-white/40 border-t-white" /> : <Save className="size-4" />}
              <span className="hidden md:inline">{t('detail.save')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="card flex min-w-0 flex-col overflow-hidden xl:min-h-0">
          <div className="scroll-pane flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2.5 pt-1.5">
            {TABS.map((tk) => (
              <button key={tk} onClick={() => setTab(tk)} data-active={tab === tk} className="tab shrink-0">
                {t(`detail.tab.${tk}` as MsgKey)}
              </button>
            ))}
          </div>
          <div key={tab} className="scroll-pane anim-fade p-4 sm:p-5 xl:min-h-0 xl:flex-1">
            {tab === 'design' && (
              <DesignForm
                value={parsed.ok ? parsed.value : null}
                disabled={!editor}
                onChange={(v) => setDraft(JSON.stringify(v, null, 2))}
                onSeedFromLive={live && !stored ? () => setDraft(JSON.stringify(live, null, 2)) : undefined}
                invalid={!parsed.ok ? parsed.error : null}
              />
            )}
            {tab === 'json' && (
              <div className="space-y-2">
                <textarea
                  className="input mono h-[min(52dvh,520px)] resize-y text-[11.5px] leading-[1.55]"
                  dir="ltr"
                  spellCheck={false}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!editor}
                />
                <p className={`text-[11px] font-semibold ${parsed.ok ? 'text-faint' : 'text-alert'}`}>
                  {parsed.ok ? t('common.chars', { count: draft.length.toLocaleString('en-US') }) : parsed.error}
                </p>
              </div>
            )}
            {tab === 'embed' && <EmbedPanel widget={widget} sdkBaseUrl={sdkBaseUrl} />}
            {tab === 'compare' && <Compare live={live} liveErr={liveErr} stored={stored} onRefresh={loadLive} />}
            {tab === 'notes' && <NotesPanel widgetId={widgetId} editor={editor} />}
            {tab === 'activity' && (
              <ul className="divide-y divide-divider text-[13px]">
                {audit.length === 0 && <li className="py-10 text-center text-faint/80">{t('activity.empty')}</li>}
                {audit.map((a, i) => (
                  <li key={i} className="row-in flex items-start justify-between gap-4 py-2.5" style={{ '--d': i } as React.CSSProperties}>
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{auditLabel(a.action)}</p>
                      {a.detail && <p className="mono mt-0.5 break-words text-[11px] text-faint">{a.detail}</p>}
                    </div>
                    <p className="shrink-0 text-end text-[11px] text-muted">
                      {fmt(a.at)}
                      <span className="mono block text-faint">{a.by}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Preview column — pinned; editing never moves it */}
        <div className="flex min-w-0 flex-col xl:min-h-0">
          <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="eyebrow">{t('detail.preview')} · {previewState}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-lg border border-line bg-code p-0.5" role="group" aria-label={t('detail.preview')}>
                <DeviceToggle active={device === 'iphone'} onClick={() => setDevice('iphone')} icon={<Smartphone className="size-3.5" />} label={t('preview.device.iphone')} />
                <DeviceToggle active={device === 'android'} onClick={() => setDevice('android')} icon={<Tablet className="size-3.5" />} label={t('preview.device.android')} />
                <DeviceToggle active={device === 'web'} onClick={() => setDevice('web')} icon={<Monitor className="size-3.5" />} label={t('preview.device.web')} />
              </div>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setLandscape((l) => !l)}
                disabled={device === 'web'}
                aria-pressed={landscape}
                title={t('preview.rotate')}
                aria-label={t('preview.rotate')}
              >
                <RotateCcw className={`size-4 transition-transform duration-300 ${landscape ? '-rotate-90' : ''}`} />
              </button>
              <button
                className={`btn-sm ${liveSdk ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setLiveSdk((v) => !v)}
                aria-pressed={liveSdk}
                title={t('preview.liveSdk.hint')}
              >
                <Zap className="size-4" />
                <span className="hidden md:inline">{t('preview.liveSdk')}</span>
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setDark((d) => !d)} title={t('detail.preview.dark')} aria-label={t('detail.preview.dark')}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
          <FitScale width={stage.w} height={stage.h} className="max-h-[72dvh] xl:max-h-none xl:flex-1">
            <PreviewStage
              config={previewConfig}
              dark={dark}
              device={device}
              landscape={landscape}
              liveUrl={liveSdk ? `/api/public/widget/${encodeURIComponent(widgetId)}/embed?frame=1` : undefined}
            />
          </FitScale>
        </div>
      </div>

      <p className="fine shrink-0 truncate border-t border-line pt-2.5">
        {widget.configUpdatedAt
          ? t('detail.meta.configSaved', { when: fmt(widget.configUpdatedAt), who: widget.configUpdatedBy ?? '—' })
          : t('detail.meta.configNever')}
        {' · '}
        {t('detail.meta.created', { created: fmt(widget.createdAt), createdBy: widget.createdBy, updated: fmt(widget.updatedAt), updatedBy: widget.updatedBy })}
        {widget.apiBaseUrl && <> · {t('detail.meta.apiBase')} <code className="mono">{widget.apiBaseUrl}</code></>}
      </p>

      {confirmDelete && (
        <Modal title={t('detail.delete.title')} subtitle={t('detail.delete.subtitle', { name: widget.channelName })} onClose={() => setConfirmDelete(false)}>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</button>
            <button className="btn-danger" onClick={remove} disabled={!!busy}>
              {busy === 'delete' ? <Spinner className="size-4" /> : t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DeviceToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold transition-all duration-200 ${
        active ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function SourceToggle({ active, onClick, disabled, icon, label, title }: { active: boolean; onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || active}
      title={title}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-bold transition-all duration-200 disabled:cursor-not-allowed ${
        active ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink disabled:opacity-40'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

/** Structured editor for the most-used design fields. Everything else stays untouched in the JSON. */
function DesignForm({
  value,
  onChange,
  disabled,
  onSeedFromLive,
  invalid,
}: {
  value: WidgetConfig | null
  onChange: (v: WidgetConfig) => void
  disabled: boolean
  onSeedFromLive?: () => void
  invalid: string | null
}) {
  const { t } = useI18n()

  if (invalid) return <p className="callout border-alert text-alert">{t('form.invalid', { error: invalid })}</p>
  if (!value || Object.keys(value).length === 0) {
    return (
      <div className="anim-rise rounded-lg border border-dashed border-line p-8 text-center">
        <p className="font-bold text-ink">{t('form.empty.title')}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-[1.6] text-muted">{t('form.empty.hint')}</p>
        {onSeedFromLive && (
          <button className="btn-ghost mt-4" onClick={onSeedFromLive} disabled={disabled}>
            <Download className="size-4" />
            {t('form.empty.seed')}
          </button>
        )}
      </div>
    )
  }

  const v = value as Record<string, any>
  const set = (path: string, val: unknown) => {
    const next = structuredClone(v)
    const parts = path.split('.')
    let cur: any = next
    for (const p of parts.slice(0, -1)) {
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
      cur = cur[p]
    }
    cur[parts.at(-1)!] = val
    onChange(next)
  }
  const get = (path: string): any => path.split('.').reduce<any>((a, k) => (a && typeof a === 'object' ? a[k] : undefined), v)

  const F = ({ label, path, type = 'text', placeholder }: { label: string; path: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        {type === 'color' && (
          <input
            type="color"
            className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1 transition-colors duration-200 hover:border-accent-300"
            value={/^#[0-9a-f]{6}$/i.test(get(path) ?? '') ? get(path) : '#4d98e2'}
            onChange={(e) => set(path, e.target.value)}
            disabled={disabled}
            aria-label={label}
          />
        )}
        <input className={`input ${type === 'color' ? 'mono' : ''}`} dir={type === 'color' || placeholder?.startsWith('http') ? 'ltr' : undefined} placeholder={placeholder} value={get(path) ?? ''} onChange={(e) => set(path, e.target.value)} disabled={disabled} />
      </div>
    </div>
  )

  const Toggle = ({ label, path }: { label: string; path: string }) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px] font-bold text-ink transition-all duration-200 hover:border-accent-300 hover:bg-white">
      {label}
      <input type="checkbox" className="size-4 shrink-0 accent-[#4d98e2]" checked={get(path) !== false && get(path) !== undefined ? !!get(path) : false} onChange={(e) => set(path, e.target.checked)} disabled={disabled} />
    </label>
  )

  const Sel = ({ label, path, options }: { label: string; path: string; options: string[] }) => (
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

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.brand')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.name')} path="name" />
          <F label={t('form.color')} path="widget_color" type="color" placeholder="#E50914" />
          <LocaleToggle value={get('locale')} onChange={(l) => set('locale', l)} disabled={disabled} />
          <div className="sm:col-span-2">
            <MediaInput label={t('form.avatar')} value={get('avatar_url') ?? ''} onChange={(v) => set('avatar_url', v)} disabled={disabled} />
          </div>
          <div className="sm:col-span-2">
            <MediaInput label={t('form.launcherIcon')} value={get('launcher_icon_url') ?? ''} onChange={(v) => set('launcher_icon_url', v)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead>{t('form.header')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.headerTitle')} path="widget_v2_config.header.content.title" />
          <F label={t('form.headerSubtitle')} path="widget_v2_config.header.content.subtitle" />
          <F label={t('form.headerBg')} path="widget_v2_config.header.background.color" type="color" />
          <div className="grid content-end gap-2">
            <Toggle label={t('form.headerShow')} path="widget_v2_config.header.enabled" />
            <Toggle label={t('form.headerBgOn')} path="widget_v2_config.header.background.enabled" />
          </div>
          <div className="sm:col-span-2">
            <MediaInput label={t('form.headerLogo')} value={get('widget_v2_config.header.icon') ?? ''} onChange={(v) => set('widget_v2_config.header.icon', v)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead>{t('form.intro')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.welcomeTitle')} path="widget_v2_config.intro_screen.welcomeTitle.text" />
          <F label={t('form.welcomeSubtitle')} path="widget_v2_config.intro_screen.welcomeSubtitle.text" />
          <F label={t('form.widgetBg')} path="widget_v2_config.intro_screen.widgetBackground.background" type="color" />
          <div className="sm:col-span-2">
            <MediaInput
              label={t('form.heroUrl')}
              value={get('widget_v2_config.intro_screen.heroSection.heroImage.url') ?? ''}
              onChange={(v) => set('widget_v2_config.intro_screen.heroSection.heroImage.url', v)}
              disabled={disabled}
            />
          </div>
          <Toggle label={t('form.heroShow')} path="widget_v2_config.intro_screen.heroSection.enabled.value" />
          <Toggle label={t('form.introShow')} path="widget_v2_config.intro_screen.showIntroScreen.value" />
        </div>
      </section>

      <section>
        <SectionHead>{t('form.input')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.placeholder')} path="widget_v2_config.chat_input.placeholderText.text" />
          <Sel label={t('form.inputLayout')} path="widget_v2_config.chat_input.inputLayout.type" options={['floating_pill', 'full_width_bar']} />
          <Sel label={t('form.launcherStyle')} path="launcher_style" options={['standard', 'expanded_bubble', 'chat_icon', 'icon_only']} />
          <Sel label={t('form.launcherPosition')} path="launcher_position" options={['right', 'left']} />
          <Toggle label={t('form.voice')} path="widget_v2_config.chat_input.inputActions.voiceMessages" />
          <Toggle label={t('form.poweredBy')} path="powered_by_pair_ai" />
        </div>
      </section>

      <section>
        <SectionHead>{t('form.sections')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label={t('form.quickLinks')} path="widget_v2_config.quick_links.showQuickLinks.value" />
          <Toggle label={t('form.trending')} path="widget_v2_config.trending_prompts.showTrendingPrompts.value" />
          <div className="sm:col-span-2">
            <F label={t('form.promptsTitle')} path="widget_v2_config.trending_prompts.displaySettings.sectionTitle" />
          </div>
        </div>
        <p className="callout mt-3.5">{t('form.sectionsNote')}</p>
      </section>

      <section>
        <SectionHead>{t('form.messages')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.userBubbleBg')} path="widget_v2_config.messages.userBubble.background" type="color" />
          <F label={t('form.userBubbleText')} path="widget_v2_config.messages.userBubble.color" type="color" />
          <F label={t('form.agentText')} path="widget_v2_config.messages.agentMessage.color" type="color" />
          <F label={t('form.bubbleRadius')} path="widget_v2_config.messages.userBubble.borderRadius" placeholder="10px" />
          <div className="sm:col-span-2">
            <MediaInput label={t('form.agentIcon')} value={get('widget_v2_config.messages.aiMessages.iconUrl') ?? ''} onChange={(v) => set('widget_v2_config.messages.aiMessages.iconUrl', v)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead>{t('form.typography')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label={t('form.fontFamily')} path="styles.fontFamily" placeholder="Montserrat, sans-serif" />
          <F label={t('form.fontSize')} path="styles.fontSize" placeholder="14px" />
          <F label={t('form.radius')} path="styles.borderRadius" placeholder="10px" />
          <F label={t('form.launcherSize')} path="launcher_size" placeholder="56" />
        </div>
      </section>
    </div>
  )
}

/** Tester notes with a triage workflow: search, status filter with counts, pagination. */
const STATUS_TONE: Record<FeedbackStatus, string> = {
  open: 'border-accent-200 bg-accent-50 text-accent-deep',
  in_progress: 'border-accent bg-white text-accent-deep',
  solved: 'border-line bg-code text-muted',
  dismissed: 'border-divider bg-white text-faint',
}

function NotesPanel({ widgetId, editor }: { widgetId: string; editor: boolean }) {
  const { t } = useI18n()
  const toast = useToast()
  const fmt = useFormatDate()
  const [notes, setNotes] = useState<FeedbackNote[] | null>(null)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<FeedbackStatus, number> | null>(null)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<FeedbackStatus | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(8)

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [q])

  const loadNotes = useCallback(() => {
    api.getFeedback(widgetId, { q: debouncedQ || undefined, status: status || undefined, page, perPage })
      .then((r) => { setNotes(r.notes); setTotal(r.total); setCounts(r.counts) })
      .catch((e) => { setNotes([]); toast.err((e as Error).message) })
  }, [widgetId, debouncedQ, status, page, perPage, toast])
  useEffect(() => { loadNotes() }, [loadNotes])

  const changeStatus = async (note: FeedbackNote, next: FeedbackStatus) => {
    try {
      const r = await api.setFeedbackStatus(widgetId, note.id, next)
      setNotes((cur) => (cur ?? []).map((n) => (n.id === note.id ? r.note : n)))
      setCounts((c) => c && note.status !== next ? { ...c, [note.status]: Math.max(0, c[note.status] - 1), [next]: c[next] + 1 } : c)
      toast.ok(t('notes.statusChanged', { status: t(`fbstatus.${next}` as MsgKey) }))
    } catch (e) { toast.err((e as Error).message) }
  }

  const pageCount = Math.max(1, Math.ceil(total / perPage))
  const allCount = counts ? (Object.values(counts) as number[]).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[46em] text-[12.5px] leading-[1.6] text-muted">{t('notes.lede')}</p>
        <button className="btn-ghost btn-sm" onClick={loadNotes}>
          <RefreshCw className="size-4" />
          {t('notes.refresh')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint/60" />
          <input className="input ps-9 py-2 text-[13px]" placeholder={t('notes.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="scroll-pane flex items-center gap-1 overflow-x-auto rounded-lg border border-line bg-code p-0.5">
          <button
            onClick={() => { setStatus(''); setPage(1) }}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11.5px] font-bold transition-all duration-200 ${status === '' ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink'}`}
          >
            {t('notes.all')}{counts ? ` · ${allCount}` : ''}
          </button>
          {FEEDBACK_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-bold transition-all duration-200 ${status === s ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink'}`}
            >
              {t(`fbstatus.${s}` as MsgKey)}{counts ? ` · ${counts[s]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {notes === null && <div className="flex justify-center py-10"><Spinner /></div>}
      {notes !== null && notes.length === 0 && <p className="callout">{debouncedQ || status ? t('notes.noMatch') : t('notes.empty')}</p>}

      <ul className="space-y-2.5">
        {(notes ?? []).map((n, i) => (
          <li key={n.id} className="row-in rounded-lg border border-line bg-white px-3.5 py-3" style={{ '--d': Math.min(i, 12) } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-ink">{n.note}</p>
              {editor ? (
                <div className="w-[130px] shrink-0">
                  <Select
                    label={t('notes.status')}
                    value={n.status}
                    onChange={(v) => changeStatus(n, v as FeedbackStatus)}
                    options={FEEDBACK_STATUSES.map((s) => ({ value: s, label: t(`fbstatus.${s}` as MsgKey) }))}
                  />
                </div>
              ) : (
                <span className={`badge shrink-0 border ${STATUS_TONE[n.status]}`}>{t(`fbstatus.${n.status}` as MsgKey)}</span>
              )}
            </div>
            {n.imageUrl && (
              <a href={n.imageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                <img src={n.imageUrl} alt="" className="max-h-[130px] rounded-md border border-line transition-transform duration-200 hover:scale-[1.02]" />
              </a>
            )}
            <p className="mt-1.5 text-[11px] text-muted">
              <span className="font-bold text-accent-deep">{n.name}</span> ({n.role}) · {fmt(n.at)}
              {n.updatedBy && n.status !== 'open' && <> · {t('notes.updatedBy', { who: n.updatedBy })}</>}
            </p>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        from={total === 0 ? 0 : (page - 1) * perPage + 1}
        to={Math.min(page * perPage, total)}
        onPage={(p) => setPage(Math.min(Math.max(1, p), pageCount))}
        perPage={perPage}
        onPerPage={(n) => { setPerPage(n); setPage(1) }}
      />
    </div>
  )
}

/** Widget language: Kuwaiti flag for Arabic, US flag for English, or both. */
const LOCALE_CHOICES = [
  { value: 'en', flag: '🇺🇸', key: 'locale.en' },
  { value: 'ar', flag: '🇰🇼', key: 'locale.ar' },
  { value: 'both', flag: '🇺🇸🇰🇼', key: 'locale.both' },
] as const

function LocaleToggle({ value, onChange, disabled }: { value: unknown; onChange: (v: string) => void; disabled: boolean }) {
  const { t } = useI18n()
  const raw = typeof value === 'string' ? value : 'en'
  const current = raw === 'both' ? 'both' : /^ar/i.test(raw) ? 'ar' : 'en'

  return (
    <div>
      <label className="label">{t('form.locale')}</label>
      <div className="flex h-[42px] rounded-lg border border-line bg-code p-0.5" role="group" aria-label={t('form.locale')}>
        {LOCALE_CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            disabled={disabled}
            aria-pressed={current === c.value}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-bold transition-all duration-200 disabled:cursor-not-allowed ${
              current === c.value ? 'bg-white text-accent-deep shadow-[0_1px_2px_rgba(15,18,22,0.06)]' : 'text-muted hover:text-ink disabled:opacity-40'
            }`}
          >
            <span aria-hidden>{c.flag}</span>
            {t(c.key)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Compare({ live, liveErr, stored, onRefresh }: { live: WidgetConfig | null; liveErr: string | null; stored: WidgetConfig | null; onRefresh: () => void }) {
  const { t } = useI18n()
  const diff = useMemo(() => {
    if (!live || !stored) return []
    const out: { path: string; live: string; stored: string }[] = []
    const walk = (a: any, b: any, p: string) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return
      const isObj = (x: unknown) => x && typeof x === 'object' && !Array.isArray(x)
      if (isObj(a) && isObj(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? `${p}.${k}` : k)
        return
      }
      out.push({ path: p || '(root)', live: short(a), stored: short(b) })
    }
    walk(live, stored, '')
    return out
  }, [live, stored])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[46em] text-[12.5px] leading-[1.6] text-muted">{t('compare.lede')}</p>
        <button className="btn-ghost btn-sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          {t('compare.refresh')}
        </button>
      </div>
      {liveErr && <p className="callout border-alert text-alert">{t('compare.failed', { error: liveErr })}</p>}
      {!stored && <p className="callout">{t('compare.nothing')}</p>}
      {live && stored && diff.length === 0 && <p className="callout">{t('compare.identical')}</p>}
      {diff.length > 0 && (
        <>
          <p className="eyebrow">{t('compare.count', { count: diff.length })}</p>
          <div className="scroll-pane max-h-[min(46dvh,460px)] overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 border-b border-accent bg-surface">
                <tr>
                  <th className="th text-start">{t('compare.col.path')}</th>
                  <th className="th text-start">{t('compare.col.live')}</th>
                  <th className="th text-start">{t('compare.col.redis')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {diff.map((d, i) => (
                  <tr key={d.path} className="row-in" style={{ '--d': Math.min(i, 12) } as React.CSSProperties}>
                    <td className="mono td py-2 text-body">{d.path}</td>
                    <td className="mono td max-w-[240px] truncate py-2 text-muted" title={d.live}>{d.live}</td>
                    <td className="mono td max-w-[240px] truncate py-2 text-accent-deep" title={d.stored}>{d.stored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const short = (x: unknown) => (x === undefined ? '∅' : JSON.stringify(x).slice(0, 120))
