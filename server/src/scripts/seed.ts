import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { connectRedis, redis } from '../lib/redis.js'
import { createUser, getUserByEmail, roleSchema } from '../services/users.js'

/**
 * Idempotent seed: creates the admin and any SEED_USERS that do not exist yet.
 * SEED_USERS format: email:password:role,email:password:role
 */
export async function runSeed(opts: { quiet?: boolean } = {}): Promise<void> {
  const log = opts.quiet ? logger.debug.bind(logger) : logger.info.bind(logger)
  const entries: Array<{ email: string; password: string; role: string; name: string }> = []
  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    entries.push({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD, role: 'admin', name: 'Admin' })
  }
  for (const item of env.SEED_USERS.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [email, password, role = 'viewer'] = item.split(':')
    if (!email || !password) continue
    entries.push({ email, password, role, name: email.split('@')[0] })
  }
  for (const e of entries) {
    const role = roleSchema.safeParse(e.role)
    if (!role.success) { logger.warn({ email: e.email, role: e.role }, 'seed: invalid role, skipped'); continue }
    if (await getUserByEmail(e.email)) { log({ email: e.email }, 'seed: user exists'); continue }
    await createUser({ email: e.email, password: e.password, role: role.data, name: e.name })
    logger.info({ email: e.email, role: role.data }, 'seed: user created')
  }
}

// Allow `npm run seed` to run this file directly.
if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  connectRedis()
    .then(() => runSeed())
    .then(() => redis.quit())
    .then(() => process.exit(0))
    .catch((err) => { logger.error({ err }, 'seed failed'); process.exit(1) })
}
