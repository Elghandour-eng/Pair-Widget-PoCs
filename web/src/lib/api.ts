export type Role = 'admin' | 'editor' | 'viewer'
export type Source = 'api' | 'redis'
export interface User { id: string; email: string; name: string; role: Role; createdAt: string; updatedAt: string; lastLoginAt?: string }
export interface Widget {
  widgetId: string; channelName: string; source: Source; apiBaseUrl?: string; notes?: string
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string
  configUpdatedAt: string | null; configUpdatedBy: string | null
}
export interface AuditEntry { at: string; by: string; action: string; detail?: string }
export type WidgetConfig = Record<string, unknown>

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message) }
}

const TOKEN_KEY = 'pws.token'
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.()
    const err = body?.error ?? {}
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? res.statusText, err.details)
  }
  return body as T
}

export const api = {
  login: (email: string, password: string) => request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: User }>('/auth/me'),

  listWidgets: () => request<{ widgets: Widget[] }>('/widgets'),
  peekWidget: (widgetId: string, apiBaseUrl?: string) =>
    request<{ config: WidgetConfig }>(`/widgets/peek/${encodeURIComponent(widgetId)}${apiBaseUrl ? `?apiBaseUrl=${encodeURIComponent(apiBaseUrl)}` : ''}`),
  createWidget: (body: { widgetId: string; channelName: string; source: Source; apiBaseUrl?: string; notes?: string; importFromApi: boolean }) =>
    request<{ widget: Widget }>('/widgets', { method: 'POST', body: JSON.stringify(body) }),
  getWidget: (widgetId: string) => request<{ widget: Widget; storedConfig: WidgetConfig | null; hasStoredConfig: boolean; audit: AuditEntry[] }>(`/widgets/${encodeURIComponent(widgetId)}`),
  updateWidget: (widgetId: string, body: Partial<Pick<Widget, 'channelName' | 'source' | 'apiBaseUrl' | 'notes'>>) =>
    request<{ widget: Widget }>(`/widgets/${encodeURIComponent(widgetId)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWidget: (widgetId: string) => request<void>(`/widgets/${encodeURIComponent(widgetId)}`, { method: 'DELETE' }),
  resolveConfig: (widgetId: string, source?: Source) =>
    request<{ source: Source; cached: boolean; config: WidgetConfig }>(`/widgets/${encodeURIComponent(widgetId)}/config${source ? `?source=${source}` : ''}`),
  saveConfig: (widgetId: string, config: WidgetConfig) => request<{ widget: Widget }>(`/widgets/${encodeURIComponent(widgetId)}/config`, { method: 'PUT', body: JSON.stringify(config) }),
  importFromApi: (widgetId: string) => request<{ widget: Widget; storedConfig: WidgetConfig }>(`/widgets/${encodeURIComponent(widgetId)}/import`, { method: 'POST' }),

  listUsers: () => request<{ users: User[] }>('/users'),
  createUser: (body: { email: string; name: string; password: string; role: Role }) => request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: Partial<{ name: string; role: Role; password: string }>) => request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
}

export const publicConfigUrl = (widgetId: string) => `${window.location.origin}/api/public/widget/${encodeURIComponent(widgetId)}/config`
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
