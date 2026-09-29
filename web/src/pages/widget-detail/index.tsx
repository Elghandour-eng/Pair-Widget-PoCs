import { ArrowLeft, Copy, Database, Download, Globe, Monitor, Moon, RotateCcw, Save, Smartphone, Sun, Tablet, Trash2, Wand2, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PreviewStage, stageSize, type PreviewDevice } from '@/components/WidgetPreview'
import { EmbedPanel } from '@/components/EmbedPanel'
import { normalizeLauncher } from '@/lib/inputDesign'
import { CopyIcon, FitScale, Loading, Modal, Spinner } from '@/components/ui'
import { api, publicConfigUrl, type AuditEntry, type Source, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAuditLabel, useFormatDate, useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'
import { DesignForm } from './DesignForm'
import { Compare, NotesPanel } from './NotesComparePanels'

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
            {tab === 'embed' && <EmbedPanel widget={widget} sdkBaseUrl={sdkBaseUrl} panel={normalizeLauncher((stored as Record<string, unknown> | null)?.launcher_design).panel} />}
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
