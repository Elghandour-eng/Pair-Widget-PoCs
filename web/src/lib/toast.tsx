import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

type Toast = { id: number; kind: 'ok' | 'err'; text: string }
const Ctx = createContext<{ ok: (t: string) => void; err: (t: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800)
  }, [])
  const value = useMemo(() => ({ ok: (t: string) => push('ok', t), err: (t: string) => push('err', t) }), [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={`card pointer-events-auto flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${t.kind === 'ok' ? 'text-ink-900' : 'text-red-700'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-red-500" />}
            {t.text}
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
