import { z } from 'zod'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { logEvent } from '../lib/mongo.js'
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
  /**
   * Which backend answers this widget's chat. `agent-engine` hands it to the
   * orchestrator over SSE; anything else (the default) goes to Pair.
   */
  engine?: string
  /**
   * The agent the orchestrator should run for this widget, and the application
   * key that selects it. Without them the server's env defaults apply — which
   * is why one studio used to be able to serve exactly one agent.
   */
  agentId?: string
  engineKey?: string
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

/** A past design, and what it was replaced by. */
export interface ConfigVersionMeta {
  id: string
  /** When this snapshot was taken — i.e. when the design was replaced. */
  at: string
  /** Who made the change that replaced it. */
  by: string
  /** Why the snapshot exists: 'saved', 'before import from Pair', 'before restore'. */
  label: string
  bytes: number
  /** When the snapshotted design itself was last saved, if known. */
  savedAt: string | null
  savedBy: string | null
}

/** A stored version, payload included. The payload stays a string until asked for. */
export interface ConfigVersion extends ConfigVersionMeta {
  config: string
}

const MAX_AUDIT = 50
/**
 * How many past designs are kept per widget.
 *
 * A design is ~12KB, so twenty of them is a quarter of a megabyte — cheap
 * against the alternative, which is what used to happen: a save, or an import
 * from Pair, overwrote the only copy and there was no way back.
 */
const MAX_VERSIONS = 20
const parse = (raw: string | null): WidgetRecord | null => (raw ? (JSON.parse(raw) as WidgetRecord) : null)

async function audit(widgetId: string, entry: AuditEntry): Promise<void> {
  await redis.multi().lpush(keys.audit(widgetId), JSON.stringify(entry)).ltrim(keys.audit(widgetId), 0, MAX_AUDIT - 1).exec()
  logEvent({
    level: 'info',
    action: `widget.${entry.action.replace(/\s+/g, '_')}`,
    actor: entry.by,
    widgetId,
    message: `${entry.by} ${entry.action} ${widgetId}${entry.detail ? ` (${entry.detail})` : ''}`,
  })
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
  input: {
    widgetId: string; channelName: string; source: Source; apiBaseUrl?: string; notes?: string; importFromApi?: boolean
    engine?: string; agentId?: string; engineKey?: string
  },
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
    engine: input.engine?.trim() || undefined,
    agentId: input.agentId?.trim() || undefined,
    engineKey: input.engineKey?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
    configUpdatedAt: null,
    configUpdatedBy: null,
  }
  // Every widget gets its design snapshotted into Redis on registration, whatever it is
  // served from, so there is always something to edit and compare against.
  let config: WidgetConfig | null = null
  let importError: string | null = null
  if (input.importFromApi !== false) {
    try {
      config = await fetchPairConfig(widgetId, record.apiBaseUrl)
      record.configUpdatedAt = now
      record.configUpdatedBy = actor
    } catch (err) {
      // A widget served from Redis is useless without one, so that case still fails loudly.
      if (record.source === 'redis') throw err
      importError = (err as Error).message
      logger.warn({ widgetId, err: importError }, 'could not snapshot design from Pair; registering without one')
    }
  }
  const tx = redis.multi().set(keys.widget(widgetId), JSON.stringify(record)).sadd(keys.widgets(), widgetId)
  if (config) tx.set(keys.widgetConfig(widgetId), JSON.stringify(config))
  await tx.exec()
  const detail = `source=${record.source}${config ? ', design saved' : importError ? `, no design (${importError})` : ''}`
  await audit(widgetId, { at: now, by: actor, action: 'created', detail })
  return record
}

export async function updateWidget(
  widgetId: string,
  patch: Partial<Pick<WidgetRecord, 'channelName' | 'source' | 'apiBaseUrl' | 'notes' | 'engine' | 'agentId' | 'engineKey'>>,
  actor: string,
): Promise<WidgetRecord> {
  const w = await getWidget(widgetId)
  if (patch.source === 'redis' && !(await redis.exists(keys.widgetConfig(widgetId)))) {
    throw badRequest('Cannot switch source to redis: no config is stored yet. Import from API or save a config first.')
  }
  const sourceChanged = patch.source !== undefined && patch.source !== w.source
  if (patch.channelName !== undefined) w.channelName = patch.channelName.trim()
  if (patch.source !== undefined) w.source = patch.source
  if (patch.apiBaseUrl !== undefined) w.apiBaseUrl = patch.apiBaseUrl.trim() || undefined
  if (patch.notes !== undefined) w.notes = patch.notes.trim() || undefined
  if (patch.engine !== undefined) w.engine = patch.engine.trim() || undefined
  if (patch.agentId !== undefined) w.agentId = patch.agentId.trim() || undefined
  if (patch.engineKey !== undefined) w.engineKey = patch.engineKey.trim() || undefined
  w.updatedAt = new Date().toISOString()
  w.updatedBy = actor
  await redis.set(keys.widget(widgetId), JSON.stringify(w))
  // A source switch is the change operators care about most, so it gets its own event.
  const onlySource = sourceChanged && Object.keys(patch).length === 1
  await audit(widgetId, {
    at: w.updatedAt,
    by: actor,
    action: onlySource ? 'source switched' : 'updated',
    detail: onlySource ? `now serving from ${w.source}` : Object.keys(patch).join(', '),
  })
  return w
}

export async function deleteWidget(widgetId: string, actor: string): Promise<void> {
  const w = await getWidget(widgetId)
  logEvent({
    level: 'warn',
    action: 'widget.deleted',
    actor,
    widgetId,
    message: `${actor} deleted widget ${widgetId} (${w.channelName})`,
  })
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

/**
 * Keeps the design that is about to be replaced.
 *
 * Snapshotting the OUTGOING design rather than the incoming one is what makes
 * "undo" mean what a person expects: the top of the list is always the state
 * just before the change they are looking at.
 */
async function snapshot(widgetId: string, label: string, actor: string): Promise<void> {
  const previous = await redis.get(keys.widgetConfig(widgetId))
  if (!previous) return
  const w = await getWidget(widgetId).catch(() => null)
  const entry: ConfigVersion = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    by: actor,
    label,
    bytes: previous.length,
    savedAt: w?.configUpdatedAt ?? null,
    savedBy: w?.configUpdatedBy ?? null,
    config: previous,
  }
  await redis
    .multi()
    .lpush(keys.versions(widgetId), JSON.stringify(entry))
    .ltrim(keys.versions(widgetId), 0, MAX_VERSIONS - 1)
    .exec()
}

export async function saveStoredConfig(
  widgetId: string,
  config: WidgetConfig,
  actor: string,
  label = 'saved',
): Promise<WidgetRecord> {
  const w = await getWidget(widgetId)
  await snapshot(widgetId, label, actor)
  const now = new Date().toISOString()
  w.configUpdatedAt = now
  w.configUpdatedBy = actor
  w.updatedAt = now
  w.updatedBy = actor
  await redis.multi().set(keys.widgetConfig(widgetId), JSON.stringify(config)).set(keys.widget(widgetId), JSON.stringify(w)).exec()
  await audit(widgetId, { at: now, by: actor, action: 'config saved', detail: `${JSON.stringify(config).length} bytes` })
  return w
}

/** The stored designs, newest first, without their payloads. */
export async function listVersions(widgetId: string): Promise<ConfigVersionMeta[]> {
  const raws = await redis.lrange(keys.versions(widgetId), 0, MAX_VERSIONS - 1)
  return raws.map((r) => {
    const { config: _config, ...meta } = JSON.parse(r) as ConfigVersion
    return meta
  })
}

/** One stored design, by id. */
export async function getVersion(widgetId: string, versionId: string): Promise<WidgetConfig> {
  const raws = await redis.lrange(keys.versions(widgetId), 0, MAX_VERSIONS - 1)
  for (const raw of raws) {
    const entry = JSON.parse(raw) as ConfigVersion
    if (entry.id === versionId) return JSON.parse(entry.config) as WidgetConfig
  }
  throw notFound(`No stored version ${versionId} for widget ${widgetId}`)
}

/**
 * Puts a stored design back. The design being replaced is itself snapshotted
 * first, so a restore is as reversible as any other change.
 */
export async function restoreVersion(
  widgetId: string,
  versionId: string,
  actor: string,
): Promise<{ record: WidgetRecord; config: WidgetConfig }> {
  const config = await getVersion(widgetId, versionId)
  const record = await saveStoredConfig(widgetId, config, actor, 'before restore')
  await audit(widgetId, { at: record.updatedAt, by: actor, action: 'version restored', detail: versionId })
  return { record, config }
}

/** Pull the live config from Pair and store it in Redis (does not change the source). */
export async function importFromApi(widgetId: string, actor: string): Promise<{ record: WidgetRecord; config: WidgetConfig }> {
  const w = await getWidget(widgetId)
  const config = await fetchPairConfig(widgetId, w.apiBaseUrl)
  await invalidateApiCache(widgetId)
  const record = await saveStoredConfig(widgetId, config, actor, 'before import from Pair')
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
