import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { closeMongo, initMongo, logEvent } from './lib/mongo.js'
import { connectRedis, redis } from './lib/redis.js'
import { startDataSources } from './lib/dataSource.js'
import { startMenuRefresh } from './routes/cinescapeMenuSource.js'
import { runSeed } from './scripts/seed.js'

async function main() {
  await connectRedis()
  await initMongo()
  await runSeed({ quiet: true })
  // Not awaited: the menu answers from Redis or the compiled snapshot while the
  // first Airtable fetch runs, so a slow or dead Airtable never delays the boot.
  void startMenuRefresh()
  // Same rule: every template feed warms from its Redis copy and refreshes behind the boot.
  void startDataSources()
  const server = createServer(createApp())
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening')
    logEvent({ level: 'info', action: 'server.started', actor: null, message: `Server started on port ${env.PORT} (${env.NODE_ENV})` })
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down')
    server.close(() => {
      Promise.allSettled([redis.quit(), closeMongo()]).finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start')
  process.exit(1)
})
