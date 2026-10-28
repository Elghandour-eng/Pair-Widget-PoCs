import { ArrowLeft, Check, ChevronLeft, ChevronRight, FlaskConical, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Loading, Modal, PageHead, SectionHead, Spinner } from '@/components/ui'
import {
  api, type AgentPlugin, type DataSource, type DesignField, type SourceKind, type TemplateDef,
  type TemplateDesign, type Widget, type WidgetTemplates,
} from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFormatDate, useI18n } from '@/lib/i18n'
import { useToast } from '@/lib/toast'
import { CardPreview, setSdkCardBase, type CardContent } from './templates/CardPreview'
import { DesignControls } from './templates/DesignControls'

/**
 * The template engine's workspace.
 *
 * A gallery of the real cards, and — on picking one — a design workspace where
 * the card is drawn live while the knobs move. Choosing a widget loads that
 * widget's own overrides, so the design being edited is the design that widget
 * will render, and saving is the same action as assigning the template to it.
 *
 * The preview is rendered by the server's real hydrator on every change, so
 * what an operator tunes is what a customer gets, never an approximation.
 */

const TTL_CHOICES = [0, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000]
const humanMs = (ms: number): string => {
  const min = Math.round(ms / 60_000)
  return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`
}

export function Templates() {
  const { t } = useI18n()
  const { can } = useAuth()
  const toast = useToast()
  const [templates, setTemplates] = useState<TemplateDef[] | null>(null)
  const [designFields, setDesignFields] = useState<Record<string, DesignField>>({})
  const [sources, setSources] = useState<DataSource[]>([])
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [openName, setOpenName] = useState<string | null>(null)
  const [tab, setTab] = useState<'templates' | 'sources'>('templates')

  const reload = useCallback(async () => {
    const [tpl, src, wid] = await Promise.all([api.listTemplates(), api.listDataSources(), api.listWidgets()])
    setTemplates(tpl.templates)
    setDesignFields(tpl.designFields)
    setSdkCardBase(tpl.sdkBaseUrl)
    setSources(src.sources)
    setWidgets(wid.widgets)
  }, [])

  useEffect(() => {
    reload().catch((err) => toast.err(err instanceof Error ? err.message : String(err)))
  }, [reload, toast])

  if (!templates) return <Loading full />
  const open = templates.find((x) => x.name === openName) ?? null

  return (
    <div className="space-y-8">
      {open ? (
        <Designer
          tpl={open}
          fields={designFields}
          sources={sources}
          widgets={widgets}
          onBack={() => setOpenName(null)}
        />
      ) : (
        <>
          <PageHead
            eyebrow={t('tpl.eyebrow')}
            title={t('tpl.title')}
            lede={tab === 'templates' ? t('tpl.lede') : t('tpl.sourcesLede')}
            action={
              <div className="flex gap-2">
                <Link to="/templates/playground" className="btn-ghost btn-sm">
                  <FlaskConical className="size-3.5" /> {t('tpl.playground')}
                </Link>
                {/* The way in that does not need an engineer: a design, and a template out. */}
                <Link to="/templates/studio" className="btn-primary btn-sm">
                  <Sparkles className="size-3.5" /> {t('tpl.new')}
                </Link>
              </div>
            }
          />
          {/* The two halves of the engine, one at a time: the shapes, and the feeds behind them. */}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              ['templates', t('tpl.tabTemplates'), templates.length],
              ['sources', t('tpl.tabSources'), sources.length],
            ]}
          />
          {tab === 'templates' ? (
            <Gallery templates={templates} onOpen={setOpenName} />
          ) : (
            <SourcesPanel sources={sources} canEdit={can('editor')} canDelete={can('admin')} onChanged={reload} />
          )}
        </>
      )}
    </div>
  )
}

/** Page-level tabs, with a count so an empty half says so before it is opened. */
function Tabs<T extends string>({ value, onChange, tabs }: {
  value: T
  onChange: (v: T) => void
  tabs: Array<[T, string, number]>
}) {
  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
            value === key ? 'border-brand font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {label}
          <span className="chip text-[10px]">{count}</span>
        </button>
      ))}
    </div>
  )
}

/* --------------------------------- gallery --------------------------------- */

const CATEGORIES = ['all', 'commerce', 'health', 'ticketing', 'cinema', 'media'] as const
type Category = (typeof CATEGORIES)[number]
const PAGE_SIZE = 9

/**
 * The catalog: one shelf per kind of business (Hiro's health cards, tickets,
 * cinema, media), a search across names and descriptions, and pages of nine so
 * the gallery stays quick as templates are added. Every tile draws its card,
 * so a page loads only the previews it shows.
 */
function Gallery({ templates, onOpen }: { templates: TemplateDef[]; onOpen: (name: string) => void }) {
  const { t } = useI18n()
  const [cat, setCat] = useState<Category>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: templates.length, commerce: 0, health: 0, ticketing: 0, cinema: 0, media: 0 }
    for (const x of templates) c[x.category] = (c[x.category] ?? 0) + 1
    return c
  }, [templates])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return templates.filter(
      (x) =>
        (cat === 'all' || x.category === cat) &&
        (!needle || [x.title, x.name, x.description, x.widgetType].some((v) => v?.toLowerCase().includes(needle))),
    )
  }, [templates, cat, q])

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const slice = shown.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('tpl.categories')}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              onClick={() => { setCat(c); setPage(0) }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                cat === c ? 'border-accent bg-accent-50 text-accent-deep' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {t(`tpl.cat.${c}` as Parameters<typeof t>[0])}
              <span className="chip text-[10px]">{counts[c]}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            className="input ps-9"
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0) }}
            placeholder={t('tpl.search')}
            aria-label={t('tpl.search')}
          />
        </label>
      </div>

      {slice.length === 0 ? (
        <Empty title={t('tpl.noMatch')} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {slice.map((tpl) => (
            <GalleryTile key={tpl.name} tpl={tpl} onOpen={() => onOpen(tpl.name)} />
          ))}
        </section>
      )}

      {pages > 1 && (
        <nav
          /* Pinned to the foot of the scroll pane: the pager stays in reach
             without scrolling past the nine tiles first. */
          className="raise sticky bottom-3 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-white/90 px-2 py-1.5 backdrop-blur"
          aria-label={t('tpl.pages')}
        >
          <button type="button" className="btn-ghost btn-sm" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label={t('tpl.prev')}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-current={i === current}
              className={`size-8 rounded-lg text-[12.5px] font-bold ${i === current ? 'bg-accent text-white' : 'text-muted hover:bg-surface'}`}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setPage(current + 1)} disabled={current === pages - 1} aria-label={t('tpl.next')}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        </nav>
      )}
    </div>
  )
}

/** One template, drawn as the card it actually is. The shape is the label. */
function GalleryTile({ tpl, onOpen }: { tpl: TemplateDef; onOpen: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [content, setContent] = useState<CardContent | null>(null)

  useEffect(() => {
    let live = true
    api
      .previewTemplate(tpl.name)
      .then((r) => live && setContent({ ...(r.content as CardContent), widgetTemplate: tpl.native ? r.template : undefined }))
      .catch(() => live && setContent(null))
    return () => {
      live = false
    }
  }, [tpl.name])

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card group flex flex-col gap-3 p-4 text-start transition-shadow hover:shadow-md"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-ink">{tpl.title}</h3>
          <p className="mono text-[11px] text-muted">{tpl.name}</p>
        </div>
        <span className="chip shrink-0 text-[10px]">
          {tpl.custom ? t('tpl.studio') : tpl.plugin ? t('tpl.pluginChip', { plugin: tpl.plugin.id, group: tpl.plugin.group }) : tpl.widgetType}
        </span>
      </header>

      {/* The card at reduced scale: enough to recognise the shape at a glance. */}
      <div className="relative h-[190px] overflow-hidden rounded-xl bg-sunken p-3">
        {content ? (
          <div className="origin-top-left scale-[0.78]" style={{ width: '128%' }}>
            <CardPreview type={tpl.widgetType} content={content} isDark={false} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center"><Spinner /></div>
        )}
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-muted">{tpl.description}</p>
      <span className="flex items-center gap-3 text-[11px] font-bold">
        <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100">{t('tpl.design')} →</span>
        {tpl.custom && (
          <span
            role="link"
            tabIndex={0}
            className="text-muted hover:text-accent-deep"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/templates/studio/${tpl.name}`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                navigate(`/templates/studio/${tpl.name}`)
              }
            }}
          >
            {t('tpl.edit')}
          </span>
        )}
      </span>
    </button>
  )
}

/* -------------------------------- the designer ------------------------------ */

function Designer({ tpl, fields, sources, widgets, onBack }: {
  tpl: TemplateDef
  fields: Record<string, DesignField>
  sources: DataSource[]
  widgets: Widget[]
  onBack: () => void
}) {
  const { t } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const [widgetId, setWidgetId] = useState('')
  const [saved, setSaved] = useState<WidgetTemplates | null>(null)
  // undefined: no widget picked. null: the engine did not say.
  const [plugins, setPlugins] = useState<Record<string, AgentPlugin> | null | undefined>(undefined)
  const [design, setDesign] = useState<TemplateDesign>({})
  const [sourceId, setSourceId] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const [content, setContent] = useState<CardContent | null>(null)
  const [busy, setBusy] = useState(false)

  // Picking a widget loads that widget's own overrides, so the card on screen is
  // the card that widget renders — not a generic one.
  useEffect(() => {
    if (!widgetId) {
      setSaved(null)
      setPlugins(undefined)
      setDesign({})
      setSourceId('')
      return
    }
    let live = true
    api
      .getWidgetTemplates(widgetId)
      .then((r) => {
        if (!live) return
        setSaved(r.templates)
        setPlugins(r.plugins)
        setDesign(r.templates.designs[tpl.name] ?? {})
        setSourceId(r.templates.sources[tpl.name] ?? '')
      })
      .catch((err) => toast.err(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [widgetId, tpl.name, toast])

  // Re-hydrate on every change, debounced: the server draws the card, not us.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      api
        .previewTemplate(tpl.name, { design, source: sourceId || undefined, lang })
        .then((r) => setContent({ ...(r.content as CardContent), widgetTemplate: tpl.native ? r.template : undefined }))
        .catch(() => undefined)
    }, 140)
    return () => clearTimeout(timer.current)
  }, [tpl.name, design, sourceId, lang])

  const dirty = useMemo(() => {
    if (!saved) return Object.keys(design).length > 0 || !!sourceId
    return (
      JSON.stringify(design) !== JSON.stringify(saved.designs[tpl.name] ?? {}) ||
      sourceId !== (saved.sources[tpl.name] ?? '')
    )
  }, [design, sourceId, saved, tpl.name])

  const enabledHere = !saved || saved.enabled === null || saved.enabled.includes(tpl.name)

  const save = async () => {
    if (!widgetId) return
    setBusy(true)
    try {
      const { templates: current } = await api.getWidgetTemplates(widgetId)
      // A widget that renders everything must not lose the rest when one is added.
      const enabled = current.enabled === null ? null : [...new Set([...current.enabled, tpl.name])]
      const nextSources = { ...current.sources }
      if (sourceId) nextSources[tpl.name] = sourceId
      else delete nextSources[tpl.name]
      const nextDesigns = { ...current.designs, [tpl.name]: design }
      const r = await api.saveWidgetTemplates(widgetId, { enabled, sources: nextSources, designs: nextDesigns })
      setSaved(r.templates)
      setDesign(r.templates.designs[tpl.name] ?? {})
      toast.ok(t('tpl.added', { widget: widgetId }))
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> {t('tpl.back')}
        </button>
        <div className="flex items-center gap-2">
          {dirty && <span className="chip text-[10px] text-alert">{t('tpl.unsaved')}</span>}
          {widgetId && enabledHere && !dirty && (
            <span className="chip text-[10px]"><Check className="size-3" /> {t('tpl.enabledHere')}</span>
          )}
        </div>
      </div>

      <PageHead eyebrow={tpl.widgetType} title={tpl.title} lede={tpl.description} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------ canvas ------------------------------ */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle options={[['light', t('tpl.light')], ['dark', t('tpl.dark')]]} value={isDark ? 'dark' : 'light'} onChange={(v) => setIsDark(v === 'dark')} />
            <Toggle options={[['ar', 'العربية'], ['en', 'English']]} value={lang} onChange={(v) => setLang(v as 'ar' | 'en')} />
          </div>
          <div
            className="flex min-h-[380px] items-center justify-center rounded-2xl p-6 transition-colors"
            style={{ background: isDark ? '#0e1119' : '#f4f5f8' }}
          >
            {content ? (
              <CardPreview type={tpl.widgetType} content={content} isDark={isDark} />
            ) : (
              <Spinner />
            )}
          </div>
          <Disclosure summary={t('tpl.contract')}>
            <div className="space-y-2 pt-2">
              {tpl.emits.length === 0 ? (
                <p className="text-xs text-muted">{t('tpl.noFields')}</p>
              ) : (
                <ul className="space-y-1">
                  {tpl.emits.map((f) => (
                    <li key={f.key} className="text-xs leading-snug">
                      <span className="mono text-ink">{f.key}</span>
                      <span className="text-muted"> · {f.type}</span>
                      {f.required && <span className="text-alert"> · {t('tpl.required')}</span>}
                      <span className="block text-muted">{f.description}</span>
                    </li>
                  ))}
                </ul>
              )}
              <pre className="mono max-h-40 overflow-auto rounded-lg bg-sunken p-2 text-[10px] leading-snug text-ink">
                {JSON.stringify(tpl.snippet, null, 2)}
              </pre>
            </div>
          </Disclosure>
        </section>

        {/* ------------------------------ controls ---------------------------- */}
        <aside className="space-y-5">
          <div className="card space-y-3 p-4">
            <label className="block space-y-1">
              <span className="label">{t('tpl.forWidget')}</span>
              <select className="input" value={widgetId} onChange={(e) => setWidgetId(e.target.value)}>
                <option value="">{t('tpl.defaultsOnly')}</option>
                {widgets.map((w) => (
                  <option key={w.widgetId} value={w.widgetId}>{w.channelName} — {w.widgetId}</option>
                ))}
              </select>
            </label>
            {!tpl.passthrough && (
              <label className="block space-y-1">
                <span className="label">{t('tpl.pickSource')}</span>
                <select className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="">{t('tpl.seedOnly')}</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.status.rows}</option>
                  ))}
                </select>
              </label>
            )}
            {tpl.passthrough && !tpl.plugin && <p className="text-[11px] text-muted">{t('tpl.passthrough')}</p>}
            {tpl.plugin && (
              <div className="callout space-y-1 text-[11px]">
                <p>{t('tpl.pluginFrom', { tool: tpl.plugin.tool })}</p>
                {widgetId && plugins !== undefined && (
                  <p className="font-bold">
                    {plugins === null
                      ? t('tpl.pluginUnknown')
                      : plugins[tpl.plugin.id]?.enabled && plugins[tpl.plugin.id].groups.includes(tpl.plugin.group)
                        ? t('tpl.pluginOn', { group: tpl.plugin.group })
                        : t('tpl.pluginOff', { plugin: tpl.plugin.id, group: tpl.plugin.group })}
                  </p>
                )}
              </div>
            )}
            {can('editor') && (
              <>
                <button className="btn btn-sm w-full" disabled={busy || !widgetId} onClick={save}>
                  {busy && <Spinner className="size-3.5" />} {t('tpl.saveToWidget')}
                </button>
                {!widgetId && <p className="text-[11px] text-muted">{t('tpl.pickWidgetFirst')}</p>}
              </>
            )}
          </div>

          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <SectionHead>{t('tpl.design')}</SectionHead>
              {Object.keys(design).length > 0 && (
                <button className="btn-ghost btn-sm" onClick={() => setDesign({})}>{t('tpl.reset')}</button>
              )}
            </div>
            <DesignControls
              fields={fields}
              keys={tpl.design}
              value={design}
              defaults={tpl.designDefaults}
              onChange={setDesign}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

export function Toggle({ options, value, onChange }: { options: Array<[string, string]>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-sunken p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1 text-[12px] transition-colors ${
            value === v ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="card p-3">
      <summary className="cursor-pointer text-xs font-bold text-ink">{summary}</summary>
      {children}
    </details>
  )
}

/* ------------------------------- data sources ------------------------------- */

function SourcesPanel({ sources, canEdit, canDelete, onChanged }: {
  sources: DataSource[]
  canEdit: boolean
  canDelete: boolean
  onChanged: () => Promise<void>
}) {
  const { t } = useI18n()
  const fmt = useFormatDate()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id)
    try {
      await fn()
      toast.ok(ok)
      await onChanged()
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className="btn-ghost btn-sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> {t('tpl.newSource')}
          </button>
        </div>
      )}

      {sources.length === 0 ? (
        <Empty title={t('tpl.noSources')} hint={t('tpl.noSourcesHint')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <article key={s.id} className="card space-y-2 p-4">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink">{s.name}</h3>
                  <p className="mono text-[11px] text-muted">{s.id}</p>
                </div>
                <span className="chip shrink-0 text-[10px]">{s.kind}</span>
              </header>
              <dl className="space-y-0.5 text-[11px] text-muted">
                <div className="flex justify-between gap-2">
                  <dt>{t('tpl.rows', { count: s.status.rows })}</dt>
                  <dd>{s.status.fetchedAt ? fmt(s.status.fetchedAt) : t('tpl.neverFetched')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{t('tpl.ttl')}</dt>
                  <dd>{s.ttlMs === 0 ? t('tpl.ttlNever') : humanMs(s.ttlMs)}</dd>
                </div>
              </dl>
              {/* A failed refresh keeps the last good copy, so this is the only
                  place a stale feed becomes visible. */}
              {s.status.lastError && <p className="text-[11px] leading-snug text-alert">{s.status.lastError}</p>}
              <div className="flex gap-2 pt-1">
                {canEdit && s.kind !== 'inline' && (
                  <button
                    className="btn-ghost btn-sm"
                    disabled={busy === s.id}
                    onClick={() => act(s.id, () => api.refreshDataSource(s.id), t('tpl.refreshed'))}
                  >
                    {busy === s.id ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />} {t('tpl.refresh')}
                  </button>
                )}
                {canDelete && (
                  <button
                    className="btn-ghost btn-sm text-alert"
                    disabled={busy === s.id}
                    onClick={() => {
                      if (!confirm(t('tpl.confirmDelete', { name: s.name }))) return
                      void act(s.id, () => api.deleteDataSource(s.id), t('tpl.deleted'))
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <NewSource
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false)
            await onChanged()
          }}
        />
      )}
    </section>
  )
}

function NewSource({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const { t } = useI18n()
  const toast = useToast()
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SourceKind>('airtable')
  const [ttlMs, setTtlMs] = useState(15 * 60_000)
  const [url, setUrl] = useState('')
  const [path, setPath] = useState('')
  const [base, setBase] = useState('')
  const [table, setTable] = useState('')
  const [token, setToken] = useState('')
  const [rows, setRows] = useState('[\n  {}\n]')
  const [busy, setBusy] = useState(false)

  const rowsError = useMemo(() => {
    if (kind !== 'inline') return null
    try {
      return Array.isArray(JSON.parse(rows)) ? null : 'Rows must be a JSON array.'
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }, [kind, rows])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (rowsError) return
    setBusy(true)
    try {
      const config =
        kind === 'airtable' ? { base, table, ...(token ? { token } : {}) }
        : kind === 'http' ? { url, ...(path ? { path } : {}) }
        : { items: JSON.parse(rows) as Array<Record<string, unknown>> }
      await api.createDataSource({ id, name, kind, ttlMs, config })
      toast.ok(t('tpl.created'))
      await onDone()
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('tpl.newSource')} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="label">{t('tpl.sourceId')}</span>
            <input className="input mono" value={id} onChange={(e) => setId(e.target.value)} placeholder="cinema-menu" required />
          </label>
          <label className="block space-y-1">
            <span className="label">{t('tpl.sourceName')}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <span className="label">{t('tpl.sourceKind')}</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
              <option value="airtable">Airtable</option>
              <option value="http">HTTP JSON</option>
              <option value="inline">Inline rows</option>
            </select>
          </label>
          {kind !== 'inline' && (
            <label className="block space-y-1">
              <span className="label">{t('tpl.ttl')}</span>
              <select className="input" value={ttlMs} onChange={(e) => setTtlMs(Number(e.target.value))}>
                {TTL_CHOICES.map((ms) => (
                  <option key={ms} value={ms}>{ms === 0 ? t('tpl.ttlNever') : humanMs(ms)}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {kind === 'airtable' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="label">Base</span>
              <input className="input mono" value={base} onChange={(e) => setBase(e.target.value)} placeholder="app…" required />
            </label>
            <label className="block space-y-1">
              <span className="label">Table</span>
              <input className="input mono" value={table} onChange={(e) => setTable(e.target.value)} placeholder="tbl…" required />
            </label>
            <label className="block space-y-1">
              {/* Optional: the server's own token is used when this is left blank. */}
              <span className="label">Token</span>
              <input className="input mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="pat…" />
            </label>
          </div>
        )}
        {kind === 'http' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="label">URL</span>
              <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
            </label>
            <label className="block space-y-1">
              <span className="label">Array path</span>
              <input className="input mono" value={path} onChange={(e) => setPath(e.target.value)} placeholder="data.items" />
            </label>
          </div>
        )}
        {kind === 'inline' && (
          <label className="block space-y-1">
            <span className="label">{t('tpl.inlineRows')}</span>
            <textarea className="input mono h-40" value={rows} onChange={(e) => setRows(e.target.value)} />
            {rowsError && <span className="text-[11px] text-alert">{rowsError}</span>}
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-sm" disabled={busy || !!rowsError}>
            {busy && <Spinner className="size-3.5" />} {t('common.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
