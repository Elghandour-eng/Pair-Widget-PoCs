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

function ChunkErrorNotice({ detail }: { detail?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-sm font-bold text-ink">{t('common.chunkError')}</p>
      {/* The message itself, not just the generic line: a boundary that catches
          every error and shows one sentence makes a real fault unreportable. */}
      {detail && <p className="mono max-w-full overflow-auto text-[11px] leading-snug text-alert">{detail}</p>}
      <button className="btn-ghost btn-sm" onClick={() => location.reload()}>{t('common.reload')}</button>
    </div>
  )
}

/**
 * Catches a page-level failure — a chunk that would not download after a
 * deploy, or a fault in the page itself — and offers a reload instead of a
 * blank screen. The error is logged and shown, so it can be acted on.
 */
class ChunkBoundary extends Component<{ children: ReactNode }, { detail?: string; failed: boolean }> {
  state: { detail?: string; failed: boolean } = { failed: false }
  static getDerivedStateFromError(error: unknown) {
    return { failed: true, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
  componentDidCatch(error: unknown, info: unknown) {
    console.error('[pair-studio] page failed', error, info)
  }
  render() { return this.state.failed ? <ChunkErrorNotice detail={this.state.detail} /> : this.props.children }
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
