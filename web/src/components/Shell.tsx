import { LayoutGrid, LogOut, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Logo, RoleBadge } from './ui'

export function Shell() {
  const { user, logout, can } = useAuth()
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-pair-50 text-pair-600' : 'text-ink-500 hover:bg-white hover:text-ink-900'}`
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-100 bg-white/70 px-4 py-6 backdrop-blur md:flex">
        <div className="mb-8 flex items-baseline gap-2 px-2">
          <Logo className="text-2xl" />
          <span className="text-xs font-semibold text-ink-500">Widget Studio</span>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/widgets" className={link}><LayoutGrid className="size-4" />Widgets</NavLink>
          {can('admin') && <NavLink to="/users" className={link}><Users className="size-4" />Users</NavLink>}
        </nav>
        <div className="mt-auto rounded-xl border border-ink-100 bg-white p-3">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-xs text-ink-500">{user?.email}</p>
          <div className="mt-2 flex items-center justify-between">
            <RoleBadge role={user?.role ?? 'viewer'} />
            <button onClick={logout} className="flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-red-600"><LogOut className="size-3.5" />Sign out</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-ink-100 bg-white/70 px-4 py-3 backdrop-blur md:hidden">
          <Logo className="text-xl" />
          <div className="flex gap-3 text-sm font-semibold">
            <NavLink to="/widgets" className="text-ink-700">Widgets</NavLink>
            {can('admin') && <NavLink to="/users" className="text-ink-700">Users</NavLink>}
            <button onClick={logout} className="text-ink-500">Sign out</button>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8"><Outlet /></div>
      </main>
    </div>
  )
}
