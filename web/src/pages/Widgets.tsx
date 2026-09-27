import { ChevronRight, Database, Globe, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PREVIEW_H, PREVIEW_W, WidgetPreview } from '@/components/WidgetPreview'
import { Disclosure, Empty, FitScale, Loading, Modal, PageHead, Pagination, SourceBadge, Spinner, Stat } from '@/components/ui'
import { api, type Source, type Widget, type WidgetConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFormatDate, useI18n } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

export function Widgets() {
  const { can } = useAuth()
  const { t } = useI18n()
  const fmt = useFormatDate()
  const toast = useToast()
  const [widgets, setWidgets] = useState<Widget[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(8)

  const load = () => api.listWidgets().then((r) => setWidgets(r.widgets)).catch((e) => toast.err(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (widgets ?? []).filter((w) => !s || w.channelName.toLowerCase().includes(s) || w.widgetId.toLowerCase().includes(s))
  }, [widgets, q])
  // Searching or reloading must not strand the viewer on a page that no longer exists.
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const current = Math.min(page, pageCount)
  useEffect(() => { setPage(1) }, [q, perPage])
  useEffect(() => { if (page !== current) setPage(current) }, [page, current])
  const visible = useMemo(() => filtered.slice((current - 1) * perPage, current * perPage), [filtered, current, perPage])

  const counts = useMemo(
    () => ({
      total: widgets?.length ?? 0,
      redis: widgets?.filter((w) => w.source === 'redis').length ?? 0,
      api: widgets?.filter((w) => w.source === 'api').length ?? 0,
    }),
    [widgets],
  )

  const newButton = (
    <button className="btn-primary" onClick={() => setOpen(true)}>
      <Plus className="size-4" />
      {t('widgets.new')}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <PageHead eyebrow={t('widgets.eyebrow')} title={t('widgets.title')} lede={t('widgets.lede')} action={can('editor') ? newButton : undefined} />

      <div className="stagger grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t('widgets.stat.total')} value={counts.total} sub={t('widgets.stat.totalSub')} delay={0} />
        <Stat label={t('widgets.stat.redis')} value={counts.redis} sub={t('widgets.stat.redisSub')} delay={1} />
        <Stat label={t('widgets.stat.api')} value={counts.api} sub={t('widgets.stat.apiSub')} delay={2} />
      </div>

      <div className="anim-rise relative w-full max-w-sm shrink-0">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint/60" />
        <input className="input ps-9" placeholder={t('widgets.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {widgets === null ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty
          title={widgets.length ? t('widgets.noMatch.title') : t('widgets.empty.title')}
          hint={widgets.length ? t('widgets.noMatch.hint') : t('widgets.empty.hint')}
          action={can('editor') && !widgets.length ? newButton : undefined}
        />
      ) : (
        <>
          <div className="scroll-pane -mx-1 min-h-0 flex-1 px-1">
          {/* Desktop: table */}
          <div className="card anim-rise hidden overflow-hidden md:block">
            <table className="w-full text-[13px]">
              <thead className="border-b border-accent bg-surface/70 text-start">
                <tr>
                  <th className="th text-start">{t('widgets.col.channel')}</th>
                  <th className="th text-start">{t('widgets.col.id')}</th>
                  <th className="th text-start">{t('widgets.col.source')}</th>
                  <th className="th hidden text-start lg:table-cell">{t('widgets.col.configSaved')}</th>
                  <th className="th hidden text-start xl:table-cell">{t('widgets.col.updated')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {visible.map((w, i) => (
                  <tr key={w.widgetId} className="row-in group transition-colors duration-200 hover:bg-accent-50/60" style={{ '--d': i } as React.CSSProperties}>
                    {/* w-full + max-w-0 makes this the flexible column, so long notes truncate
                        instead of pushing the date columns out of the viewport. */}
                    <td className="td w-full max-w-0">
                      <Link to={`/widgets/${w.widgetId}`} className="block truncate font-bold text-ink transition-colors duration-200 group-hover:text-accent-deep">
                        {w.channelName}
                      </Link>
                      {w.notes && <p className="mt-0.5 truncate text-[11px] text-faint">{w.notes}</p>}
                    </td>
                    <td className="td whitespace-nowrap"><code className="mono rounded-xs bg-code px-1.5 py-0.5 text-[11px] text-muted">{w.widgetId}</code></td>
                    <td className="td"><SourceBadge source={w.source} /></td>
                    <td className="td hidden whitespace-nowrap text-muted lg:table-cell">
                      {w.configUpdatedAt ? (
                        <>
                          {fmt(w.configUpdatedAt)}
                          <span className="block text-[11px] text-faint">{t('common.by', { name: w.configUpdatedBy ?? '—' })}</span>
                        </>
                      ) : (
                        <span className="text-faint/70">{t('common.never')}</span>
                      )}
                    </td>
                    <td className="td hidden whitespace-nowrap text-muted xl:table-cell">
                      {fmt(w.updatedAt)}
                      <span className="block text-[11px] text-faint">{t('common.by', { name: w.updatedBy })}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="stagger grid gap-2.5 md:hidden">
            {visible.map((w, i) => (
              <Link key={w.widgetId} to={`/widgets/${w.widgetId}`} className="card lift block px-4 py-3.5" style={{ '--d': i } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{w.channelName}</p>
                    <code className="mono mt-1 block truncate text-[10.5px] text-faint">{w.widgetId}</code>
                    {w.notes && <p className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-faint">{w.notes}</p>}
                  </div>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint/70 rtl:-scale-x-100" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <SourceBadge source={w.source} />
                  <span className="text-[10.5px] text-faint">{w.configUpdatedAt ? fmt(w.configUpdatedAt) : t('common.never')}</span>
                </div>
              </Link>
            ))}
          </div>
          </div>

          <div className="shrink-0 border-t border-line pt-3">
          <Pagination
            page={current}
            pageCount={pageCount}
            total={filtered.length}
            from={(current - 1) * perPage + 1}
            to={Math.min(current * perPage, filtered.length)}
            perPage={perPage}
            onPerPage={setPerPage}
            onPage={setPage}
          />
          </div>
        </>
      )}

      {open && <NewWidgetModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load() }} />}
    </div>
  )
}

function NewWidgetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n()
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
    } catch (e) {
      setPeek(null)
      toast.err((e as Error).message)
    } finally {
      setPeeking(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.createWidget({
        widgetId: widgetId.trim(),
        channelName: channelName.trim(),
        source,
        apiBaseUrl: apiBaseUrl || undefined,
        notes: notes || undefined,
        importFromApi: true,
      })
      toast.ok(t('new.created', { name: channelName }))
      onCreated()
    } catch (err) {
      toast.err((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('new.title')} subtitle={t('new.subtitle')} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="wid">{t('new.widgetId')}</label>
            <div className="flex gap-2">
              <input id="wid" className="input mono" dir="ltr" placeholder="01KZ0RE6RABAXZJR9CA9G1SDDN" value={widgetId} onChange={(e) => setWidgetId(e.target.value)} required />
              <button type="button" className="btn-ghost" onClick={doPeek} disabled={peeking || !widgetId.trim()}>
                {peeking ? <Spinner className="size-4" /> : t('new.fetch')}
              </button>
            </div>
            <p className="fine mt-1.5">{t('new.fetchHint')}</p>
          </div>

          <div>
            <label className="label" htmlFor="chan">{t('new.channelName')}</label>
            <input id="chan" className="input" placeholder="Cinescape AI" value={channelName} onChange={(e) => setChannelName(e.target.value)} required />
          </div>

          <div>
            <span className="label">{t('new.source')}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SourceOption active={source === 'api'} onClick={() => setSource('api')} icon={<Globe className="size-4" />} title={t('source.api')} desc={t('new.source.apiDesc')} />
              <SourceOption active={source === 'redis'} onClick={() => setSource('redis')} icon={<Database className="size-4" />} title={t('source.redis')} desc={t('new.source.redisDesc')} />
            </div>
          </div>

          <Disclosure summary={t('common.advanced')}>
            <div>
              <label className="label" htmlFor="base">{t('new.apiBase')}</label>
              <input id="base" className="input mono" dir="ltr" placeholder="https://system.trypair.ai" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="notes">{t('new.notes')}</label>
              <input id="notes" className="input" placeholder={t('new.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </Disclosure>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={busy}>
              {busy ? <Spinner className="size-4 border-white/40 border-t-white" /> : source === 'redis' ? t('new.submitImport') : t('new.submit')}
            </button>
          </div>
        </div>

        <div className="hidden w-[240px] lg:block">
          <FitScale width={PREVIEW_W} height={PREVIEW_H} className="h-[min(56dvh,440px)]">
            <WidgetPreview config={peek} />
          </FitScale>
        </div>
      </form>
    </Modal>
  )
}

function SourceOption({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border p-3 text-start transition-all duration-200 ${active ? 'border-2 border-accent bg-white' : 'border-line bg-surface/60 hover:border-accent-300 hover:bg-white'}`}
    >
      <p className={`flex items-center gap-1.5 text-[13px] font-bold ${active ? 'text-accent-deep' : 'text-ink'}`}>{icon}{title}</p>
      <p className="mt-1 text-[11px] leading-[1.5] text-muted">{desc}</p>
    </button>
  )
}
