import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ToastProvider } from '@/lib/toast'
import { Login } from '@/pages/Login'
import { Users } from '@/pages/Users'
import { WidgetDetail } from '@/pages/WidgetDetail'
import { Widgets } from '@/pages/Widgets'

function Guard({ role }: { role?: 'admin' | 'editor' }) {
  const { user, loading, can } = useAuth()
  if (loading) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role && !can(role)) return <Navigate to="/widgets" replace />
  return <Outlet />
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Guard />}>
              <Route element={<Shell />}>
                <Route path="/widgets" element={<Widgets />} />
                <Route path="/widgets/:widgetId" element={<WidgetDetail />} />
                <Route element={<Guard role="admin" />}><Route path="/users" element={<Users />} /></Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/widgets" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
