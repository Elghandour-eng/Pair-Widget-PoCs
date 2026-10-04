import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import { logger } from './logger.js'

export const redis = new Redis(env.REDIS_URL, {
  keyPrefix: env.REDIS_PREFIX,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
})

redis.on('error', (err) => logger.error({ err }, 'redis error'))
redis.on('ready', () => logger.info('redis ready'))

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready') return
  await redis.connect()
}

/**
 * A read that is allowed to fail.
 *
 * Some paths must answer whether or not Redis is reachable — a chat turn is
 * the one that matters: its per-widget settings are a refinement, and losing
 * them should cost the defaults, not the conversation. ioredis retries before
 * it throws, so a plain `get` can hang for over a minute on a broken socket;
 * this races it against a deadline and treats every failure as "no value".
 */
export async function getSoon(key: string, ms = 1500): Promise<string | null> {
  try {
    return await Promise.race([
      redis.get(key),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms).unref?.()),
    ])
  } catch {
    return null
  }
}

/** Key helpers — single place that defines the Redis key layout. */
export const keys = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  users: () => 'users',
  widget: (widgetId: string) => `widget:${widgetId}`,
  widgetConfig: (widgetId: string) => `widget:${widgetId}:config`,
  widgets: () => 'widgets',
  apiCache: (widgetId: string) => `cache:api:${widgetId}`,
  audit: (widgetId: string) => `widget:${widgetId}:audit`,
  versions: (widgetId: string) => `widget:${widgetId}:versions`,
  syslog: () => 'syslog',
  feedback: (widgetId: string) => `widget:${widgetId}:feedback`,
  /** Which templates a widget may render, and the source bound to each. */
  widgetTemplates: (widgetId: string) => `widget:${widgetId}:templates`,
  /** A named data source definition, and the last good copy of what it fetched. */
  dataSource: (id: string) => `datasource:${id}`,
  dataSourceCache: (id: string) => `datasource:${id}:cache`,
  dataSources: () => 'datasources',
}
