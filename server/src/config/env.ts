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
  // A foreign origin to load the widget SDK from, used only when
  // WIDGET_SDK_DIST holds no build. It has no default on purpose: a default
  // here is inherited by every deployment that never thought about it, which is
  // how one ended up serving a widget from an origin nobody had chosen. Blank is
  // allowed and means "this deployment serves its own SDK at /sdk".
  WIDGET_SDK_BASE_URL: z.union([z.literal(''), z.string().url()]).default(''),
  // Where the widget's own build sits on disk. Set, it is served at /sdk and
  // every embed loads the widget from this same origin — so the widget and the
  // config it renders always ship together.
  WIDGET_SDK_DIST: z.string().default(''),
  // The widget's own settings. The image builds the widget without them and
  // this server hands them to it at runtime (see sdkRuntimeEnv), so they come
  // from the deployment's environment — Vault — and a change needs a restart,
  // not a rebuild. Blank is allowed here; the widget itself refuses to start
  // without VITE_BASE_URL and VITE_PUSHER_APP_KEY, and the server says so at boot.
  VITE_BASE_URL: z.string().default(''),
  VITE_PUSHER_APP_KEY: z.string().default(''),
  VITE_PUSHER_CLUSTER: z.string().default(''),
  VITE_PUSHER_HOST: z.string().default(''),
  VITE_PUSHER_PORT: z.string().default(''),
  VITE_PUSHER_FORCE_TLS: z.string().default(''),
  VITE_HIRO_WIDGET_ID: z.string().default(''),
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
