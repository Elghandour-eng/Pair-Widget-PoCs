import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { redis } from '../lib/redis.js'
import { MENU_ITEMS as SNAPSHOT } from './cinescapeMenu.js'

/**
 * The Cinescape concessions menu, from Airtable, cached.
 *
 * The engine's menu agent reads Airtable live on every menu turn and sends the
 * items it found. This copy is what the studio hydrates from in the two cases
 * that remain: a `menu_list` that names only a category (the agent's fallback
 * when its Airtable call failed), and the photo and price lookup by name that
 * every item goes through. Both used to read a hand-exported snapshot, which
 * drifted the moment someone edited Airtable — 96 items there against 82 here,
 * and the new ones rendered without photos.
 *
 * So the menu is fetched from the same table, all pages, and kept in memory
 * with a copy in Redis. It refreshes on an interval and serves what it has
 * while a refresh runs; a failed refresh keeps the last good copy, and with no
 * copy at all (no token, no Redis) the compiled snapshot answers, so a menu
 * question is never met with nothing.
 */
export type MenuItem = (typeof SNAPSHOT)[number]

const REDIS_KEY = 'cinescape:menu'
const REDIS_TTL_S = 7 * 24 * 3600

/** Airtable's per-cinema availability columns — the checkbox fields, by name. */
const CINEMA_COLUMNS = [
  '360', '360 VIP', 'Avenues', 'Avenues VIP', 'Al Kout', 'Assima', 'Assima VIP', 'Khairan', 'Khairan VIP',
  'Warehouse', 'Bairaq', 'Ajial', '1954', 'Skyline', 'Fanar', 'Muhallab',
] as const

/** Sold only where there is a VIP lounge (or Skyline) — the snapshot's `vip_only`, derived rather than stored. */
const vipOnly = (cinemas: string[]): boolean => cinemas.length > 0 && cinemas.every((c) => c.endsWith(' VIP') || c === 'Skyline')

/**
 * Photos stay local. Airtable's attachment URLs expire within hours, so a card
 * built from one goes blank after the page has been open a while; the studio's
 * copies under UPLOAD_DIR/menu do not. `_map.json` is name → local path.
 */
let imageMap: Record<string, string> | null = null
const localImage = (name: string): string => {
  if (!imageMap) {
    const file = path.resolve(env.UPLOAD_DIR, 'menu', '_map.json')
    try {
      imageMap = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {}
    } catch {
      imageMap = {}
    }
  }
  return imageMap[name] ?? ''
}

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function toItem(r: AirtableRecord): MenuItem | null {
  const f = r.fields
  const name = str(f.Name)
  if (!name) return null
  const cinemas = CINEMA_COLUMNS.filter((c) => f[c] === true)
  const price = typeof f.Price === 'number' ? f.Price.toFixed(3) : str(f.Price).replace(/^KD\s*/i, '')
  const category = str(f.Category) || 'Other'
  return {
    name,
    name_ar: str(f.ArabicName) || name,
    category,
    category_ar: str(f['Arabic Category']) || category,
    price,
    vip_only: vipOnly(cinemas),
    image: localImage(name),
    cinemas,
  }
}

async function fetchAirtable(): Promise<MenuItem[]> {
  const base = `https://api.airtable.com/v0/${env.AIRTABLE_MENU_BASE}/${env.AIRTABLE_MENU_TABLE}`
  const items: MenuItem[] = []
  let offset: string | undefined
  do {
    const url = `${base}?pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`airtable responded ${res.status}`)
    const page = (await res.json()) as { records?: AirtableRecord[]; offset?: string }
    for (const r of page.records ?? []) {
      const it = toItem(r)
      if (it) items.push(it)
    }
    offset = page.offset
  } while (offset)
  if (items.length === 0) throw new Error('airtable returned no records')
  return items
}

interface Cached {
  items: MenuItem[]
  fetchedAt: string
}

let current: Cached | null = null
let lastError: string | null = null
let refreshing: Promise<void> | null = null
let timer: ReturnType<typeof setInterval> | undefined

/** Every menu lookup reads this; it is never empty. */
export const menuItems = (): MenuItem[] => current?.items ?? SNAPSHOT

/** For /api/health: which copy is answering, and how old it is. */
export const menuStatus = (): { source: 'airtable' | 'snapshot'; items: number; fetchedAt: string | null; lastError: string | null } => ({
  source: current ? 'airtable' : 'snapshot',
  items: menuItems().length,
  fetchedAt: current?.fetchedAt ?? null,
  lastError,
})

/** One refresh at a time; callers that arrive mid-refresh wait for it. */
export function refreshMenu(): Promise<void> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    if (!env.AIRTABLE_TOKEN) {
      lastError = 'AIRTABLE_TOKEN is not set'
      return
    }
    try {
      const items = await fetchAirtable()
      current = { items, fetchedAt: new Date().toISOString() }
      lastError = null
      await redis.set(REDIS_KEY, JSON.stringify(current), 'EX', REDIS_TTL_S).catch(() => undefined)
      logger.info({ items: items.length }, 'cinescape menu refreshed from airtable')
    } catch (err) {
      lastError = (err as Error).message
      logger.warn({ err: lastError, serving: current ? 'last good copy' : 'compiled snapshot' }, 'cinescape menu refresh failed')
    }
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

/**
 * Loads the Redis copy so a restart answers instantly with recent data, then
 * refreshes from Airtable and keeps refreshing on the configured interval.
 */
export async function startMenuRefresh(): Promise<void> {
  try {
    const raw = await redis.get(REDIS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Cached
      if (Array.isArray(parsed.items) && parsed.items.length > 0) current = parsed
    }
  } catch {
    /* Redis unavailable or a bad copy: Airtable or the snapshot answer instead */
  }
  const stale = !current || Date.now() - Date.parse(current.fetchedAt) > env.MENU_REFRESH_MS
  if (stale) await refreshMenu()
  if (!timer) {
    timer = setInterval(() => void refreshMenu(), env.MENU_REFRESH_MS)
    timer.unref?.()
  }
}
