import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { Empty, Loading } from '@/components/ui'
import { api, type ConfigVersion, type WidgetConfig } from '@/lib/api'
import { useFormatDate, useI18n } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

/**
 * The designs this widget used to have, and the way back to one.
 *
 * A save used to overwrite the only copy, so an accidental import from Pair —
 * or any wrong save — was unrecoverable. Every change now snapshots the design
 * it replaces, and a restore snapshots too, so stepping back is itself
 * reversible.
 *
 * Export and import live here rather than on their own screen because they are
 * the same idea: a design you can take away, and one you can bring back.
 */
export function VersionsPanel({
  widgetId,
  editor,
  onRestored,
}: {
  widgetId: string
  editor: boolean
  onRestored: (config: WidgetConfig) => void
}) {
  const { t } = useI18n()
  const fmt = useFormatDate()
  const toast = useToast()
  const [versions, setVersions] = useState<ConfigVersion[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setVersions((await api.getVersions(widgetId)).versions)
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
      setVersions([])
    }
  }, [widgetId, toast])

  useEffect(() => {
    void load()
  }, [load])

  /** Hands the browser a file without a second authenticated round trip. */
  const download = (config: WidgetConfig, name: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCurrent = async () => {
    setBusy('export')
    try {
      const r = await api.getWidget(widgetId)
      if (!r.storedConfig) throw new Error(t('ver.noDesign'))
      download(r.storedConfig, `${widgetId}-design.json`)
      toast.ok(t('ver.exported'))
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const exportVersion = async (v: ConfigVersion) => {
    setBusy(v.id)
    try {
      download((await api.getVersion(widgetId, v.id)).config, `${widgetId}-${v.at.slice(0, 19)}.json`)
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const restore = async (v: ConfigVersion) => {
    // Restoring replaces what is on screen, so it is worth one deliberate step.
    if (!window.confirm(t('ver.confirm', { when: fmt(v.at) }))) return
    setBusy(v.id)
    try {
      const r = await api.restoreVersion(widgetId, v.id)
      onRestored(r.config)
      toast.ok(t('ver.restored'))
      await load()
    } catch (err) {
      toast.err(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const importFile = async (file: File) => {
    setBusy('import')
    try {
      const parsed = JSON.parse(await file.text()) as WidgetConfig
      if (!parsed || typeof parsed !== 'object') throw new Error(t('ver.badFile'))
      // Saved, not swapped in behind the scenes: the design it replaces is
      // snapshotted like any other change, so this is undoable.
      await api.saveConfig(widgetId, parsed)
      onRestored(parsed)
      toast.ok(t('ver.imported'))
      await load()
    } catch (err) {
      toast.err(err instanceof Error ? err.message : t('ver.badFile'))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!versions) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost btn-sm" onClick={exportCurrent} disabled={!!busy}>
          <Download className="size-3.5" />
          {t('ver.export')}
        </button>
        {editor && (
          <>
            <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <Upload className="size-3.5" />
              {t('ver.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importFile(f)
              }}
            />
          </>
        )}
        <p className="fine ms-auto">{t('ver.kept')}</p>
      </div>

      {versions.length === 0 ? (
        <Empty title={t('ver.empty')} hint={t('ver.emptyHint')} />
      ) : (
        <ul className="divide-y divide-divider text-[13px]">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{t(`ver.label.${v.label.replace(/\s+/g, '_')}` as never, {}) || v.label}</p>
                <p className="fine">
                  {t('ver.replacedAt', { when: fmt(v.at), who: v.by })}
                  {' · '}
                  {t('common.chars', { count: v.bytes.toLocaleString('en-US') })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => exportVersion(v)}
                  disabled={!!busy}
                  title={t('ver.download')}
                  aria-label={t('ver.download')}
                >
                  <Download className="size-3.5" />
                </button>
                {editor && (
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => restore(v)}
                    disabled={!!busy}
                    title={t('ver.restore')}
                    aria-label={t('ver.restore')}
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
