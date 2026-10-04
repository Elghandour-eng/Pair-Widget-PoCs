import { z } from 'zod'
import { badRequest, conflict, notFound } from './errors.js'
import { logger } from './logger.js'
import { keys, redis } from './redis.js'

/**
 * Named, cached data sources — the data half of the template engine.
 *
 * A template describes a *shape*; a data source says where that shape's rows
 * come from and how long a copy of them stays good. Neither is compiled in:
 * a source is a record in Redis, so a new feed is a form in the dashboard, not
 * a deploy, and no template is tied to one customer's data any more.
 *
 * Every source follows the same rule, the one the Cinescape menu already
 * proved out: serve what we have while a refresh runs, keep the last good copy
 * when a refresh fails, and fall back to the template's compiled seed when
 * there is no copy at all. A lookup is therefore always synchronous-fast and
 * never empty — which is what keeps card rendering cheap. None of this data
 * ever reaches the browser: the server hydrates the component and sends only
 * the finished card, so the SDK bundle carries renderers and nothing else.
 */

export const SOURCE_KINDS = ['inline', 'http', 'airtable'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export const sourceConfigSchema = z.object({
  /** http */
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  /** Dot path to the array inside the response, e.g. "data.items". Empty = the body itself. */
  path: z.string().max(200).optional(),
  /** airtable */
  base: z.string().max(80).optional(),
  table: z.string().max(80).optional(),
  view: z.string().max(80).optional(),
  token: z.string().max(200).optional(),
  /** inline */
  items: z.array(z.record(z.unknown())).optional(),
})
export type SourceConfig = z.infer<typeof sourceConfigSchema>

export interface DataSourceDef {
  id: string
  name: string
  kind: SourceKind
  /**
   * How long a fetched copy stays good, in ms. `0` means fetch once at boot and
   * never again; `inline` ignores it entirely.
   */
  ttlMs: number
  config: SourceConfig
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export type Row = Record<string, unknown>

interface Cached {
  rows: Row[]
  fetchedAt: string
}

/** Kept in memory so a hydration never waits on Redis; Redis is the copy that survives a restart. */
const memory = new Map<string, Cached>()
const errors = new Map<string, string>()
const inFlight = new Map<string, Promise<void>>()

const REDIS_TTL_S = 7 * 24 * 3600
const parseDef = (raw: string | null): DataSourceDef | null => (raw ? (JSON.parse(raw) as DataSourceDef) : null)

/* --------------------------------- fetching -------------------------------- */

/** Walks a dot path ("data.items") and returns the array it lands on. */
function pickRows(body: unknown, path?: string): Row[] {
  let node: unknown = body
  for (const part of (path ?? '').split('.').filter(Boolean)) {
    if (!node || typeof node !== 'object') return []
    node = (node as Record<string, unknown>)[part]
  }
  if (Array.isArray(node)) return node.filter((r): r is Row => !!r && typeof r === 'object')
  return []
}

async function fetchHttp(def: DataSourceDef): Promise<Row[]> {
  const { url, headers, path } = def.config
  if (!url) throw new Error('http source has no url')
  const res = await fetch(url, { headers: { Accept: 'application/json', ...(headers ?? {}) }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`${url} responded ${res.status}`)
  return pickRows(await res.json(), path)
}

/**
 * Airtable, all pages. Records arrive as `{id, fields}`; the rows we hand on are
 * the flat fields plus the record id, so a template's mapper never has to know
 * it was Airtable.
 */
async function fetchAirtable(def: DataSourceDef): Promise<Row[]> {
  const { base, table, view, token } = def.config
  if (!base || !table) throw new Error('airtable source needs a base and a table')
  const auth = token || process.env.AIRTABLE_TOKEN || ''
  if (!auth) throw new Error('no Airtable token (set one on the source or AIRTABLE_TOKEN)')
  const rows: Row[] = []
  let offset: string | undefined
  do {
    const qs = new URLSearchParams({ pageSize: '100' })
    if (view) qs.set('view', view)
    if (offset) qs.set('offset', offset)
    const res = await fetch(`https://api.airtable.com/v0/${base}/${table}?${qs}`, {
      headers: { Authorization: `Bearer ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`airtable responded ${res.status}`)
    const page = (await res.json()) as { records?: Array<{ id: string; fields?: Row }>; offset?: string }
    for (const r of page.records ?? []) rows.push({ _id: r.id, ...(r.fields ?? {}) })
    offset = page.offset
  } while (offset)
  return rows
}

async function fetchRows(def: DataSourceDef): Promise<Row[]> {
  if (def.kind === 'inline') return (def.config.items ?? []) as Row[]
  const rows = def.kind === 'airtable' ? await fetchAirtable(def) : await fetchHttp(def)
  if (rows.length === 0) throw new Error('source returned no rows')
  return rows
}

/* ---------------------------------- cache ---------------------------------- */

/** One refresh per source at a time; callers arriving mid-refresh wait for that one. */
export function refreshSource(def: DataSourceDef): Promise<void> {
  const running = inFlight.get(def.id)
  if (running) return running
  const run = (async () => {
    try {
      const rows = await fetchRows(def)
      const cached: Cached = { rows, fetchedAt: new Date().toISOString() }
      memory.set(def.id, cached)
      errors.delete(def.id)
      if (def.kind !== 'inline') await redis.set(keys.dataSourceCache(def.id), JSON.stringify(cached), 'EX', REDIS_TTL_S).catch(() => undefined)
      logger.info({ source: def.id, rows: rows.length }, 'data source refreshed')
    } catch (err) {
      const message = (err as Error).message
      errors.set(def.id, message)
      logger.warn({ source: def.id, err: message, serving: memory.has(def.id) ? 'last good copy' : 'nothing yet' }, 'data source refresh failed')
    }
  })().finally(() => inFlight.delete(def.id))
  inFlight.set(def.id, run)
  return run
}

const isStale = (def: DataSourceDef, at: string): boolean => def.ttlMs > 0 && Date.now() - Date.parse(at) > def.ttlMs

/**
 * The rows a template hydrates from. Never blocks and never throws: a stale copy
 * is served while a refresh runs behind it, and an unknown or never-loaded
 * source returns nothing so the template falls back to its compiled seed.
 */
export function rowsOf(sourceId: string): Row[] {
  const cached = memory.get(sourceId)
  if (!cached) return []
  const def = defs.get(sourceId)
  if (def && isStale(def, cached.fetchedAt)) void refreshSource(def)
  return cached.rows
}

/** For the dashboard and /api/health: which copy is answering and how old it is. */
export function sourceStatus(id: string): { rows: number; fetchedAt: string | null; lastError: string | null } {
  const cached = memory.get(id)
  return { rows: cached?.rows.length ?? 0, fetchedAt: cached?.fetchedAt ?? null, lastError: errors.get(id) ?? null }
}

/* --------------------------------- registry -------------------------------- */

/** The definitions currently loaded, so a hydration never awaits Redis. */
const defs = new Map<string, DataSourceDef>()

export const listSources = (): DataSourceDef[] => [...defs.values()].sort((a, b) => a.name.localeCompare(b.name))
export const getSource = (id: string): DataSourceDef | null => defs.get(id) ?? null

export const sourceId = z.string().min(2).max(64).regex(/^[a-z0-9_-]+$/, 'Source id may only contain lowercase letters, digits, _ and -')

export async function createSource(input: { id: string; name: string; kind: SourceKind; ttlMs: number; config: SourceConfig }, actor: string): Promise<DataSourceDef> {
  if (defs.has(input.id) || (await redis.exists(keys.dataSource(input.id)))) throw conflict(`Data source ${input.id} already exists`)
  const now = new Date().toISOString()
  const def: DataSourceDef = { ...input, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor }
  assertUsable(def)
  await redis.multi().set(keys.dataSource(def.id), JSON.stringify(def)).sadd(keys.dataSources(), def.id).exec()
  defs.set(def.id, def)
  await refreshSource(def)
  return def
}

export async function updateSource(id: string, patch: Partial<Pick<DataSourceDef, 'name' | 'ttlMs' | 'config'>>, actor: string): Promise<DataSourceDef> {
  const def = defs.get(id)
  if (!def) throw notFound(`Data source ${id} not found`)
  const next: DataSourceDef = {
    ...def,
    name: patch.name ?? def.name,
    ttlMs: patch.ttlMs ?? def.ttlMs,
    config: patch.config ? { ...def.config, ...patch.config } : def.config,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  }
  assertUsable(next)
  await redis.set(keys.dataSource(id), JSON.stringify(next))
  defs.set(id, next)
  // The shape of what it fetches may have changed, so the copy is re-fetched rather than aged out.
  await refreshSource(next)
  return next
}

export async function deleteSource(id: string): Promise<void> {
  if (!defs.has(id)) throw notFound(`Data source ${id} not found`)
  await redis.multi().del(keys.dataSource(id)).del(keys.dataSourceCache(id)).srem(keys.dataSources(), id).exec()
  defs.delete(id)
  memory.delete(id)
  errors.delete(id)
}

/** Rejects a definition that could never fetch, so the failure lands on the form and not in a card. */
function assertUsable(def: DataSourceDef): void {
  if (def.kind === 'http' && !def.config.url) throw badRequest('An http source needs a url.')
  if (def.kind === 'airtable' && !(def.config.base && def.config.table)) throw badRequest('An Airtable source needs a base and a table.')
  if (def.kind === 'inline' && !def.config.items?.length) throw badRequest('An inline source needs at least one row.')
}

/**
 * Loads every definition, warms each from its Redis copy so a restart answers
 * immediately, then refreshes what is stale — and keeps doing so on one sweep
 * timer rather than a timer per source.
 */
export async function startDataSources(): Promise<void> {
  const ids = await redis.smembers(keys.dataSources()).catch(() => [] as string[])
  for (const id of ids) {
    const def = parseDef(await redis.get(keys.dataSource(id)).catch(() => null))
    if (!def) continue
    defs.set(id, def)
    if (def.kind === 'inline') {
      memory.set(id, { rows: (def.config.items ?? []) as Row[], fetchedAt: new Date().toISOString() })
      continue
    }
    try {
      const raw = await redis.get(keys.dataSourceCache(id))
      const parsed = raw ? (JSON.parse(raw) as Cached) : null
      if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) memory.set(id, parsed)
    } catch {
      /* no copy, or an unreadable one: the sweep below fetches a fresh one */
    }
  }
  sweep()
  if (!timer) {
    timer = setInterval(sweep, SWEEP_MS)
    timer.unref?.()
  }
}

const SWEEP_MS = 60_000
let timer: ReturnType<typeof setInterval> | undefined

function sweep(): void {
  for (const def of defs.values()) {
    if (def.kind === 'inline') continue
    const cached = memory.get(def.id)
    if (!cached || isStale(def, cached.fetchedAt)) void refreshSource(def)
  }
}

/** Test seam: drops all in-memory state. */
export function resetDataSources(): void {
  defs.clear()
  memory.clear()
  errors.clear()
  inFlight.clear()
}

/** Test seam: registers a definition and its rows without touching Redis. */
export function seedSource(def: DataSourceDef, rows: Row[]): void {
  defs.set(def.id, def)
  memory.set(def.id, { rows, fetchedAt: new Date().toISOString() })
}
