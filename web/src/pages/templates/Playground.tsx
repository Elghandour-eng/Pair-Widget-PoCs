import { ArrowLeft, ExternalLink, Play, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHead, Spinner } from '@/components/ui'
import { api, type TemplateDef } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Toggle } from '@/pages/Templates'
import { PLAYGROUND_SAMPLES } from './playgroundSamples'

/**
 * A card pasted as JSON, drawn by the templates render SDK — the library the
 * Pair inbox installs — so what shows here is what the inbox will show.
 *
 * The SDK is the same build this server publishes at /sdk/render-sdk, loaded
 * once as a script; it draws into a shadow root, so the studio's styles and the
 * card's never meet.
 */

const SDK_URL = '/sdk/render-sdk/pair-templates.umd.js'
const INSTALL = 'npm i github:Pair-AI-Platform/templates-render-sdk#sdk'
const REPO = 'https://github.com/Pair-AI-Platform/templates-render-sdk/tree/sdk'

type Card = Record<string, unknown>
interface RenderOptions {
  lang?: 'ar' | 'en'
  theme?: 'light' | 'dark'
  padding?: number
  resolveUrl?: string
  onHeight?: (h: number) => void
  onError?: (e: Error) => void
}
interface Handle { update(card: Card, opts?: RenderOptions): Promise<void>; destroy(): void }
interface Sdk {
  VERSION: string
  LOCAL_TEMPLATES: string[]
  render(target: HTMLElement, card: Card, opts?: RenderOptions): Handle
  resolveCard(card: Card, opts?: RenderOptions): Promise<unknown>
  /** 0.2+: a whole reply — pieces in order and the options under it */
  renderMessage?(target: HTMLElement, message: unknown, opts?: RenderOptions): Handle
  resolveMessage?(message: unknown, opts?: RenderOptions): Promise<unknown>
}

/** A reply rather than one card: Danah's parts event data, the widget's message with parts, or the pieces array. */
const isMessage = (v: unknown): boolean => Array.isArray(v) || (!!v && typeof v === 'object' && Array.isArray((v as { parts?: unknown }).parts))

let loading: Promise<Sdk> | null = null
function loadSdk(): Promise<Sdk> {
  const w = window as unknown as { PairTemplates?: Sdk }
  if (w.PairTemplates) return Promise.resolve(w.PairTemplates)
  loading ??= new Promise<Sdk>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_URL
    s.onload = () => (w.PairTemplates ? resolve(w.PairTemplates) : reject(new Error('no PairTemplates')))
    s.onerror = () => { loading = null; s.remove(); reject(new Error('load failed')) }
    document.head.appendChild(s)
  })
  return loading
}

/** A card needs the studio only when it names a template the SDK does not carry. */
function isLocal(sdk: Sdk, card: Card): boolean {
  const name = typeof card.template === 'string' ? card.template : null
  return !name || sdk.LOCAL_TEMPLATES.includes(name) || 'content' in card
}

interface Example { key: string; label: string; sub: string; card: Card }

/** Sample images are paths under the widget's /sdk; made absolute so a copied card draws anywhere. */
function absolute<T>(v: T): T {
  if (typeof v === 'string') return (v.startsWith('samples/') ? `${location.origin}/sdk/${v}` : v) as T
  if (Array.isArray(v)) return v.map(absolute) as T
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, absolute(x)])) as T
  return v
}

type Status = { kind: 'ok'; ms: number; local: boolean; height: number } | { kind: 'error'; text: string } | null

export function TemplatesPlayground() {
  const { t } = useI18n()
  const [sdk, setSdk] = useState<Sdk | null>(null)
  const [sdkFailed, setSdkFailed] = useState(false)
  const [templates, setTemplates] = useState<TemplateDef[]>([])
  const [picked, setPicked] = useState('s:0')
  const [q, setQ] = useState('')
  const [json, setJson] = useState(() => JSON.stringify(PLAYGROUND_SAMPLES[0].card, null, 2))
  const [lang, setLang] = useState<'' | 'ar' | 'en'>('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [status, setStatus] = useState<Status>(null)
  const [resolved, setResolved] = useState<string | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<Handle | null>(null)
  const drawnAs = useRef<'card' | 'message' | null>(null)

  useEffect(() => {
    loadSdk().then(setSdk, () => setSdkFailed(true))
    // The studio's own templates, each as the card an agent would send for it.
    api.listTemplates().then((r) => setTemplates(r.templates), () => undefined)
    return () => { handle.current?.destroy(); handle.current = null }
  }, [])

  const parse = (text: string): Card | null => {
    try {
      const v = JSON.parse(text) as unknown
      if (Array.isArray(v)) return { parts: v } as Card
      if (v && typeof v === 'object') return v as Card
      setStatus({ kind: 'error', text: t('pg.invalid', { msg: 'expected an object' }) })
    } catch (err) {
      setStatus({ kind: 'error', text: t('pg.invalid', { msg: err instanceof Error ? err.message : String(err) }) })
    }
    return null
  }

  const draw = useCallback((text: string) => {
    if (!sdk || !host.current) return
    const card = parse(text)
    if (!card) return
    setResolved(null)
    const t0 = performance.now()
    let measured = false
    const opts: RenderOptions = {
      lang: lang || undefined,
      theme,
      padding: 12,
      resolveUrl: location.origin,
      onHeight: (height) => {
        if (measured || !height) return
        measured = true
        setStatus({ kind: 'ok', ms: Math.round(performance.now() - t0), local: message ? true : isLocal(sdk, card), height })
      },
      onError: (e) => setStatus({ kind: 'error', text: e.message }),
    }
    // a card and a whole reply draw through different calls: switching between them starts afresh
    const message = isMessage(card) && !!sdk.renderMessage
    if (handle.current && drawnAs.current === (message ? 'message' : 'card')) {
      handle.current.update(card, opts).catch(() => undefined)
    } else {
      handle.current?.destroy()
      handle.current = message ? sdk.renderMessage!(host.current, card, opts) : sdk.render(host.current, card, opts)
      drawnAs.current = message ? 'message' : 'card'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, lang, theme])

  // Language and theme redraw the card on the spot; the JSON waits for Render.
  useEffect(() => { draw(json) }, [draw]) // eslint-disable-line react-hooks/exhaustive-deps

  const examples = useMemo<Example[]>(() => [
    ...PLAYGROUND_SAMPLES.map((x, i) => ({ key: `s:${i}`, label: x.label, sub: t('pg.sample'), card: absolute(x.card) })),
    ...templates.map((x) => ({ key: `t:${x.name}`, label: x.title, sub: x.name, card: absolute(x.snippet) })),
  ], [templates, t])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? examples.filter((x) => `${x.label} ${x.sub}`.toLowerCase().includes(needle)) : examples
  }, [examples, q])

  const pick = (x: Example) => {
    setPicked(x.key)
    const text = JSON.stringify(x.card, null, 2)
    setJson(text)
    draw(text)
  }

  const showResolved = () => {
    const card = sdk && parse(json)
    if (!card) return
    const resolve = isMessage(card) && sdk.resolveMessage ? sdk.resolveMessage(card, { lang: lang || undefined, resolveUrl: location.origin }) : sdk.resolveCard(card, { lang: lang || undefined, resolveUrl: location.origin })
    resolve
      .then((r) => setResolved(JSON.stringify(r, null, 2)))
      .catch((e: Error) => setStatus({ kind: 'error', text: e.message }))
  }

  return (
    <div className="space-y-5">
      <Link to="/templates" className="btn-ghost btn-sm w-fit">
        <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t('tpl.back')}
      </Link>

      <PageHead
        eyebrow={t('pg.eyebrow')}
        title={t('pg.title')}
        lede={t('pg.lede')}
        action={
          <div className="flex items-center gap-2">
            {sdk && <span className="chip mono text-[11px]">v{sdk.VERSION}</span>}
            <a href={REPO} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
              <ExternalLink className="size-3.5" /> GitHub
            </a>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ------------------------------- input ------------------------------- */}
        <section className="card space-y-4 p-4">
          <div className="space-y-1.5">
            <span className="label">{t('pg.example')}</span>
            <label className="relative block">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input
                className="input ps-9"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('pg.search', { count: examples.length })}
                aria-label={t('pg.search', { count: examples.length })}
              />
            </label>
            <ul className="max-h-52 overflow-y-auto rounded-xl border border-line p-1" role="listbox" aria-label={t('pg.example')}>
              {shown.length === 0 && <li className="px-3 py-2 text-xs text-muted">{t('tpl.noMatch')}</li>}
              {shown.map((x) => (
                <li key={x.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={picked === x.key}
                    onClick={() => pick(x)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-start text-[12.5px] transition-colors ${
                      picked === x.key ? 'bg-accent-50 font-bold text-accent-deep' : 'text-ink hover:bg-sunken'
                    }`}
                  >
                    <span className="truncate">{x.label}</span>
                    <span className="mono shrink-0 text-[10.5px] text-muted">{x.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <label className="block space-y-1">
            <span className="label">{t('pg.json')}</span>
            <textarea
              className="input mono h-[420px] resize-y text-[12px] leading-snug"
              dir="ltr"
              spellCheck={false}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') draw(json) }}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-sm" onClick={() => draw(json)} disabled={!sdk}>
              <Play className="size-3.5" /> {t('pg.render')}
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => { const c = parse(json); if (c) setJson(JSON.stringify(c, null, 2)) }}
            >
              {t('pg.format')}
            </button>
            <button className="btn-ghost btn-sm" onClick={showResolved} disabled={!sdk}>{t('pg.resolved')}</button>
            <span className="text-[11px] text-faint">Ctrl/⌘ + Enter</span>
          </div>

          {resolved && (
            <pre className="mono max-h-64 overflow-auto rounded-lg bg-sunken p-2 text-[10.5px] leading-snug text-ink" dir="ltr">
              {resolved}
            </pre>
          )}
        </section>

        {/* ------------------------------ preview ------------------------------ */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Toggle
                options={[['light', t('tpl.light')], ['dark', t('tpl.dark')]]}
                value={theme}
                onChange={(v) => setTheme(v as 'light' | 'dark')}
              />
              <Toggle
                options={[['', t('pg.fromCard')], ['ar', 'العربية'], ['en', 'English']]}
                value={lang}
                onChange={(v) => setLang(v as '' | 'ar' | 'en')}
              />
            </div>
            <StatusChips status={status} />
          </div>

          <div
            className="flex min-h-[420px] items-start justify-center rounded-2xl p-6 transition-colors"
            style={{ background: theme === 'dark' ? '#0e1119' : '#f4f5f8' }}
          >
            {sdkFailed ? (
              <p className="self-center text-xs text-alert">{t('pg.loadFailed', { url: SDK_URL })}</p>
            ) : (
              <div className="w-full max-w-[400px]">
                {!sdk && <div className="flex justify-center py-16"><Spinner /></div>}
                <div ref={host} className="overflow-hidden rounded-xl shadow-sm" />
              </div>
            )}
          </div>

          <div className="card space-y-1.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label">{t('pg.install')}</span>
              <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline">
                Pair-AI-Platform/templates-render-sdk <ExternalLink className="size-3" />
              </a>
            </div>
            <pre className="mono overflow-auto rounded-lg bg-sunken p-2 text-[11px] text-ink" dir="ltr">{INSTALL}</pre>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatusChips({ status }: { status: Status }) {
  const { t } = useI18n()
  if (!status) return null
  if (status.kind === 'error') return <span className="chip max-w-full truncate text-[11px] text-alert">{status.text}</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="chip text-[11px]">{t('pg.drawn', { ms: status.ms })}</span>
      <span className={`chip text-[11px] ${status.local ? 'text-accent-deep' : ''}`}>
        {status.local ? t('pg.local') : t('pg.remote')}
      </span>
      <span className="chip text-[11px]">{t('pg.height', { px: status.height })}</span>
    </div>
  )
}
