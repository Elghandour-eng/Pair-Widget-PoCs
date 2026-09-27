import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Source } from '@/lib/api'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`select-none font-extrabold tracking-tight text-pair-500 ${className}`} style={{ letterSpacing: '-0.02em' }}>
      PAIR
    </span>
  )
}

export function SourceBadge({ source }: { source: Source }) {
  return source === 'redis'
    ? <span className="badge bg-emerald-50 text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Redis</span>
    : <span className="badge bg-pair-50 text-pair-600"><span className="size-1.5 rounded-full bg-pair-500" />Pair API</span>
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = { admin: 'bg-violet-50 text-violet-700', editor: 'bg-pair-50 text-pair-600', viewer: 'bg-ink-100 text-ink-500' }
  return <span className={`badge ${map[role] ?? map.viewer}`}>{role}</span>
}

export function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-auto p-6`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-50" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-pair-200 border-t-pair-500 ${className}`} />
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs text-ink-500">{sub}</p>}
    </div>
  )
}
