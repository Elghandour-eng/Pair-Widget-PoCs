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
}
