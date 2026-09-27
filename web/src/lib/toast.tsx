import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

type Toast = { id: number; kind: 'ok' | 'err'; text: string }
const Ctx = createContext<{ ok: (t: string) => void; err: (t: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-2), { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800)
  }, [])
  const value = useMemo(() => ({ ok: (t: string) => push('ok', t), err: (t: string) => push('err', t) }), [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`card raise pointer-events-auto flex max-w-[min(30rem,92vw)] items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold ${t.kind === 'ok' ? 'text-ink' : 'border-alert/30 text-alert'}`}
            style={{ animation: 'toast-in 0.34s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            {t.kind === 'ok' ? <CheckCircle2 className="size-4 shrink-0 text-accent" /> : <XCircle className="size-4 shrink-0 text-alert" />}
            <span className="min-w-0">{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast outside ToastProvider')
  return v
}
