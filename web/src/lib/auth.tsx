import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore, type Role, type User } from './api'

interface AuthState { user: User | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void; can: (min: Role) => boolean }
const Ctx = createContext<AuthState | null>(null)
const rank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => { tokenStore.clear(); setUser(null) }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) { setLoading(false); return }
    api.me().then((r) => setUser(r.user)).catch(logout).finally(() => setLoading(false))
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password)
    tokenStore.set(r.token)
    setUser(r.user)
  }, [])

  const value = useMemo<AuthState>(() => ({ user, loading, login, logout, can: (min) => !!user && rank[user.role] >= rank[min] }), [user, loading, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
