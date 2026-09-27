import { Database, Globe, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { WidgetPreview } from '@/components/WidgetPreview'
import { Empty, Modal, SourceBadge, Spinner, Stat } from '@/components/ui'
import { api, fmtDate, type Source, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

export function Widgets() {
  const { can } = useAuth()
  const toast = useToast()
  const [widgets, setWidgets] = useState<Widget[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const load = () => api.listWidgets().then((r) => setWidgets(r.widgets)).catch((e) => toast.err(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (widgets ?? []).filter((w) => !s || w.channelName.toLowerCase().includes(s) || w.widgetId.toLowerCase().includes(s))
  }, [widgets, q])
  const counts = useMemo(() => ({ total: widgets?.length ?? 0, redis: widgets?.filter((w) => w.source === 'redis').length ?? 0, api: widgets?.filter((w) => w.source === 'api').length ?? 0 }), [widgets])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Widget Studio</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">Widgets</h1>
          <p className="mt-1 text-sm text-ink-500">Each row is a channel and its Pair widget ID. Pick whether its design comes live from the Pair API or from the Redis override.</p>
        </div>
        {can('editor') && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" />New widget</button>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Registered" value={counts.total} sub="channels" />
        <Stat label="Served from Redis" value={counts.redis} sub="local design override" />
        <Stat label="Served from Pair API" value={counts.api} sub="live, cached 60s" />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
        <input className="input pl-9" placeholder="Search channel or widget ID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {widgets === null ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <Empty title={widgets.length ? 'No matches' : 'No widgets yet'} hint={widgets.length ? 'Try a different search.' : 'Register a channel with its Pair widget ID to start designing.'} action={can('editor') && !widgets.length ? <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" />New widget</button> : undefined} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-[11px] font-bold uppercase tracking-wider text-ink-500">
              <tr><th className="px-5 py-3">Channel</th><th className="px-5 py-3">Widget ID</th><th className="px-5 py-3">Source</th><th className="hidden px-5 py-3 md:table-cell">Config saved</th><th className="hidden px-5 py-3 lg:table-cell">Updated</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((w) => (
                <tr key={w.widgetId} className="group hover:bg-pair-50/40">
                  <td className="px-5 py-3.5"><Link to={`/widgets/${w.widgetId}`} className="font-semibold text-ink-900 group-hover:text-pair-600">{w.channelName}</Link>{w.notes && <p className="truncate text-xs text-ink-500">{w.notes}</p>}</td>
                  <td className="px-5 py-3.5"><code className="mono rounded bg-ink-50 px-1.5 py-0.5 text-xs">{w.widgetId}</code></td>
                  <td className="px-5 py-3.5"><SourceBadge source={w.source} /></td>
                  <td className="hidden px-5 py-3.5 text-ink-500 md:table-cell">{w.configUpdatedAt ? <>{fmtDate(w.configUpdatedAt)}<span className="block text-xs text-ink-300">by {w.configUpdatedBy}</span></> : <span className="text-ink-300">never</span>}</td>
                  <td className="hidden px-5 py-3.5 text-ink-500 lg:table-cell">{fmtDate(w.updatedAt)}<span className="block text-xs text-ink-300">by {w.updatedBy}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <NewWidgetModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load() }} />}
    </div>
  )
}

function NewWidgetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [channelName, setChannelName] = useState('')
  const [widgetId, setWidgetId] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState<Source>('api')
  const [peek, setPeek] = useState<WidgetConfig | null>(null)
  const [peeking, setPeeking] = useState(false)
  const [busy, setBusy] = useState(false)

  const doPeek = async () => {
    if (!widgetId.trim()) return
    setPeeking(true)
    try {
      const r = await api.peekWidget(widgetId.trim(), apiBaseUrl || undefined)
      setPeek(r.config)
      if (!channelName && typeof r.config.name === 'string') setChannelName(r.config.name)
    } catch (e) { setPeek(null); toast.err((e as Error).message) } finally { setPeeking(false) }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      await api.createWidget({ widgetId: widgetId.trim(), channelName: channelName.trim(), source, apiBaseUrl: apiBaseUrl || undefined, notes: notes || undefined, importFromApi: source === 'redis' })
      toast.ok(`Widget "${channelName}" registered`)
      onCreated()
    } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title="New widget" subtitle="Register a channel and choose where its design is served from." onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <label className="label">Widget ID (from Pair)</label>
            <div className="flex gap-2">
              <input className="input mono" placeholder="01KZ0RE6RABAXZJR9CA9G1SDDN" value={widgetId} onChange={(e) => setWidgetId(e.target.value)} required />
              <button type="button" className="btn-ghost shrink-0" onClick={doPeek} disabled={peeking || !widgetId.trim()}>{peeking ? <Spinner className="size-4" /> : 'Fetch'}</button>
            </div>
            <p className="mt-1 text-xs text-ink-500">Fetch pulls the live config from Pair so you can preview it before saving.</p>
          </div>
          <div><label className="label">Channel name</label><input className="input" placeholder="Cinescape AI" value={channelName} onChange={(e) => setChannelName(e.target.value)} required /></div>
          <div>
            <label className="label">Design source</label>
            <div className="grid grid-cols-2 gap-2">
              <SourceOption active={source === 'api'} onClick={() => setSource('api')} icon={<Globe className="size-4" />} title="Pair API" desc="Always fetch the live design from Pair. Nothing is stored." />
              <SourceOption active={source === 'redis'} onClick={() => setSource('redis')} icon={<Database className="size-4" />} title="Redis" desc="Snapshot the Pair design into Redis now and edit it here." />
            </div>
          </div>
          <details className="rounded-xl border border-ink-100 p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-ink-500">Advanced</summary>
            <div className="mt-3 space-y-3">
              <div><label className="label">Pair API base URL override</label><input className="input mono" placeholder="https://system.trypair.ai" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} /></div>
              <div><label className="label">Notes</label><input className="input" placeholder="Internal note" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
          </details>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy ? <Spinner className="size-4" /> : source === 'redis' ? 'Import & register' : 'Register'}</button>
          </div>
        </div>
        <div className="hidden md:block"><div className="scale-[0.72] origin-top"><WidgetPreview config={peek} /></div></div>
      </form>
    </Modal>
  )
}

function SourceOption({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active ? 'border-pair-400 bg-pair-50 ring-4 ring-pair-100' : 'border-ink-100 hover:border-pair-200'}`}>
      <p className={`flex items-center gap-1.5 text-sm font-bold ${active ? 'text-pair-600' : ''}`}>{icon}{title}</p>
      <p className="mt-1 text-xs text-ink-500">{desc}</p>
    </button>
  )
}
