import { Check, Codepen, Copy, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Select } from './Select'
import { SectionHead } from './ui'
import { embedPreviewUrl, embedSnippet, type EmbedSettings, type PanelSize, type Widget } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

const POSITIONS = ['right', 'left'] as const
const TYPES = ['standard', 'expanded_bubble', 'chat_icon', 'icon_only'] as const

/**
 * Everything needed to put this widget on a real site: the snippet, a live host page,
 * and a one-click CodePen with the snippet already in it.
 */
export function EmbedPanel({ widget, sdkBaseUrl, panel }: { widget: Widget; sdkBaseUrl: string; panel?: PanelSize }) {
  const { t } = useI18n()
  const toast = useToast()
  const [settings, setSettings] = useState<EmbedSettings>({ position: 'right', type: 'standard', launcherTitle: 'Chat with us!' })
  // The saved panel size rides along, so a pasted snippet builds the panel at
  // the size the channel was designed at rather than the SDK's old default.
  const withPanel = useMemo<EmbedSettings>(() => ({ ...settings, panel }), [settings, panel])
  const [copied, setCopied] = useState(false)

  const snippet = useMemo(() => embedSnippet(widget.widgetId, sdkBaseUrl, withPanel), [widget.widgetId, sdkBaseUrl, withPanel])
  const previewUrl = embedPreviewUrl(widget.widgetId, settings)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      toast.ok(t('embed.copied'))
      setTimeout(() => setCopied(false), 1600)
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  /** CodePen's prefill API takes a form POST with the pen described as JSON. */
  const openCodePen = () => {
    const data = {
      title: `${widget.channelName} — Pair widget`,
      description: `Pair widget ${widget.widgetId}`,
      html: `<!-- ${widget.channelName} -->\n<h1 style="font-family:system-ui;padding:3rem">Pair widget demo</h1>\n\n${snippet}`,
      editors: '1000',
      layout: 'left',
    }
    const form = document.createElement('form')
    form.action = 'https://codepen.io/pen/define'
    form.method = 'POST'
    form.target = '_blank'
    form.rel = 'noreferrer'
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'data'
    input.value = JSON.stringify(data)
    form.appendChild(input)
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('embed.settings')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="label">{t('embed.position')}</span>
            <Select
              label={t('embed.position')}
              value={settings.position}
              options={POSITIONS.map((p) => ({ value: p, label: t(`embed.position.${p}` as never) }))}
              onChange={(v) => setSettings((s) => ({ ...s, position: v as EmbedSettings['position'] }))}
            />
          </div>
          <div>
            <span className="label">{t('embed.type')}</span>
            <Select
              label={t('embed.type')}
              value={settings.type}
              options={TYPES.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))}
              onChange={(v) => setSettings((s) => ({ ...s, type: v }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="launcher-title">{t('embed.launcherTitle')}</label>
            <input
              id="launcher-title"
              className="input"
              value={settings.launcherTitle}
              maxLength={120}
              onChange={(e) => setSettings((s) => ({ ...s, launcherTitle: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHead
          aside={
            <button className="btn-quiet btn-sm -my-1 normal-case" onClick={copy}>
              {copied ? <Check className="size-3.5 text-accent-deep" /> : <Copy className="size-3.5" />}
              {t('embed.copy')}
            </button>
          }
        >
          {t('embed.snippet')}
        </SectionHead>
        <pre className="code-block scroll-pane max-h-[26rem] overflow-auto p-3.5 text-body" dir="ltr">
          <code>{snippet}</code>
        </pre>
        <p className="callout mt-3.5">{t('embed.snippetNote')}</p>
      </section>

      <section>
        <SectionHead>{t('embed.try')}</SectionHead>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <a href={previewUrl} target="_blank" rel="noreferrer" className="card lift group flex items-start gap-3 p-4">
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-ink">{t('embed.livePage')}</span>
              <span className="mt-1 block text-[11.5px] leading-[1.55] text-muted">{t('embed.livePageNote')}</span>
            </span>
          </a>
          <button onClick={openCodePen} className="card lift group flex items-start gap-3 p-4 text-start">
            <Codepen className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-ink">{t('embed.codepen')}</span>
              <span className="mt-1 block text-[11.5px] leading-[1.55] text-muted">{t('embed.codepenNote')}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  )
}
