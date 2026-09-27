import { Component, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { Loading } from '@/components/ui'
import { AuthProvider, useAuth } from '@/lib/auth'
import { PREVIEW_FRAME_PATH } from '@/lib/builder'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { ToastProvider } from '@/lib/toast'
import { Builder, Login, Logs, PreviewFrame, Users, WidgetDetail, Widgets } from '@/pages/routes'

function Guard({ role }: { role?: 'admin' | 'editor' }) {
  const { user, loading, can } = useAuth()
  if (loading) return <Loading full />
  if (!user) return <Navigate to="/login" replace />
  if (role && !can(role)) return <Navigate to="/widgets" replace />
  return <Outlet />
}

function ChunkErrorNotice() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-bold text-ink">{t('common.chunkError')}</p>
      <button className="btn-ghost btn-sm" onClick={() => location.reload()}>{t('common.reload')}</button>
    </div>
  )
}

/** A page chunk can fail to download (offline, or a stale deploy); offer a reload instead of a blank screen. */
class ChunkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <ChunkErrorNotice /> : this.props.children }
}

function Page({ children }: { children: ReactNode }) {
  return (
    <ChunkBoundary>
      <Suspense fallback={<Loading full />}>{children}</Suspense>
    </ChunkBoundary>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Page><Login /></Page>} />
              {/* Renders only what its parent posts to it, so it needs no auth of its own. */}
              <Route path={PREVIEW_FRAME_PATH} element={<Page><PreviewFrame /></Page>} />
              <Route element={<Guard />}>
                <Route element={<Shell />}>
                  <Route path="/widgets" element={<Page><Widgets /></Page>} />
                  <Route path="/widgets/:widgetId" element={<Page><WidgetDetail /></Page>} />
                  <Route path="/widgets/:widgetId/builder" element={<Page><Builder /></Page>} />
                  <Route element={<Guard role="admin" />}>
                    <Route path="/users" element={<Page><Users /></Page>} />
                    <Route path="/logs" element={<Page><Logs /></Page>} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/widgets" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
