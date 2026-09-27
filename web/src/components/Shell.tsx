import { Activity, LayoutGrid, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { prefetch } from '@/pages/routes'
import { PairLockup, PairMark, LangSwitch, RoleBadge } from './ui'

const COLLAPSE_KEY = 'pws.sidebar'

/**
 * App frame. The document itself never scrolls (see `html, body` in styles.css):
 * the sidebar and the top bar are fixed, and `<main>` is the only scroll container.
 */
export function Shell() {
  const { user, logout, can } = useAuth()
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  const pane = useRef<HTMLElement>(null)

  // A route change resets the pane to the top instead of inheriting the old offset.
  useEffect(() => {
    setDrawer(false)
    pane.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  const navItems = (mini: boolean) => (
    <nav className="flex flex-col gap-1">
      <Item to="/widgets" icon={<LayoutGrid className="size-4" />} label={t('nav.widgets')} mini={mini} />
      {can('admin') && <Item to="/users" icon={<Users className="size-4" />} label={t('nav.users')} mini={mini} />}
      {can('admin') && <Item to="/logs" icon={<Activity className="size-4" />} label={t('nav.logs')} mini={mini} />}
    </nav>
  )

  const account = (mini: boolean) =>
    mini ? (
      <button
        onClick={logout}
        title={t('common.signOut')}
        aria-label={t('common.signOut')}
        className="flex w-full items-center justify-center rounded-lg border border-line bg-white py-2 text-muted transition-colors duration-200 hover:border-accent-300 hover:text-alert"
      >
        <LogOut className="size-4 rtl:-scale-x-100" />
      </button>
    ) : (
      <div className="card px-3 py-2.5">
        <p className="truncate text-[13px] font-bold text-ink">{user?.name}</p>
        <p className="mono truncate text-[10.5px] text-faint">{user?.email}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <RoleBadge role={user?.role ?? 'viewer'} />
          <button onClick={logout} className="inline-flex items-center gap-1 text-[11px] font-bold text-muted transition-colors duration-200 hover:text-alert">
            <LogOut className="size-3.5 rtl:-scale-x-100" />
            {t('common.signOut')}
          </button>
        </div>
      </div>
    )

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Fixed sidebar — collapses to icons, never scrolls with the content */}
      <aside
        className={`hidden shrink-0 flex-col border-e border-line bg-white/70 py-5 backdrop-blur-sm transition-[width] duration-300 ease-out lg:flex ${
          collapsed ? 'w-[68px] px-2.5' : 'w-[228px] px-3.5'
        }`}
      >
        <div className={`mb-7 flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between ps-1.5'}`}>
          {collapsed ? <PairMark className="h-5 text-accent" title={t('app.name')} /> : <PairLockup wordmark="h-[18px]" />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={t(collapsed ? 'common.expandSidebar' : 'common.collapseSidebar')}
            aria-label={t(collapsed ? 'common.expandSidebar' : 'common.collapseSidebar')}
            aria-expanded={!collapsed}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-faint transition-colors duration-200 hover:bg-accent-50 hover:text-accent-deep"
          >
            {collapsed ? <PanelLeftOpen className="size-4 rtl:-scale-x-100" /> : <PanelLeftClose className="size-4 rtl:-scale-x-100" />}
          </button>
        </div>

        {navItems(collapsed)}

        <div className={`mt-auto ${collapsed ? 'space-y-2' : 'space-y-3'}`}>
          {!collapsed && <LangSwitch />}
          {account(collapsed)}
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="anim-fade absolute inset-0 bg-ink/45 backdrop-blur-[3px]" onClick={() => setDrawer(false)} />
          <aside
            className="absolute inset-y-0 start-0 flex w-[264px] max-w-[84vw] flex-col border-e border-line bg-white px-3.5 py-5 shadow-[0_0_60px_-10px_rgba(15,18,22,0.35)]"
            style={{ animation: 'drawer-in 0.32s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <PairLockup wordmark="h-[18px]" label={t('app.product')} />
              <button className="btn-quiet rounded-md p-1.5" onClick={() => setDrawer(false)} aria-label={t('common.close')}>
                <X className="size-5" />
              </button>
            </div>
            {navItems(false)}
            <div className="mt-auto space-y-3">
              <LangSwitch />
              {account(false)}
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Fixed top bar */}
        <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white/80 px-4 py-2.5 backdrop-blur-sm lg:hidden">
          <button className="btn-ghost btn-sm" onClick={() => setDrawer(true)} aria-label={t('common.menu')}>
            <Menu className="size-4" />
          </button>
          <PairMark className="h-5 text-accent" title={t('app.name')} />
          <LangSwitch compact />
        </header>

        {/* The one scrolling element in the app */}
        <main ref={pane} className="scroll-pane flex-1">
          <div key={pathname} className="anim-fade mx-auto flex h-full w-full max-w-[1180px] flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function Item({ to, icon, label, mini }: { to: string; icon: React.ReactNode; label: string; mini: boolean }) {
  return (
    <NavLink
      to={to}
      title={mini ? label : undefined}
      onPointerEnter={() => prefetch(to)}
      onFocus={() => prefetch(to)}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-bold transition-all duration-200 ${mini ? 'justify-center px-0' : 'px-3'} ${
          isActive ? 'bg-accent-50 text-accent-deep' : 'text-muted hover:bg-white hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !mini && (
            <span className="absolute inset-y-1.5 start-0 w-[2.5px] rounded-full bg-accent" style={{ animation: 'sweep 0.3s cubic-bezier(0.22,1,0.36,1) both' }} />
          )}
          {icon}
          {!mini && label}
        </>
      )}
    </NavLink>
  )
}
