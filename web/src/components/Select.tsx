import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface Option {
  value: string
  label: string
  hint?: string
  icon?: ReactNode
}

/**
 * Listbox replacement for `<select>`, so the menu can carry the Pair styling
 * that native option lists refuse. The panel is portalled to the body and
 * positioned against the trigger, so it is never clipped by a scrolling card.
 */
export function Select({
  value,
  options,
  onChange,
  disabled,
  placeholder = '—',
  label,
  className = '',
  size = 'md',
}: {
  value: string
  options: Option[]
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  label?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; drop: 'down' | 'up' } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const place = useCallback(() => {
    const el = trigger.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const drop = below < 240 && r.top > below ? 'up' : 'down'
    setRect({ top: drop === 'down' ? r.bottom + 6 : r.top - 6, left: r.left, width: r.width, drop })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place, options, value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !panel.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const commit = (v: string) => {
    onChange(v)
    setOpen(false)
    trigger.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = options[active]; if (o) commit(o.value) }
  }

  const pad = size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-3.5 py-2.5 text-sm'

  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-start font-semibold text-body transition-all duration-200 disabled:cursor-not-allowed disabled:bg-code disabled:text-faint ${pad} ${
          open ? 'border-accent ring-[3px] ring-accent-200' : 'border-line hover:border-accent-300'
        } ${className}`}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${selected ? '' : 'text-faint/70'}`}>
          {selected?.icon}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect &&
        createPortal(
          <div
            ref={panel}
            role="listbox"
            aria-label={label}
            className="anim-pop card raise scroll-pane fixed z-[70] max-h-[16rem] overflow-y-auto p-1"
            style={{
              top: rect.drop === 'down' ? rect.top : undefined,
              bottom: rect.drop === 'up' ? window.innerHeight - rect.top : undefined,
              left: rect.left,
              width: rect.width,
              minWidth: '9rem',
            }}
          >
            {options.map((o, i) => {
              const isSel = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(o.value)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-start text-[12.5px] font-semibold transition-colors duration-150 ${
                    i === active ? 'bg-accent-50 text-accent-deep' : 'text-body'
                  }`}
                >
                  {o.icon && <span className="mt-px shrink-0">{o.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="mt-0.5 block text-[10.5px] font-medium leading-[1.4] text-faint">{o.hint}</span>}
                  </span>
                  {isSel && <Check className="mt-px size-3.5 shrink-0 text-accent" />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
