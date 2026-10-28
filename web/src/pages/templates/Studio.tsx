import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Code2, ImagePlus, Loader2, MessageSquareText, Save, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { api, type StudioInput, type StudioSpec } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Empty, PageHead, SectionHead, Spinner } from '@/components/ui'

/**
 * The template studio.
 *
 * Adding a card used to mean an entry in the server's registry and a renderer
 * in the SDK — two repositories and a deploy. This page is the other way in:
 * drop the design in as a picture, paste the markup a designer sent, or say
 * what the card should show, and what comes back is a template the agent can
 * emit by name.
 *
 * The model is asked once per press, never per keystroke: generating costs a
 * call and editing does not, so everything after the first answer — the name,
 * the fields, the markup itself — is edited here for free, with the preview
 * rendered by the engine's own hydrator so it is the card and not a likeness.
 */

type Mode = 'image' | 'html' | 'describe'

const BLANK: StudioSpec = {
  name: '',
  title: '',
  description: '',
  category: 'commerce',
  fields: [],
  html: '',
  sample: {},
}

export function TemplateStudio() {
  const { t } = useI18n()
  const navigate = useNavigate()
  /** Set when the page was opened on an existing studio template. */
  const { name: editing } = useParams<{ name: string }>()

  const [ready, setReady] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode>('image')
  const [image, setImage] = useState<{ mediaType: StudioInput['image'] extends infer I ? I extends { mediaType: infer M } ? M : never : never; data: string } | null>(null)
  const [html, setHtml] = useState('')
  const [prompt, setPrompt] = useState('')
  const [spec, setSpec] = useState<StudioSpec | null>(null)
  const [busy, setBusy] = useState<'generate' | 'save' | 'load' | null>(editing ? 'load' : null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.studioStatus().then(({ ready }) => setReady(ready)).catch(() => setReady(false))
  }, [])

  useEffect(() => {
    if (!editing) return
    api
      .getCustomTemplate(editing)
      .then(({ template }) => setSpec(template))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(null))
  }, [editing])

  const generate = useCallback(
    async (refine?: string) => {
      setBusy('generate')
      setError('')
      try {
        const body: StudioInput = { prompt: refine || prompt || undefined }
        if (!refine) {
          if (mode === 'image' && image) body.image = image
          if (mode === 'html' && html.trim()) body.html = html
        }
        if (refine && spec) body.previous = { html: spec.html, fields: spec.fields }
        const { template } = await api.generateTemplate(body)
        // A refine keeps the name the operator already settled on.
        setSpec((prev) => (refine && prev ? { ...template, name: prev.name } : template))
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(null)
      }
    },
    [mode, image, html, prompt, spec],
  )

  const save = useCallback(async () => {
    if (!spec) return
    setBusy('save')
    setError('')
    try {
      // The name is the agent's handle on the template and never changes after it is saved.
      const { name: _keep, ...patch } = spec
      if (editing) await api.updateCustomTemplate(editing, patch)
      else await api.createCustomTemplate(spec)
      navigate('/templates')
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }, [spec, editing, navigate])

  const remove = useCallback(async () => {
    if (!editing) return
    await api.deleteCustomTemplate(editing).catch((e: Error) => setError(e.message))
    navigate('/templates')
  }, [editing, navigate])

  const canGenerate =
    !busy && ((mode === 'image' && !!image) || (mode === 'html' && html.trim().length > 0) || (mode === 'describe' && prompt.trim().length > 0))

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow={t('studio.eyebrow')}
        title={editing ? t('studio.editTitle', { name: editing }) : t('studio.title')}
        lede={t('studio.lede')}
        action={
          <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/templates')}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('studio.back')}
          </button>
        }
      />

      {ready === false && (
        <p className="card border-alert/30 bg-alert-soft p-3 text-[12.5px] font-bold text-alert">{t('studio.noKey')}</p>
      )}
      {error && <p className="card border-alert/30 bg-alert-soft p-3 text-[12.5px] font-bold text-alert">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-5">
          {!editing && (
            <section className="card p-4">
              <SectionHead>{t('studio.source')}</SectionHead>
              <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t('studio.source')}>
                {(['image', 'html', 'describe'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                      mode === m ? 'border-accent bg-accent-50 text-accent-deep' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {m === 'image' && <ImagePlus className="size-3.5" />}
                    {m === 'html' && <Code2 className="size-3.5" />}
                    {m === 'describe' && <MessageSquareText className="size-3.5" />}
                    {t(`studio.mode.${m}` as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>

              {mode === 'image' && <ImageDrop image={image} onImage={setImage} />}
              {mode === 'html' && (
                <textarea
                  className="input h-56 font-mono text-[12px]"
                  dir="ltr"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder={t('studio.htmlPlaceholder')}
                />
              )}
              {mode === 'describe' && (
                <textarea
                  className="input h-32"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t('studio.describePlaceholder')}
                />
              )}

              {mode !== 'describe' && (
                <label className="mt-3 block">
                  <span className="label">{t('studio.note')}</span>
                  <input
                    className="input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('studio.notePlaceholder')}
                  />
                </label>
              )}

              <button type="button" className="btn-primary mt-3 w-full" disabled={!canGenerate} onClick={() => generate()}>
                {busy === 'generate' ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                {busy === 'generate' ? t('studio.generating') : t('studio.generate')}
              </button>
            </section>
          )}

          {spec && <SpecEditor spec={spec} onChange={setSpec} onRefine={generate} busy={busy === 'generate'} />}
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <SectionHead>{t('studio.preview')}</SectionHead>
          {busy === 'generate' && !spec ? (
            <div className="card grid h-64 place-items-center">
              <p className="fine flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t('studio.generating')}
              </p>
            </div>
          ) : spec ? (
            <CardPreview spec={spec} />
          ) : (
            <div className="card p-6">
              <Empty title={t('studio.previewEmpty')} hint={t('studio.previewHint')} />
            </div>
          )}

          {spec && (
            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1" disabled={!!busy} onClick={save}>
                {busy === 'save' ? <Spinner className="size-4" /> : <Save className="size-4" />}
                {editing ? t('studio.update') : t('studio.save')}
              </button>
              {editing && (
                <button type="button" className="btn-danger" onClick={remove} aria-label={t('common.delete')}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- the design -------------------------------- */

/**
 * Takes a design as a picture: dropped, pasted from the clipboard, or picked.
 * It is downscaled here rather than on the server — a phone screenshot is
 * several megabytes, the model reads it no better at that size, and the
 * upload is the slowest part of the whole flow.
 */
function ImageDrop({
  image,
  onImage,
}: {
  image: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } | null
  onImage: (i: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } | null) => void
}) {
  const { t } = useI18n()
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const take = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !file.type.startsWith('image/')) return
      onImage(await downscale(file))
    },
    [onImage],
  )

  // Paste works anywhere on the page while this tab is open: for a screenshot,
  // ⌘V is the whole interaction.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (file) void take(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [take])

  if (image) {
    return (
      <div className="relative">
        <img
          src={`data:${image.mediaType};base64,${image.data}`}
          alt=""
          className="max-h-72 w-full rounded-xl border border-line object-contain"
        />
        <button
          type="button"
          className="btn-ghost btn-sm absolute end-2 top-2"
          onClick={() => onImage(null)}
          aria-label={t('common.close')}
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void take(e.dataTransfer.files[0])
      }}
      className={`flex h-56 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
        over ? 'border-accent bg-accent-50' : 'border-line hover:border-accent-300'
      }`}
    >
      <ImagePlus className="size-7 text-faint" />
      <span className="text-[13px] font-bold text-ink">{t('studio.dropTitle')}</span>
      <span className="fine">{t('studio.dropHint')}</span>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void take(e.target.files?.[0])}
      />
    </button>
  )
}

const MAX_EDGE = 1400

/** Longest edge to 1400px, JPEG, which keeps a screenshot well inside the server's limit. */
async function downscale(file: File): Promise<{ mediaType: 'image/jpeg'; data: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { mediaType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
}

/* ------------------------------- the template ------------------------------ */

const CATEGORIES = ['commerce', 'health', 'ticketing', 'cinema', 'media'] as const

/** Everything the model proposed, open for editing: this is a draft, not an answer. */
function SpecEditor({
  spec,
  onChange,
  onRefine,
  busy,
}: {
  spec: StudioSpec
  onChange: (s: StudioSpec) => void
  onRefine: (prompt: string) => void
  busy: boolean
}) {
  const { t } = useI18n()
  const [refine, setRefine] = useState('')
  const set = (patch: Partial<StudioSpec>) => onChange({ ...spec, ...patch })

  return (
    <>
      <section className="card space-y-3 p-4">
        <SectionHead>{t('studio.template')}</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t('studio.name')}</span>
            <input
              className="input font-mono text-[12.5px]"
              dir="ltr"
              value={spec.name}
              onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
            />
          </label>
          <label className="block">
            <span className="label">{t('studio.titleField')}</span>
            <input className="input" value={spec.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="label">{t('studio.description')}</span>
          <input className="input" value={spec.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">{t('studio.category')}</span>
          <select className="input" value={spec.category} onChange={(e) => set({ category: e.target.value as StudioSpec['category'] })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`tpl.cat.${c}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card p-4">
        <SectionHead aside={<span className="fine">{t('studio.fieldsCount', { count: spec.fields.length })}</span>}>
          {t('studio.fields')}
        </SectionHead>
        {spec.fields.length === 0 ? (
          <p className="fine">{t('studio.noFields')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {spec.fields.map((f) => (
              <li key={f.key} className="flex flex-wrap items-baseline gap-2 py-2">
                <code className="font-mono text-[12.5px] font-bold text-accent-deep">{f.key}</code>
                <span className="chip text-[10px]">{f.type}</span>
                {f.required && <span className="chip text-[10px]">{t('studio.required')}</span>}
                <span className="fine min-w-0 flex-1">{f.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <SectionHead>{t('studio.html')}</SectionHead>
        <textarea
          className="input h-64 font-mono text-[11.5px]"
          dir="ltr"
          value={spec.html}
          onChange={(e) => set({ html: e.target.value })}
          spellCheck={false}
        />
        <p className="fine mt-2">{t('studio.htmlHint')}</p>
      </section>

      <section className="card p-4">
        <SectionHead>{t('studio.refine')}</SectionHead>
        <div className="flex gap-2">
          <input
            className="input"
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            placeholder={t('studio.refinePlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && refine.trim() && !busy) onRefine(refine)
            }}
          />
          <button type="button" className="btn-ghost" disabled={busy || !refine.trim()} onClick={() => onRefine(refine)}>
            {busy ? <Spinner className="size-4" /> : <Wand2 className="size-4" />}
          </button>
        </div>
      </section>
    </>
  )
}

/* -------------------------------- the card --------------------------------- */

/**
 * The card as a widget would draw it: the body is filled in by the server's own
 * renderer, and shown in a frame that cannot run script — the same two rules the
 * SDK's renderer follows, so nothing here can flatter the result.
 */
function CardPreview({ spec }: { spec: StudioSpec }) {
  const { t } = useI18n()
  const [filled, setFilled] = useState('')
  const [failed, setFailed] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    // Debounced: the editor types into this, and each pass is a request.
    const id = setTimeout(() => {
      api
        .previewStudioHtml({ html: spec.html, sample: spec.sample })
        .then(({ html }) => {
          setFilled(html)
          setFailed('')
        })
        .catch((e: Error) => setFailed(e.message))
    }, 350)
    return () => clearTimeout(id)
  }, [spec.html, spec.sample])

  const doc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><style>
        :root { --accent:#1F6FB8; --surface:#ffffff; --border:#e6e8eb; --radius:16px; --padding:14px; --title-size:15px; }
        html,body { margin:0; padding:0; background:transparent }
        body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:#1b2430 }
        img { max-width:100% }
      </style></head><body>${filled}</body></html>`,
    [filled],
  )

  const measure = () => {
    const body = frame.current?.contentDocument?.body
    if (body) setHeight(Math.ceil(body.scrollHeight))
  }

  if (failed) return <p className="card border-alert/30 bg-alert-soft p-3 text-[12.5px] font-bold text-alert">{failed}</p>
  if (!filled) return <div className="card grid h-40 place-items-center"><Spinner /></div>

  return (
    <div className="card overflow-hidden p-3">
      <iframe
        ref={frame}
        title={t('studio.preview')}
        srcDoc={doc}
        onLoad={measure}
        sandbox="allow-same-origin"
        style={{ display: 'block', width: '100%', height: height || 160, border: 'none' }}
      />
    </div>
  )
}
