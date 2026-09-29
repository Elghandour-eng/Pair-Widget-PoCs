import { RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Select } from '@/components/Select'
import { Pagination, Spinner } from '@/components/ui'
import { api, FEEDBACK_STATUSES, type FeedbackNote, type FeedbackStatus, type WidgetConfig } from '@/lib/api'
import { useFormatDate, useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

/** Tester notes with a triage workflow: search, status filter with counts, pagination. */
const STATUS_TONE: Record<FeedbackStatus, string> = {
  open: 'border-accent-200 bg-accent-50 text-accent-deep',
  in_progress: 'border-accent bg-white text-accent-deep',
  solved: 'border-line bg-code text-muted',
  dismissed: 'border-divider bg-white text-faint',
}

export function NotesPanel({ widgetId, editor }: { widgetId: string; editor: boolean }) {
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

export function Compare({ live, liveErr, stored, onRefresh }: { live: WidgetConfig | null; liveErr: string | null; stored: WidgetConfig | null; onRefresh: () => void }) {
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
