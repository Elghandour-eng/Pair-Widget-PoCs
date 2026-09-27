import { z } from 'zod'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { keys, redis } from '../lib/redis.js'
import { fetchPairConfig, fetchPairConfigCached, invalidateApiCache, type WidgetConfig } from './pairApi.js'

export const sourceSchema = z.enum(['api', 'redis'])
export type Source = z.infer<typeof sourceSchema>

/** Metadata about a registered widget (the "key" in the dashboard). */
export interface WidgetRecord {
  widgetId: string
  channelName: string
  source: Source
  /** Optional per-widget override of the Pair backend base URL. */
  apiBaseUrl?: string
  notes?: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  /** When the Redis config was last written (null if never). */
  configUpdatedAt: string | null
  configUpdatedBy: string | null
}

export interface AuditEntry {
  at: string
  by: string
  action: string
  detail?: string
}

const MAX_AUDIT = 50
const parse = (raw: string | null): WidgetRecord | null => (raw ? (JSON.parse(raw) as WidgetRecord) : null)

async function audit(widgetId: string, entry: AuditEntry): Promise<void> {
  await redis.multi().lpush(keys.audit(widgetId), JSON.stringify(entry)).ltrim(keys.audit(widgetId), 0, MAX_AUDIT - 1).exec()
}

export async function listWidgets(): Promise<WidgetRecord[]> {
  const ids = await redis.smembers(keys.widgets())
  if (!ids.length) return []
  const raws = await redis.mget(ids.map((id) => keys.widget(id)))
  return raws
    .map(parse)
    .filter((w): w is WidgetRecord => !!w)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getWidget(widgetId: string): Promise<WidgetRecord> {
  const w = parse(await redis.get(keys.widget(widgetId)))
  if (!w) throw notFound(`Widget ${widgetId} is not registered`)
  return w
}

export async function createWidget(
  input: { widgetId: string; channelName: string; source: Source; apiBaseUrl?: string; notes?: string; importFromApi?: boolean },
  actor: string,
): Promise<WidgetRecord> {
  const widgetId = input.widgetId.trim()
  if (await redis.exists(keys.widget(widgetId))) throw conflict(`Widget ${widgetId} already exists`)
  const now = new Date().toISOString()
  const record: WidgetRecord = {
    widgetId,
    channelName: input.channelName.trim(),
    source: input.source,
    apiBaseUrl: input.apiBaseUrl?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
    configUpdatedAt: null,
    configUpdatedBy: null,
  }
  let config: WidgetConfig | null = null
  if (input.importFromApi) {
    config = await fetchPairConfig(widgetId, record.apiBaseUrl)
    record.configUpdatedAt = now
    record.configUpdatedBy = actor
  }
  const tx = redis.multi().set(keys.widget(widgetId), JSON.stringify(record)).sadd(keys.widgets(), widgetId)
  if (config) tx.set(keys.widgetConfig(widgetId), JSON.stringify(config))
  await tx.exec()
  await audit(widgetId, { at: now, by: actor, action: 'created', detail: `source=${record.source}${config ? ', imported from api' : ''}` })
  return record
}

export async function updateWidget(
  widgetId: string,
  patch: Partial<Pick<WidgetRecord, 'channelName' | 'source' | 'apiBaseUrl' | 'notes'>>,
  actor: string,
): Promise<WidgetRecord> {
  const w = await getWidget(widgetId)
  if (patch.source === 'redis' && !(await redis.exists(keys.widgetConfig(widgetId)))) {
    throw badRequest('Cannot switch source to redis: no config is stored yet. Import from API or save a config first.')
  }
  if (patch.channelName !== undefined) w.channelName = patch.channelName.trim()
  if (patch.source !== undefined) w.source = patch.source
  if (patch.apiBaseUrl !== undefined) w.apiBaseUrl = patch.apiBaseUrl.trim() || undefined
  if (patch.notes !== undefined) w.notes = patch.notes.trim() || undefined
  w.updatedAt = new Date().toISOString()
  w.updatedBy = actor
  await redis.set(keys.widget(widgetId), JSON.stringify(w))
  await audit(widgetId, { at: w.updatedAt, by: actor, action: 'updated', detail: Object.keys(patch).join(', ') })
  return w
}

export async function deleteWidget(widgetId: string): Promise<void> {
  await getWidget(widgetId)
  await redis
    .multi()
    .del(keys.widget(widgetId))
    .del(keys.widgetConfig(widgetId))
    .del(keys.audit(widgetId))
    .del(keys.apiCache(widgetId))
    .srem(keys.widgets(), widgetId)
    .exec()
}

export async function getStoredConfig(widgetId: string): Promise<WidgetConfig | null> {
  const raw = await redis.get(keys.widgetConfig(widgetId))
  return raw ? (JSON.parse(raw) as WidgetConfig) : null
}

export async function saveStoredConfig(widgetId: string, config: WidgetConfig, actor: string): Promise<WidgetRecord> {
  const w = await getWidget(widgetId)
  const now = new Date().toISOString()
  w.configUpdatedAt = now
  w.configUpdatedBy = actor
  w.updatedAt = now
  w.updatedBy = actor
  await redis.multi().set(keys.widgetConfig(widgetId), JSON.stringify(config)).set(keys.widget(widgetId), JSON.stringify(w)).exec()
  await audit(widgetId, { at: now, by: actor, action: 'config saved', detail: `${JSON.stringify(config).length} bytes` })
  return w
}

/** Pull the live config from Pair and store it in Redis (does not change the source). */
export async function importFromApi(widgetId: string, actor: string): Promise<{ record: WidgetRecord; config: WidgetConfig }> {
  const w = await getWidget(widgetId)
  const config = await fetchPairConfig(widgetId, w.apiBaseUrl)
  await invalidateApiCache(widgetId)
  const record = await saveStoredConfig(widgetId, config, actor)
  await audit(widgetId, { at: record.updatedAt, by: actor, action: 'imported from api' })
  return { record, config }
}

/**
 * Resolve the config the widget should render, honouring the widget's source.
 * This is what the public endpoint (and the future widget) calls.
 */
export async function resolveConfig(
  widgetId: string,
  override?: Source,
): Promise<{ source: Source; cached: boolean; config: WidgetConfig }> {
  const w = await getWidget(widgetId)
  const source = override ?? w.source
  if (source === 'redis') {
    const config = await getStoredConfig(widgetId)
    if (!config) throw notFound(`No Redis config stored for widget ${widgetId}`)
    return { source, cached: false, config }
  }
  const { config, cached } = await fetchPairConfigCached(widgetId, w.apiBaseUrl)
  return { source, cached, config }
}

export async function getAudit(widgetId: string): Promise<AuditEntry[]> {
  const raws = await redis.lrange(keys.audit(widgetId), 0, MAX_AUDIT - 1)
  return raws.map((r) => JSON.parse(r) as AuditEntry)
}
