import { ArrowLeft, Check, Copy, Database, Download, Globe, Moon, RefreshCw, Save, Sun, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WidgetPreview } from '@/components/WidgetPreview'
import { Modal, SourceBadge, Spinner } from '@/components/ui'
import { api, fmtDate, publicConfigUrl, type AuditEntry, type Source, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type Tab = 'design' | 'json' | 'compare' | 'activity'

export function WidgetDetail() {
  const { widgetId = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const [widget, setWidget] = useState<Widget | null>(null)
  const [stored, setStored] = useState<WidgetConfig | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [live, setLive] = useState<WidgetConfig | null>(null)
  const [liveErr, setLiveErr] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<Tab>('design')
  const [dark, setDark] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.getWidget(widgetId)
      setWidget(r.widget); setStored(r.storedConfig); setAudit(r.audit)
      setDraft(JSON.stringify(r.storedConfig ?? {}, null, 2))
    } catch (e) { toast.err((e as Error).message); nav('/widgets') }
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
    } catch (e) { return { ok: false, error: (e as Error).message } }
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
    setWidget(r.widget); setStored(parsed.value); toast.ok('Config saved to Redis'); load()
  })
  const importApi = () => run('import', async () => {
    const r = await api.importFromApi(widgetId)
    setWidget(r.widget); setStored(r.storedConfig); setDraft(JSON.stringify(r.storedConfig, null, 2)); setLive(r.storedConfig)
    toast.ok('Live Pair design imported into Redis'); load()
  })
  const switchSource = (source: Source) => run('source', async () => {
    const r = await api.updateWidget(widgetId, { source })
    setWidget(r.widget); toast.ok(`Now serving from ${source === 'redis' ? 'Redis' : 'Pair API'}`); load()
  })
  const remove = () => run('delete', async () => { await api.deleteWidget(widgetId); toast.ok('Widget deleted'); nav('/widgets') })
  const copyUrl = async () => { await navigator.clipboard.writeText(publicConfigUrl(widgetId)); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  if (!widget) return <div className="flex justify-center py-20"><Spinner /></div>
  const editor = can('editor')

  return (
    <div className="space-y-6">
      <Link to="/widgets" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-pair-600"><ArrowLeft className="size-4" />All widgets</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-extrabold md:text-3xl">{widget.channelName}</h1><SourceBadge source={widget.source} /></div>
          <p className="mono mt-1 text-sm text-ink-500">{widget.widgetId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={copyUrl}>{copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}Public config URL</button>
          {editor && <button className="btn-ghost" onClick={importApi} disabled={!!busy}>{busy === 'import' ? <Spinner className="size-4" /> : <Download className="size-4" />}Import from Pair</button>}
          {editor && <button className="btn-primary" onClick={save} disabled={!!busy || !parsed.ok || !dirty}>{busy === 'save' ? <Spinner className="size-4" /> : <Save className="size-4" />}Save to Redis</button>}
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex-1">
          <p className="eyebrow">Design source</p>
          <p className="mt-0.5 text-sm text-ink-500">{widget.source === 'redis' ? 'The widget renders the Redis config below. Pair is not called.' : 'The widget renders the live Pair design (cached 60s). Redis is ignored until you switch.'}</p>
        </div>
        <div className="flex rounded-xl border border-ink-100 bg-ink-50 p-1">
          <SourceToggle active={widget.source === 'api'} onClick={() => switchSource('api')} disabled={!editor || !!busy} icon={<Globe className="size-4" />} label="Pair API" />
          <SourceToggle active={widget.source === 'redis'} onClick={() => switchSource('redis')} disabled={!editor || !!busy || !stored} icon={<Database className="size-4" />} label="Redis" title={!stored ? 'Import or save a config first' : undefined} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 border-b border-ink-100 px-3 pt-2">
            {(['design', 'json', 'compare', 'activity'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-t-lg px-3 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'border-b-2 border-pair-500 text-pair-600' : 'text-ink-500 hover:text-ink-900'}`}>{t}</button>
            ))}
            {dirty && <span className="ml-auto mr-2 badge bg-amber-50 text-amber-700">unsaved</span>}
          </div>
          <div className="p-5">
            {tab === 'design' && <DesignForm value={parsed.ok ? parsed.value : null} disabled={!editor} onChange={(v) => setDraft(JSON.stringify(v, null, 2))} onSeedFromLive={live && !stored ? () => setDraft(JSON.stringify(live, null, 2)) : undefined} invalid={!parsed.ok ? parsed.error : null} />}
            {tab === 'json' && (
              <div className="space-y-2">
                <textarea className="input mono min-h-[520px] resize-y text-xs leading-relaxed" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!editor} />
                <p className={`text-xs ${parsed.ok ? 'text-ink-500' : 'text-red-600'}`}>{parsed.ok ? `${draft.length.toLocaleString()} chars · valid JSON` : parsed.error}</p>
              </div>
            )}
            {tab === 'compare' && <Compare live={live} liveErr={liveErr} stored={stored} onRefresh={loadLive} />}
            {tab === 'activity' && (
              <ul className="divide-y divide-ink-100 text-sm">
                {audit.length === 0 && <li className="py-6 text-center text-ink-300">No activity yet</li>}
                {audit.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 py-2.5"><div><p className="font-semibold capitalize">{a.action}</p>{a.detail && <p className="text-xs text-ink-500">{a.detail}</p>}</div><p className="shrink-0 text-right text-xs text-ink-500">{fmtDate(a.at)}<span className="block text-ink-300">{a.by}</span></p></li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Preview {dirty ? '· draft' : widget.source === 'redis' || stored ? '· redis' : '· live'}</p>
            <button className="btn-ghost px-2.5 py-1.5" onClick={() => setDark((d) => !d)} title="Toggle dark preview">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
          </div>
          <div className="sticky top-6"><WidgetPreview config={previewConfig} dark={dark} /></div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-ink-500">
        <div className="space-y-0.5">
          <p>Created {fmtDate(widget.createdAt)} by {widget.createdBy} · Updated {fmtDate(widget.updatedAt)} by {widget.updatedBy}</p>
          <p>Redis config {widget.configUpdatedAt ? `saved ${fmtDate(widget.configUpdatedAt)} by ${widget.configUpdatedBy}` : 'never saved'}{widget.apiBaseUrl && <> · API base <code className="mono">{widget.apiBaseUrl}</code></>}</p>
        </div>
        {can('admin') && <button className="btn-danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Delete widget</button>}
      </div>

      {confirmDelete && (
        <Modal title="Delete widget?" subtitle={`"${widget.channelName}" and its Redis config will be removed. Pair itself is not affected.`} onClose={() => setConfirmDelete(false)}>
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="btn-danger" onClick={remove} disabled={!!busy}>{busy === 'delete' ? <Spinner className="size-4" /> : 'Delete'}</button></div>
        </Modal>
      )}
    </div>
  )
}

function SourceToggle({ active, onClick, disabled, icon, label, title }: { active: boolean; onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; title?: string }) {
  return <button onClick={onClick} disabled={disabled || active} title={title} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${active ? 'bg-white text-pair-600 shadow-sm' : 'text-ink-500 hover:text-ink-900 disabled:opacity-40'}`}>{icon}{label}</button>
}

/** Structured editor for the most-used design fields. Everything else stays untouched in the JSON. */
function DesignForm({ value, onChange, disabled, onSeedFromLive, invalid }: { value: WidgetConfig | null; onChange: (v: WidgetConfig) => void; disabled: boolean; onSeedFromLive?: () => void; invalid: string | null }) {
  if (invalid) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Fix the JSON first: {invalid}</p>
  if (!value || Object.keys(value).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-100 p-8 text-center">
        <p className="font-semibold">No Redis config yet</p>
        <p className="mt-1 text-sm text-ink-500">Import the live Pair design to start editing, or paste JSON in the JSON tab.</p>
        {onSeedFromLive && <button className="btn-ghost mt-4" onClick={onSeedFromLive} disabled={disabled}><Download className="size-4" />Use live Pair design as draft</button>}
      </div>
    )
  }
  const v = value as Record<string, any>
  const set = (path: string, val: unknown) => {
    const next = structuredClone(v)
    const parts = path.split('.')
    let cur: any = next
    for (const p of parts.slice(0, -1)) { if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}; cur = cur[p] }
    cur[parts.at(-1)!] = val
    onChange(next)
  }
  const get = (path: string): any => path.split('.').reduce<any>((a, k) => (a && typeof a === 'object' ? a[k] : undefined), v)
  const F = ({ label, path, type = 'text', placeholder }: { label: string; path: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        {type === 'color' && <input type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-ink-100 bg-white p-1" value={/^#[0-9a-f]{6}$/i.test(get(path) ?? '') ? get(path) : '#2f80ed'} onChange={(e) => set(path, e.target.value)} disabled={disabled} />}
        <input className="input" placeholder={placeholder} value={get(path) ?? ''} onChange={(e) => set(path, e.target.value)} disabled={disabled} />
      </div>
    </div>
  )
  const Toggle = ({ label, path }: { label: string; path: string }) => (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5 text-sm font-semibold">
      {label}
      <input type="checkbox" className="size-4 accent-pair-500" checked={get(path) !== false && get(path) !== undefined ? !!get(path) : false} onChange={(e) => set(path, e.target.checked)} disabled={disabled} />
    </label>
  )
  const Sel = ({ label, path, options }: { label: string; path: string; options: string[] }) => (
    <div><label className="label">{label}</label><select className="input" value={get(path) ?? ''} onChange={(e) => set(path, e.target.value)} disabled={disabled}><option value="">—</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
  )
  return (
    <div className="space-y-7">
      <Section title="Brand">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Widget name" path="name" />
          <F label="Brand color" path="widget_color" type="color" placeholder="#E50914" />
          <F label="Avatar URL" path="avatar_url" placeholder="https://…" />
          <F label="Locale" path="locale" placeholder="en" />
        </div>
      </Section>
      <Section title="Header">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Title" path="widget_v2_config.header.content.title" />
          <F label="Subtitle" path="widget_v2_config.header.content.subtitle" />
          <F label="Header background" path="widget_v2_config.header.background.color" type="color" />
          <div className="grid gap-2"><Toggle label="Show header" path="widget_v2_config.header.enabled" /><Toggle label="Header background on" path="widget_v2_config.header.background.enabled" /></div>
        </div>
      </Section>
      <Section title="Intro screen">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Welcome title" path="widget_v2_config.intro_screen.welcomeTitle.text" />
          <F label="Welcome subtitle" path="widget_v2_config.intro_screen.welcomeSubtitle.text" />
          <F label="Hero image URL" path="widget_v2_config.intro_screen.heroSection.heroImage.url" placeholder="https://…" />
          <F label="Widget background" path="widget_v2_config.intro_screen.widgetBackground.background" type="color" />
          <Toggle label="Show hero" path="widget_v2_config.intro_screen.heroSection.enabled.value" />
          <Toggle label="Show intro screen" path="widget_v2_config.intro_screen.showIntroScreen.value" />
        </div>
      </Section>
      <Section title="Chat input & launcher">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Placeholder" path="widget_v2_config.chat_input.placeholderText.text" />
          <Sel label="Input layout" path="widget_v2_config.chat_input.inputLayout.type" options={['floating_pill', 'full_width_bar']} />
          <Sel label="Launcher style" path="launcher_style" options={['standard', 'expanded_bubble', 'chat_icon', 'icon_only']} />
          <Sel label="Launcher position" path="launcher_position" options={['right', 'left']} />
          <Toggle label="Voice messages" path="widget_v2_config.chat_input.inputActions.voiceMessages" />
          <Toggle label="Powered by Pair" path="powered_by_pair_ai" />
        </div>
      </Section>
      <Section title="Sections">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Quick links" path="widget_v2_config.quick_links.showQuickLinks.value" />
          <Toggle label="Trending prompts" path="widget_v2_config.trending_prompts.showTrendingPrompts.value" />
          <F label="Prompts section title" path="widget_v2_config.trending_prompts.displaySettings.sectionTitle" />
        </div>
        <p className="mt-2 text-xs text-ink-500">Quick-link cards, prompt chips, message bubbles and per-element CSS live in the JSON tab.</p>
      </Section>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><p className="eyebrow mb-3">{title}</p>{children}</section>
}

function Compare({ live, liveErr, stored, onRefresh }: { live: WidgetConfig | null; liveErr: string | null; stored: WidgetConfig | null; onRefresh: () => void }) {
  const diff = useMemo(() => {
    if (!live || !stored) return []
    const out: { path: string; live: string; stored: string }[] = []
    const walk = (a: any, b: any, p: string) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return
      const isObj = (x: unknown) => x && typeof x === 'object' && !Array.isArray(x)
      if (isObj(a) && isObj(b)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? `${p}.${k}` : k); return }
      out.push({ path: p || '(root)', live: short(a), stored: short(b) })
    }
    walk(live, stored, '')
    return out
  }, [live, stored])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">Differences between the <b>live Pair design</b> and the <b>Redis override</b>.</p>
        <button className="btn-ghost px-2.5 py-1.5" onClick={onRefresh}><RefreshCw className="size-4" />Refresh live</button>
      </div>
      {liveErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Live fetch failed: {liveErr}</p>}
      {!stored && <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500">Nothing stored in Redis yet.</p>}
      {live && stored && diff.length === 0 && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Identical. Redis matches Pair exactly.</p>}
      {diff.length > 0 && (
        <div className="overflow-auto rounded-xl border border-ink-100">
          <table className="w-full text-xs">
            <thead className="bg-ink-50 text-left font-bold uppercase tracking-wider text-ink-500"><tr><th className="px-3 py-2">Path</th><th className="px-3 py-2">Live (Pair)</th><th className="px-3 py-2">Redis</th></tr></thead>
            <tbody className="divide-y divide-ink-100">{diff.map((d) => <tr key={d.path}><td className="mono px-3 py-2 text-ink-700">{d.path}</td><td className="mono max-w-[240px] truncate px-3 py-2 text-ink-500" title={d.live}>{d.live}</td><td className="mono max-w-[240px] truncate px-3 py-2 text-emerald-700" title={d.stored}>{d.stored}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
const short = (x: unknown) => (x === undefined ? '∅' : JSON.stringify(x).slice(0, 120))
