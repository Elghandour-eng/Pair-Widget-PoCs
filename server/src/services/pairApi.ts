import { env } from '../config/env.js'
import { upstream } from '../lib/errors.js'
import { keys, redis } from '../lib/redis.js'
import { logger } from '../lib/logger.js'

export type WidgetConfig = Record<string, unknown>

const API_CACHE_TTL_SECONDS = 60

/** Fetch the live widget config from the Pair backend. Public endpoint, no auth needed. */
export async function fetchPairConfig(widgetId: string, baseUrl = env.PAIR_API_BASE_URL): Promise<WidgetConfig> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/widget/${encodeURIComponent(widgetId)}/config`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.PAIR_API_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw upstream(`Pair API responded ${res.status} for widget ${widgetId}`, { status: res.status, body: body.slice(0, 500) })
    }
    return (await res.json()) as WidgetConfig
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw upstream(`Pair API timed out after ${env.PAIR_API_TIMEOUT_MS}ms`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Same as fetchPairConfig but with a short Redis cache so the public endpoint does not hammer Pair. */
export async function fetchPairConfigCached(widgetId: string, baseUrl?: string): Promise<{ config: WidgetConfig; cached: boolean }> {
  const cacheKey = keys.apiCache(widgetId)
  const hit = await redis.get(cacheKey)
  if (hit) return { config: JSON.parse(hit) as WidgetConfig, cached: true }
  const config = await fetchPairConfig(widgetId, baseUrl)
  await redis.set(cacheKey, JSON.stringify(config), 'EX', API_CACHE_TTL_SECONDS)
  logger.debug({ widgetId }, 'pair config fetched and cached')
  return { config, cached: false }
}

export async function invalidateApiCache(widgetId: string): Promise<void> {
  await redis.del(keys.apiCache(widgetId))
}
