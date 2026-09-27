export type Role = 'admin' | 'editor' | 'viewer'
export type Source = 'api' | 'redis'
export interface User {
  id: string; email: string; name: string; role: Role; createdAt: string; updatedAt: string; lastLoginAt?: string
  /** Widgets this user may see; absent = all widgets. */
  widgetIds?: string[]
}
export interface Widget {
  widgetId: string; channelName: string; source: Source; apiBaseUrl?: string; notes?: string
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string
  configUpdatedAt: string | null; configUpdatedBy: string | null
}
export interface AuditEntry { at: string; by: string; action: string; detail?: string }
export type LogLevel = 'info' | 'warn' | 'error'
export interface SystemLog {
  at: string; level: LogLevel; action: string; actor: string | null; message: string
  widgetId?: string | null; ip?: string | null; status?: number | null; meta?: Record<string, unknown>
}
export interface Upload { name: string; url: string; size: number; type: string; at?: string }

export type FeedbackStatus = 'open' | 'in_progress' | 'solved' | 'dismissed'
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'solved', 'dismissed']
export interface FeedbackNote {
  id: string
  widgetId: string
  name: string
  role: string
  note: string
  imageUrl?: string | null
  status: FeedbackStatus
  at: string
  updatedAt?: string
  updatedBy?: string
}
export interface LogFilters { level?: string; action?: string; q?: string; page?: number; perPage?: number }
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
  getWidget: (widgetId: string) =>
    request<{ widget: Widget; storedConfig: WidgetConfig | null; hasStoredConfig: boolean; audit: AuditEntry[]; sdkBaseUrl: string }>(`/widgets/${encodeURIComponent(widgetId)}`),
  getFeedback: (widgetId: string, f: { q?: string; status?: FeedbackStatus; page?: number; perPage?: number } = {}) =>
    request<{ available: boolean; notes: FeedbackNote[]; total: number; counts: Record<FeedbackStatus, number> }>(
      `/widgets/${encodeURIComponent(widgetId)}/feedback?${new URLSearchParams(
        Object.entries(f).reduce<Record<string, string>>((a, [k, v]) => (v === undefined || v === '' ? a : { ...a, [k]: String(v) }), {}),
      ).toString()}`,
    ),
  setFeedbackStatus: (widgetId: string, noteId: string, status: FeedbackStatus) =>
    request<{ note: FeedbackNote }>(`/widgets/${encodeURIComponent(widgetId)}/feedback/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  updateWidget: (widgetId: string, body: Partial<Pick<Widget, 'channelName' | 'source' | 'apiBaseUrl' | 'notes'>>) =>
    request<{ widget: Widget }>(`/widgets/${encodeURIComponent(widgetId)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWidget: (widgetId: string) => request<void>(`/widgets/${encodeURIComponent(widgetId)}`, { method: 'DELETE' }),
  resolveConfig: (widgetId: string, source?: Source) =>
    request<{ source: Source; cached: boolean; config: WidgetConfig }>(`/widgets/${encodeURIComponent(widgetId)}/config${source ? `?source=${source}` : ''}`),
  saveConfig: (widgetId: string, config: WidgetConfig) => request<{ widget: Widget }>(`/widgets/${encodeURIComponent(widgetId)}/config`, { method: 'PUT', body: JSON.stringify(config) }),
  importFromApi: (widgetId: string) => request<{ widget: Widget; storedConfig: WidgetConfig }>(`/widgets/${encodeURIComponent(widgetId)}/import`, { method: 'POST' }),

  listLogs: (f: LogFilters) =>
    request<{ logs: SystemLog[]; total: number; page: number; perPage: number; available: boolean }>(
      `/logs?${new URLSearchParams(Object.entries(f).reduce<Record<string, string>>((a, [k, v]) => (v === undefined || v === '' ? a : { ...a, [k]: String(v) }), {})).toString()}`,
    ),
  listLogActions: () => request<{ actions: string[] }>('/logs/actions'),

  uploadImage: async (file: File): Promise<Upload> => {
    const token = tokenStore.get()
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'content-type': file.type, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: file,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 401) onUnauthorized?.()
      const err = body?.error ?? {}
      throw new ApiError(res.status, err.code ?? 'error', err.message ?? res.statusText, err.details)
    }
    return body as Upload
  },

  listUsers: () => request<{ users: User[] }>('/users'),
  createUser: (body: { email: string; name: string; password: string; role: Role; widgetIds?: string[] }) =>
    request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: Partial<{ name: string; role: Role; password: string; widgetIds: string[] | null }>) =>
    request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
}

export const publicConfigUrl = (widgetId: string) => `${window.location.origin}/api/public/widget/${encodeURIComponent(widgetId)}/config`

export interface PanelSize { width: number; maxHeight: number; minHeight: number; bottom: number; radius: number }

export interface EmbedSettings {
  position: 'left' | 'right'
  type: string
  launcherTitle: string
  /** The panel's size, which the SDK needs before the config has loaded. */
  panel?: PanelSize
}

/** The standalone page that renders this widget with the real SDK. */
export const embedPreviewUrl = (widgetId: string, s: EmbedSettings) =>
  `${window.location.origin}/api/public/widget/${encodeURIComponent(widgetId)}/embed?` +
  new URLSearchParams({ position: s.position, type: s.type, launcherTitle: s.launcherTitle }).toString()

/** The snippet a customer pastes into their own site. */
export function embedSnippet(widgetId: string, sdkBaseUrl: string, s: EmbedSettings): string {
  // The server hands back a relative '/sdk' when it is serving the SDK itself,
  // because it cannot know its own public origin from behind a proxy. A snippet
  // is pasted on someone else's site, so it needs an absolute one — and this
  // page is on that origin.
  const base = sdkBaseUrl.startsWith('/') ? window.location.origin + sdkBaseUrl : sdkBaseUrl
  // The SDK builds the panel before the config has loaded, so its size travels
  // in the snippet rather than in the config; otherwise the panel would be
  // built at the old fixed size and resize under the visitor.
  const panel = s.panel ? `\n    panel: ${JSON.stringify(s.panel)},` : ''
  return `<script>
  window.PairAiWidgetSettings = {
    position: ${JSON.stringify(s.position)},
    type: ${JSON.stringify(s.type)},
    launcherTitle: ${JSON.stringify(s.launcherTitle)},${panel}
    beBaseUrl: ${JSON.stringify(window.location.origin)},
  }
  ;(function (d, t) {
    var BASE_URL = ${JSON.stringify(base)}
    var g = d.createElement(t),
      s = d.getElementsByTagName(t)[0]
    g.src = BASE_URL + '/sdk.js'
    g.async = true
    s.parentNode.insertBefore(g, s)
    g.onload = function () {
      window.PairAiWidgetSDK.run({
        widgetId: ${JSON.stringify(widgetId)},
        baseUrl: BASE_URL,
      })
    }
  })(document, 'script')
<\/script>`
}
