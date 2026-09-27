import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default(''),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379/5'),
  REDIS_PREFIX: z.string().default('pwp:'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  PAIR_API_BASE_URL: z.string().url().default('https://system.trypair.ai'),
  PAIR_API_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  WIDGET_SDK_BASE_URL: z.string().url().default('https://widgets-test.trypair.ai'),
  // A local build of the widget SDK to serve at /sdk. Set it and the studio
  // hands out its own origin as the SDK base, so a design change lands without
  // waiting for the hosted SDK to be redeployed. Blank = use the hosted one.
  WIDGET_SDK_DIST: z.string().default(''),
  // Optional: when set, system logs are also written to MongoDB.
  MONGODB_URI: z.string().optional(),
  MONGODB_DB: z.string().default('pair_widget_studio'),
  MONGODB_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  MONGODB_LOG_TTL_DAYS: z.coerce.number().int().positive().default(90),
  UPLOAD_DIR: z.string().default('data/uploads'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_USERS: z.string().default(''),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
}
