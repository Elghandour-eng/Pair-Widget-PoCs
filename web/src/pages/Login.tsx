import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Logo, Spinner } from '@/components/ui'

export function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/widgets" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try { await login(email, password) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="text-4xl" />
          <p className="mt-1 text-sm font-semibold text-ink-500">Widget Studio</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div><label className="label">Email</label><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Password</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="size-4" /> : 'Sign in'}</button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-300">Pair Widget PoCs · design configs served from Pair or Redis</p>
      </div>
    </div>
  )
}
