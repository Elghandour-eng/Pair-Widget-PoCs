import { AlertTriangle, Info, RefreshCw, Search, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Select } from '@/components/Select'
import { Empty, Loading, PageHead, Pagination } from '@/components/ui'
import { api, type LogLevel, type SystemLog } from '@/lib/api'
import { useFormatDate, useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

const LEVELS: LogLevel[] = ['info', 'warn', 'error']

export function Logs() {
  const { t } = useI18n()
  const fmt = useFormatDate()
  const toast = useToast()
  const [logs, setLogs] = useState<SystemLog[] | null>(null)
  const [total, setTotal] = useState(0)
  const [available, setAvailable] = useState(true)
  const [actions, setActions] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(16)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 350)
    return () => clearTimeout(id)
  }, [q])
  useEffect(() => { setPage(1) }, [level, action, debouncedQ, perPage])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const r = await api.listLogs({ level, action, q: debouncedQ, page, perPage })
      setLogs(r.logs)
      setTotal(r.total)
      setAvailable(r.available)
    } catch (e) {
      toast.err((e as Error).message)
      setLogs([])
    } finally {
      setBusy(false)
    }
  }, [level, action, debouncedQ, page, perPage, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { api.listLogActions().then((r) => setActions(r.actions)).catch(() => undefined) }, [])

  const pageCount = Math.max(1, Math.ceil(total / perPage))
  const actionOptions = useMemo(
    () => [{ value: '', label: t('logs.allActions') }, ...actions.map((a) => ({ value: a, label: a }))],
    [actions, t],
  )
  const levelOptions = useMemo(
    () => [{ value: '', label: t('logs.allLevels') }, ...LEVELS.map((l) => ({ value: l, label: t(`logs.level.${l}` as MsgKey) }))],
    [t],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <PageHead
        eyebrow={t('logs.eyebrow')}
        title={t('logs.title')}
        lede={t('logs.lede')}
        action={
          <button className="btn-ghost" onClick={load} disabled={busy}>
            <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
            {t('logs.refresh')}
          </button>
        }
      />

      {!available && <p className="callout shrink-0 border-accent">{t('logs.unavailable')}</p>}

      <div className="anim-rise grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_13rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint/60" />
          <input className="input ps-9" placeholder={t('logs.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select label={t('logs.level')} value={level} options={levelOptions} onChange={setLevel} placeholder={t('logs.allLevels')} />
        <Select label={t('logs.action')} value={action} options={actionOptions} onChange={setAction} placeholder={t('logs.allActions')} />
      </div>

      {logs === null ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty title={t('logs.empty.title')} hint={available ? t('logs.empty.hint') : t('logs.unavailable')} />
      ) : (
        <>
          <div className="scroll-pane -mx-1 min-h-0 flex-1 px-1">
          <ul className="card anim-rise divide-y divide-divider overflow-hidden">
            {logs.map((l, i) => (
              <li key={`${l.at}-${i}`} className="row-in flex items-start gap-3 px-4 py-3" style={{ '--d': i } as React.CSSProperties}>
                <LevelIcon level={l.level} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <code className="mono rounded-xs bg-code px-1.5 py-0.5 text-[10.5px] font-bold text-accent-deep">{l.action}</code>
                    {l.widgetId && <code className="mono break-all text-[10.5px] text-faint">{l.widgetId}</code>}
                  </div>
                  <p className="mt-1 break-words text-[12.5px] leading-[1.55] text-body">{l.message}</p>
                  {/* On narrow screens the meta moves under the message instead of squeezing it. */}
                  <p className="mt-1 break-words text-[10.5px] text-faint sm:hidden">
                    {fmt(l.at)}
                    {l.actor && <span className="mono"> · {l.actor}</span>}
                  </p>
                </div>
                <div className="hidden shrink-0 text-end sm:block">
                  <p className="text-[11px] text-muted">{fmt(l.at)}</p>
                  {l.actor && <p className="mono text-[10.5px] text-faint">{l.actor}</p>}
                </div>
              </li>
            ))}
          </ul>
          </div>

          <div className="shrink-0 border-t border-line pt-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            from={(page - 1) * perPage + 1}
            to={Math.min(page * perPage, total)}
            perPage={perPage}
            onPerPage={setPerPage}
            onPage={setPage}
          />
          </div>
        </>
      )}
    </div>
  )
}

function LevelIcon({ level }: { level: LogLevel }) {
  if (level === 'error') return <XCircle className="mt-0.5 size-4 shrink-0 text-alert" />
  if (level === 'warn') return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-deep" />
  return <Info className="mt-0.5 size-4 shrink-0 text-accent-300" />
}
