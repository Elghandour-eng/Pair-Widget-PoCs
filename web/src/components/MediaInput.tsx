import { Image as ImageIcon, Link2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from './ui'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

/**
 * An image field that accepts a pasted URL or a file drop/upload.
 * Whatever the route, the value is a plain URL, so the widget config stays
 * exactly the shape Pair expects.
 */
export function MediaInput({
  label,
  value,
  onChange,
  disabled,
  placeholder = 'https://…',
  hint,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  placeholder?: string
  hint?: string
}) {
  const { t } = useI18n()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const send = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const up = await api.uploadImage(file)
        onChange(up.url)
        toast.ok(t('media.uploaded'))
      } catch (e) {
        toast.err((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [onChange, toast, t],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) void send(file)
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex items-start gap-2.5 rounded-lg border p-2 transition-all duration-200 ${
          dragging ? 'border-accent bg-accent-50 ring-[3px] ring-accent-200' : 'border-line bg-white'
        }`}
      >
        <Thumb url={value} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative">
            <Link2 className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint/60" />
            <input
              className="input mono ps-8 pe-8 py-1.5 text-[11.5px]"
              dir="ltr"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              aria-label={label}
            />
            {value && !disabled && (
              <button
                type="button"
                onClick={() => onChange('')}
                aria-label={t('media.clear')}
                className="absolute end-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:text-alert"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn-ghost btn-sm text-[11.5px]" onClick={() => fileInput.current?.click()} disabled={disabled || busy}>
              {busy ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />}
              {t('media.upload')}
            </button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void send(f)
            e.target.value = ''
          }}
        />
      </div>
      <p className="fine mt-1.5">{hint ?? t('media.hint')}</p>
    </div>
  )
}

function Thumb({ url }: { url: string }) {
  const { t } = useI18n()
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])

  return (
    <div
      className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-code"
      style={{ backgroundImage: 'linear-gradient(45deg,#e8eef3 25%,transparent 25%,transparent 75%,#e8eef3 75%),linear-gradient(45deg,#e8eef3 25%,transparent 25%,transparent 75%,#e8eef3 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0,5px 5px' }}
      title={url || t('media.none')}
    >
      {url && !broken ? (
        <img src={url} alt="" className="size-full object-contain" onError={() => setBroken(true)} />
      ) : (
        <ImageIcon className="size-5 text-faint/50" />
      )}
    </div>
  )
}
