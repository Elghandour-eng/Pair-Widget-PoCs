export type Role = 'admin' | 'editor' | 'viewer'
export type Source = 'api' | 'redis'
export interface User {
  id: string; email: string; name: string; role: Role; createdAt: string; updatedAt: string; lastLoginAt?: string
  /** Widgets this user may see; absent = all widgets. */
  widgetIds?: string[]
}
export interface Widget {
  widgetId: string; channelName: string; source: Source; apiBaseUrl?: string; notes?: string
  /** Which backend answers this widget's chat, and which agent it runs. */
  engine?: string; agentId?: string; engineUrl?: string
  /** The orchestrator key is write-only: the dashboard only learns whether one is set. */
  hasEngineKey?: boolean
  /** Pair's AI-agent token for resolving conversations: write-only too. */
  hasPairAgentToken?: boolean
  /** The live templates key's last four characters and when it was issued (the key itself is never returned again). */
  templatesKeyHint?: string; templatesKeyAt?: string
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string
  configUpdatedAt: string | null; configUpdatedBy: string | null
}

export interface EngineDefaults { url: string; agentId: string; hasKey: boolean }

/* ------------------------------ template engine ----------------------------- */

export interface TemplateField {
  key: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  description: string
}
/** A card shape the agent can emit and the widget can render. */
export interface TemplateDef {
  name: string
  /** The catalog shelf: health (Hiro), ticketing, cinema, media, commerce (Boutiqaat). */
  category: 'health' | 'ticketing' | 'cinema' | 'media' | 'commerce'
  title: string
  description: string
  widgetType: string
  /** Drawn by the widget's own renderer (in a frame) rather than a dashboard twin. */
  native?: boolean
  collects: boolean
  /** True when the rows come from the agent's own tool and no source applies. */
  passthrough: boolean
  /** Set on a plugin component: the orchestrator plugin, tool group and tool that produce it. */
  plugin: { id: string; group: string; tool: string } | null
  /** True on a studio template: made in this dashboard, and editable here. */
  custom?: boolean
  emits: TemplateField[]
  sample: Record<string, unknown>
  snippet: Record<string, unknown>
  seedRows: number
  /** Keys of the design catalog this template honours. */
  design: string[]
  designDefaults: TemplateDesign
}
/** What the studio is given: a design as a picture, as markup, or in words. */
export interface StudioInput {
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string }
  html?: string
  prompt?: string
  /** On a refine pass: the body on screen, so the model revises it instead of starting over. */
  previous?: { html: string; fields: Array<{ key: string; type: string; description: string }> }
}

/** A template the studio made, before anyone saves it. */
export interface StudioSpec {
  name: string
  title: string
  description: string
  category: TemplateDef['category']
  fields: Array<{ key: string; type: TemplateField['type']; required: boolean; description: string }>
  html: string
  sample: Record<string, unknown>
}

export interface CustomTemplate extends StudioSpec {
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

/** A plugin as the agent has it installed; `groups` are the tool groups in use ("tickets", "messaging"…). */
export interface AgentPlugin {
  enabled: boolean
  environment: string
  groups: string[]
  tools: string[]
}
/** A design knob a template honours. The dashboard renders a control per `type`. */
export interface DesignField {
  key: string
  label: string
  type: 'color' | 'number' | 'choice' | 'boolean'
  options?: string[]
  min?: number
  max?: number
  step?: number
  description: string
}
export type TemplateDesign = Record<string, string | number | boolean>

export type SourceKind = 'inline' | 'http' | 'airtable'
export interface DataSourceConfig {
  url?: string; headers?: Record<string, string>; path?: string
  base?: string; table?: string; view?: string; token?: string
  items?: Array<Record<string, unknown>>
}
export interface DataSource {
  id: string; name: string; kind: SourceKind; ttlMs: number; config: DataSourceConfig
  hasToken: boolean
  status: { rows: number; fetchedAt: string | null; lastError: string | null }
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string
}
/** Which templates a widget renders, and the source behind each. `enabled: null` means all of them. */
export interface WidgetTemplates {
  enabled: string[] | null
  sources: Record<string, string>
  /** Per-template design overrides: what makes a shared template look customised on this widget. */
  designs: Record<string, TemplateDesign>
  updatedAt: string | null
  updatedBy: string | null
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
/** A design the widget used to have. */
export interface ConfigVersion {
  id: string
  at: string
  by: string
  label: string
  bytes: number
  savedAt: string | null
  savedBy: string | null
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
    request<{
      widget: Widget; storedConfig: WidgetConfig | null; hasStoredConfig: boolean; audit: AuditEntry[]; sdkBaseUrl: string
      /** The server's own Danah agent, which a Danah widget with empty fields uses. */
      engineDefaults?: EngineDefaults
    }>(`/widgets/${encodeURIComponent(widgetId)}`),
  /** Tries orchestrator settings before they are saved. */
  checkEngine: (widgetId: string, body: { engineUrl?: string; engineKey?: string; agentId?: string }) =>
    request<{ ok: boolean; status: number; agent?: string; message?: string }>(`/widgets/${encodeURIComponent(widgetId)}/engine/check`, { method: 'POST', body: JSON.stringify(body) }),
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
  getVersions: (widgetId: string) =>
    request<{ versions: ConfigVersion[] }>(`/widgets/${encodeURIComponent(widgetId)}/versions`),
  getVersion: (widgetId: string, versionId: string) =>
    request<{ config: WidgetConfig }>(
      `/widgets/${encodeURIComponent(widgetId)}/versions/${encodeURIComponent(versionId)}`,
    ),
  restoreVersion: (widgetId: string, versionId: string) =>
    request<{ widget: Widget; config: WidgetConfig }>(
      `/widgets/${encodeURIComponent(widgetId)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: 'POST' },
    ),
  issueTemplatesKey: (widgetId: string) =>
    request<{ key: string; hint: string; at: string }>(`/widgets/${encodeURIComponent(widgetId)}/templates-key`, { method: 'POST' }),
  revokeTemplatesKey: (widgetId: string) =>
    request<void>(`/widgets/${encodeURIComponent(widgetId)}/templates-key`, { method: 'DELETE' }),
  updateWidget: (widgetId: string, body: Partial<Pick<Widget, 'channelName' | 'source' | 'apiBaseUrl' | 'notes' | 'engine' | 'agentId' | 'engineUrl'>> & { engineKey?: string; pairAgentToken?: string }) =>
    request<{ widget: Widget }>(`/widgets/${encodeURIComponent(widgetId)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWidget: (widgetId: string) => request<void>(`/widgets/${encodeURIComponent(widgetId)}`, { method: 'DELETE' }),
  resolveConfig: (widgetId: string, source?: Source) =>
    request<{ source: Source; cached: boolean; config: WidgetConfig }>(`/widgets/${encodeURIComponent(widgetId)}/config${source ? `?source=${source}` : ''}`),
  saveConfig: (widgetId: string, config: WidgetConfig) => request<{ widget: Widget }>(`/widgets/${encodeURIComponent(widgetId)}/config`, { method: 'PUT', body: JSON.stringify(config) }),
  importFromApi: (widgetId: string) => request<{ widget: Widget; storedConfig: WidgetConfig }>(`/widgets/${encodeURIComponent(widgetId)}/import`, { method: 'POST' }),

  listTemplates: () =>
    request<{ templates: TemplateDef[]; designFields: Record<string, DesignField>; sdkBaseUrl?: string }>('/templates'),
  /** POST so an unsaved design can be previewed as the editor types. */
  previewTemplate: (name: string, body: { source?: string; design?: TemplateDesign; lang?: 'ar' | 'en' } = {}) =>
    request<{ name: string; widgetType: string; content: Record<string, unknown>; template?: Record<string, unknown> }>(
      `/templates/${encodeURIComponent(name)}/preview`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  /* ------------------------------- the studio ------------------------------ */

  studioStatus: () => request<{ ready: boolean }>('/templates/studio/status'),
  /** One model call: a design in, an unsaved template out. Nothing is written until it is saved. */
  generateTemplate: (body: StudioInput) =>
    request<{ template: StudioSpec }>('/templates/studio/generate', { method: 'POST', body: JSON.stringify(body) }),
  /** The engine's own renderer, run on an unsaved body, so the preview is the card and not a likeness. */
  previewStudioHtml: (body: { html: string; sample: Record<string, unknown> }) =>
    request<{ html: string }>('/templates/studio/preview', { method: 'POST', body: JSON.stringify(body) }),
  listCustomTemplates: () => request<{ templates: CustomTemplate[] }>('/templates/custom'),
  getCustomTemplate: (name: string) =>
    request<{ template: CustomTemplate }>(`/templates/custom/${encodeURIComponent(name)}`),
  createCustomTemplate: (body: StudioSpec) =>
    request<{ template: CustomTemplate }>('/templates/custom', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomTemplate: (name: string, body: Partial<Omit<StudioSpec, 'name'>>) =>
    request<{ template: CustomTemplate }>(`/templates/custom/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteCustomTemplate: (name: string) =>
    request<void>(`/templates/custom/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  listDataSources: () => request<{ sources: DataSource[] }>('/datasources'),
  createDataSource: (body: { id: string; name: string; kind: SourceKind; ttlMs: number; config: DataSourceConfig }) =>
    request<{ source: DataSource }>('/datasources', { method: 'POST', body: JSON.stringify(body) }),
  updateDataSource: (id: string, body: { name?: string; ttlMs?: number; config?: DataSourceConfig }) =>
    request<{ source: DataSource }>(`/datasources/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  refreshDataSource: (id: string) => request<{ source: DataSource }>(`/datasources/${encodeURIComponent(id)}/refresh`, { method: 'POST' }),
  deleteDataSource: (id: string) => request<void>(`/datasources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getWidgetTemplates: (widgetId: string) =>
    request<{ templates: WidgetTemplates; plugins: Record<string, AgentPlugin> | null }>(`/widgets/${encodeURIComponent(widgetId)}/templates`),
  saveWidgetTemplates: (
    widgetId: string,
    body: { enabled?: string[] | null; sources?: Record<string, string>; designs?: Record<string, TemplateDesign> },
  ) =>
    request<{ templates: WidgetTemplates }>(`/widgets/${encodeURIComponent(widgetId)}/templates`, { method: 'PUT', body: JSON.stringify(body) }),

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

/**
 * The standalone test page: this widget, rendered by the real SDK, with the
 * launcher the design saved. `?frame=1` is the same page without the surrounding
 * test-page chrome, which is what the previews embed.
 */
export const widgetTestUrl = (widgetId: string) =>
  `${window.location.origin}/api/public/widget/${encodeURIComponent(widgetId)}/embed`

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
