import type { DesignField, TemplateDesign } from '@/lib/api'

/**
 * One control per design knob, chosen by the field's own type.
 *
 * The catalog comes from the server with the templates, so nothing about a
 * knob is hardcoded here — adding a field on the server puts a working control
 * on this page without touching it.
 */
export function DesignControls({
  fields,
  keys,
  value,
  defaults,
  onChange,
}: {
  fields: Record<string, DesignField>
  /** The knobs this template honours; anything else is never shown. */
  keys: string[]
  value: TemplateDesign
  defaults: TemplateDesign
  onChange: (next: TemplateDesign) => void
}) {
  const set = (key: string, v: string | number | boolean) => onChange({ ...value, [key]: v })
  const current = (key: string) => value[key] ?? defaults[key]

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const f = fields[key]
        if (!f) return null
        const v = current(key)
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="label">{f.label}</span>
              {f.type === 'number' && <span className="mono text-[11px] text-muted">{String(v ?? '')}</span>}
            </div>

            {f.type === 'color' && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="size-8 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                  value={typeof v === 'string' && v.startsWith('#') ? v.slice(0, 7) : '#b3202c'}
                  onChange={(e) => set(key, e.target.value)}
                />
                <input
                  className="input mono flex-1 text-[12px]"
                  value={typeof v === 'string' ? v : ''}
                  placeholder="inherit from theme"
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            )}

            {f.type === 'number' && (
              <input
                type="range"
                className="w-full accent-brand"
                min={f.min ?? 0}
                max={f.max ?? 32}
                step={f.step ?? 1}
                value={typeof v === 'number' ? v : (f.min ?? 0)}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            )}

            {f.type === 'choice' && (
              <div className="flex flex-wrap gap-1.5">
                {(f.options ?? []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set(key, opt)}
                    className={`rounded-lg px-2.5 py-1 text-[12px] transition-colors ${
                      v === opt ? 'bg-brand text-white' : 'bg-sunken text-muted hover:text-ink'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {f.type === 'boolean' && (
              <button
                type="button"
                onClick={() => set(key, !v)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                  v ? 'bg-brand/10 text-ink' : 'bg-sunken text-muted'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`relative h-4 w-7 rounded-full transition-colors ${v ? 'bg-brand' : 'bg-line'}`}
                  aria-hidden
                >
                  <span
                    className="absolute top-0.5 size-3 rounded-full bg-white transition-all"
                    style={{ insetInlineStart: v ? '14px' : '2px' }}
                  />
                </span>
              </button>
            )}

            <p className="text-[10.5px] leading-snug text-muted">{f.description}</p>
          </div>
        )
      })}
    </div>
  )
}
