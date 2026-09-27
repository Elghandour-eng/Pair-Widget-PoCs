import { MongoClient, ObjectId, type Collection, type Db } from 'mongodb'
import { env } from '../config/env.js'
import { logger } from './logger.js'
import { keys, redis } from './redis.js'

export type LogLevel = 'info' | 'warn' | 'error'

export interface SystemLog {
  at: Date
  level: LogLevel
  action: string
  actor: string | null
  message: string
  widgetId?: string | null
  ip?: string | null
  status?: number | null
  durationMs?: number | null
  meta?: Record<string, unknown>
}

export type FeedbackStatus = 'open' | 'in_progress' | 'solved' | 'dismissed'
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'solved', 'dismissed']

/** A tester note from the public test page. Mutable (status), so it lives in its own collection. */
export interface FeedbackDoc {
  _id?: ObjectId
  widgetId: string
  name: string
  role: string
  note: string
  imageUrl?: string | null
  status: FeedbackStatus
  at: Date
  updatedAt?: Date
  updatedBy?: string
}

let client: MongoClient | null = null
let db: Db | null = null
let logs: Collection<SystemLog> | null = null
let feedback: Collection<FeedbackDoc> | null = null
let state: 'off' | 'connecting' | 'ready' | 'error' = 'off'
let lastError: string | null = null

/**
 * How many entries the Redis fallback keeps. Redis is the store of record for the
 * rest of the product, so a capped list there is enough history for the log page
 * whenever MongoDB is not configured or unreachable.
 */
const REDIS_LOG_CAP = 5000

/**
 * MongoDB is an optional sink for the system log. When MONGODB_URI is unset or the
 * server is unreachable the dashboard keeps working: events go to pino AND to a
 * capped Redis list, so the System log page always has searchable history.
 */
export async function initMongo(): Promise<void> {
  if (!env.MONGODB_URI) {
    logger.info('MONGODB_URI not set; system logs kept in Redis')
    return
  }
  state = 'connecting'
  try {
    client = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: env.MONGODB_TIMEOUT_MS,
      connectTimeoutMS: env.MONGODB_TIMEOUT_MS,
    })
    await client.connect()
    db = client.db(env.MONGODB_DB)
    logs = db.collection<SystemLog>('system_logs')
    feedback = db.collection<FeedbackDoc>('widget_feedback')

    await Promise.all([
      feedback.createIndex({ widgetId: 1, at: -1 }),
      feedback.createIndex({ widgetId: 1, status: 1, at: -1 }),
      logs.createIndex({ at: -1 }),
      logs.createIndex({ action: 1, at: -1 }),
      logs.createIndex({ actor: 1, at: -1 }),
      logs.createIndex({ widgetId: 1, at: -1 }),
      // Housekeeping: drop entries once they age out.
      logs.createIndex({ at: 1 }, { expireAfterSeconds: env.MONGODB_LOG_TTL_DAYS * 86400 }),
    ])

    state = 'ready'
    lastError = null
    logger.info({ db: env.MONGODB_DB }, 'mongo connected; system logs persisted')
  } catch (err) {
    state = 'error'
    lastError = (err as Error).message
    logs = null
    feedback = null
    logger.warn({ err: lastError }, 'mongo unavailable; system logs kept in Redis')
  }
}

export async function closeMongo(): Promise<void> {
  await client?.close().catch(() => undefined)
  client = null
  db = null
  logs = null
  feedback = null
  state = 'off'
}

export const mongoStatus = () => ({ enabled: !!env.MONGODB_URI, state, error: lastError })

/** Never let logging break a request: failures are swallowed after one warning. */
export function logEvent(entry: Omit<SystemLog, 'at'> & { at?: Date }): void {
  const doc: SystemLog = { ...entry, at: entry.at ?? new Date() }
  const line = { action: doc.action, actor: doc.actor, widgetId: doc.widgetId ?? undefined }
  if (doc.level === 'error') logger.error(line, doc.message)
  else if (doc.level === 'warn') logger.warn(line, doc.message)
  else logger.info(line, doc.message)

  if (logs) {
    logs.insertOne(doc).catch((err) => {
      logger.debug({ err: (err as Error).message }, 'could not persist system log')
    })
    return
  }

  // No Mongo: keep a capped history in Redis so the log page still has data.
  redis
    .multi()
    .lpush(keys.syslog(), JSON.stringify(doc))
    .ltrim(keys.syslog(), 0, REDIS_LOG_CAP - 1)
    .exec()
    .catch((err) => {
      logger.debug({ err: (err as Error).message }, 'could not persist system log')
    })
}

/** Redis entries round-trip through JSON, so `at` comes back as an ISO string. */
function parseRedisLog(raw: string): SystemLog | null {
  try {
    const doc = JSON.parse(raw) as SystemLog & { at: string | Date }
    return { ...doc, at: new Date(doc.at) }
  } catch {
    return null
  }
}

async function redisLogs(): Promise<SystemLog[]> {
  const raws = await redis.lrange(keys.syslog(), 0, REDIS_LOG_CAP - 1)
  return raws.map(parseRedisLog).filter((l): l is SystemLog => !!l)
}

export interface LogQuery {
  level?: LogLevel
  action?: string
  actor?: string
  widgetId?: string
  q?: string
  since?: Date
  until?: Date
  page: number
  perPage: number
}

export async function queryLogs(input: LogQuery): Promise<{ items: SystemLog[]; total: number; available: boolean }> {
  if (!logs) return queryRedisLogs(input)

  const filter: Record<string, unknown> = {}
  if (input.level) filter.level = input.level
  if (input.action) filter.action = input.action
  if (input.actor) filter.actor = input.actor
  if (input.widgetId) filter.widgetId = input.widgetId
  if (input.since || input.until) {
    filter.at = { ...(input.since ? { $gte: input.since } : {}), ...(input.until ? { $lte: input.until } : {}) }
  }
  if (input.q) {
    // Escaped so a user's search text is never treated as a pattern.
    const rx = new RegExp(input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ message: rx }, { action: rx }, { actor: rx }, { widgetId: rx }]
  }

  const [items, total] = await Promise.all([
    logs.find(filter).sort({ at: -1 }).skip((input.page - 1) * input.perPage).limit(input.perPage).toArray(),
    logs.countDocuments(filter),
  ])
  return { items, total, available: true }
}

/** Same query semantics as the Mongo path, applied in memory over the capped Redis list. */
async function queryRedisLogs(input: LogQuery): Promise<{ items: SystemLog[]; total: number; available: boolean }> {
  let all: SystemLog[]
  try {
    all = await redisLogs()
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'could not read system logs from redis')
    return { items: [], total: 0, available: false }
  }

  const q = input.q?.toLowerCase()
  const matched = all.filter((l) => {
    if (input.level && l.level !== input.level) return false
    if (input.action && l.action !== input.action) return false
    if (input.actor && l.actor !== input.actor) return false
    if (input.widgetId && l.widgetId !== input.widgetId) return false
    if (input.since && l.at.getTime() < input.since.getTime()) return false
    if (input.until && l.at.getTime() > input.until.getTime()) return false
    if (q) {
      const hay = [l.message, l.action, l.actor ?? '', l.widgetId ?? ''].join('\n').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const start = (input.page - 1) * input.perPage
  return { items: matched.slice(start, start + input.perPage), total: matched.length, available: true }
}

/* ------------------------------------------------------------------ *
 * Tester feedback (notes from the public test page). Mongo when it is
 * available, otherwise a capped Redis list per widget — same pattern
 * as the system log above, but mutable (a note's status can change).
 * ------------------------------------------------------------------ */

const REDIS_FEEDBACK_CAP = 500

/** The API-facing shape; `id` is a Mongo ObjectId hex or a random id in the Redis fallback. */
export interface FeedbackItem {
  id: string
  widgetId: string
  name: string
  role: string
  note: string
  imageUrl?: string | null
  status: FeedbackStatus
  at: Date
  updatedAt?: Date
  updatedBy?: string
}

const fromDoc = (d: FeedbackDoc): FeedbackItem => ({
  id: d._id!.toHexString(),
  widgetId: d.widgetId,
  name: d.name,
  role: d.role,
  note: d.note,
  imageUrl: d.imageUrl ?? null,
  status: d.status,
  at: d.at,
  updatedAt: d.updatedAt,
  updatedBy: d.updatedBy,
})

const parseRedisFeedback = (raw: string): FeedbackItem | null => {
  try {
    const d = JSON.parse(raw) as FeedbackItem & { at: string | Date; updatedAt?: string | Date }
    return { ...d, at: new Date(d.at), updatedAt: d.updatedAt ? new Date(d.updatedAt) : undefined }
  } catch {
    return null
  }
}

async function redisFeedback(widgetId: string): Promise<FeedbackItem[]> {
  const raws = await redis.lrange(keys.feedback(widgetId), 0, REDIS_FEEDBACK_CAP - 1)
  return raws.map(parseRedisFeedback).filter((f): f is FeedbackItem => !!f)
}

export async function addFeedback(input: { widgetId: string; name: string; role: string; note: string; imageUrl?: string | null }): Promise<FeedbackItem> {
  const at = new Date()
  if (feedback) {
    const doc: FeedbackDoc = { ...input, imageUrl: input.imageUrl ?? null, status: 'open', at }
    const r = await feedback.insertOne(doc)
    return fromDoc({ ...doc, _id: r.insertedId })
  }
  const item: FeedbackItem = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`, ...input, imageUrl: input.imageUrl ?? null, status: 'open', at }
  await redis
    .multi()
    .lpush(keys.feedback(input.widgetId), JSON.stringify(item))
    .ltrim(keys.feedback(input.widgetId), 0, REDIS_FEEDBACK_CAP - 1)
    .exec()
  return item
}

export interface FeedbackQuery {
  widgetId: string
  q?: string
  status?: FeedbackStatus
  page: number
  perPage: number
}

export async function queryFeedback(input: FeedbackQuery): Promise<{ items: FeedbackItem[]; total: number; counts: Record<FeedbackStatus, number> }> {
  const emptyCounts = () => Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0])) as Record<FeedbackStatus, number>

  if (feedback) {
    const filter: Record<string, unknown> = { widgetId: input.widgetId }
    if (input.status) filter.status = input.status
    if (input.q) {
      const rx = new RegExp(input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ note: rx }, { name: rx }, { role: rx }]
    }
    const [docs, total, byStatus] = await Promise.all([
      feedback.find(filter).sort({ at: -1 }).skip((input.page - 1) * input.perPage).limit(input.perPage).toArray(),
      feedback.countDocuments(filter),
      feedback.aggregate<{ _id: FeedbackStatus; n: number }>([{ $match: { widgetId: input.widgetId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    ])
    const counts = emptyCounts()
    for (const b of byStatus) if (b._id in counts) counts[b._id] = b.n
    return { items: docs.map(fromDoc), total, counts }
  }

  const all = await redisFeedback(input.widgetId)
  const counts = emptyCounts()
  for (const f of all) counts[f.status] = (counts[f.status] ?? 0) + 1
  const q = input.q?.toLowerCase()
  const matched = all.filter((f) => {
    if (input.status && f.status !== input.status) return false
    if (q && ![f.note, f.name, f.role].join('\n').toLowerCase().includes(q)) return false
    return true
  })
  const start = (input.page - 1) * input.perPage
  return { items: matched.slice(start, start + input.perPage), total: matched.length, counts }
}

export async function setFeedbackStatus(widgetId: string, id: string, status: FeedbackStatus, actor: string): Promise<FeedbackItem | null> {
  const updatedAt = new Date()
  if (feedback) {
    if (!ObjectId.isValid(id)) return null
    const r = await feedback.findOneAndUpdate(
      { _id: new ObjectId(id), widgetId },
      { $set: { status, updatedAt, updatedBy: actor } },
      { returnDocument: 'after' },
    )
    return r ? fromDoc(r) : null
  }
  // Redis fallback: rewrite the matching entry in place.
  const key = keys.feedback(widgetId)
  const raws = await redis.lrange(key, 0, REDIS_FEEDBACK_CAP - 1)
  for (let i = 0; i < raws.length; i++) {
    const f = parseRedisFeedback(raws[i])
    if (f?.id === id) {
      const next = { ...f, status, updatedAt, updatedBy: actor }
      await redis.lset(key, i, JSON.stringify(next))
      return next
    }
  }
  return null
}

/** Distinct action names, for the filter dropdown. */
export async function logActions(): Promise<string[]> {
  if (logs) return (await logs.distinct('action')).sort()
  try {
    const all = await redisLogs()
    return [...new Set(all.map((l) => l.action))].sort()
  } catch {
    return []
  }
}
