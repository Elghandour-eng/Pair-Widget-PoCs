import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-test-secret-1234'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/9'
process.env.REDIS_PREFIX = 'pwp-test:'
process.env.SEED_ADMIN_EMAIL = 'admin@test.local'
process.env.SEED_ADMIN_PASSWORD = 'Admin#12345'
process.env.SEED_USERS = 'viewer@test.local:Viewer#12345:viewer'

const { createApp } = await import('./app.js')
const { connectRedis, redis } = await import('./lib/redis.js')
const { runSeed } = await import('./scripts/seed.js')

let server: Server
let base: string
const api = (path: string, init: RequestInit = {}, token?: string) =>
  fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } })

async function flushPrefix() {
  const keys = await redis.keys('*') // keyPrefix is applied automatically to KEYS pattern
  if (keys.length) await redis.del(...keys.map((k) => k.replace(/^pwp-test:/, '')))
}

beforeAll(async () => {
  await connectRedis()
  await flushPrefix()
  await runSeed({ quiet: true })
  server = createApp().listen(0)
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(async () => {
  await flushPrefix()
  server.close()
  await redis.quit()
})

describe('auth + rbac', () => {
  let adminToken: string
  let viewerToken: string

  it('rejects bad credentials', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@test.local', password: 'nope' }) })
    expect(r.status).toBe(401)
  })
  it('logs in admin and viewer', async () => {
    const a = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@test.local', password: 'Admin#12345' }) })
    expect(a.status).toBe(200)
    adminToken = (await a.json()).token
    const v = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'viewer@test.local', password: 'Viewer#12345' }) })
    viewerToken = (await v.json()).token
  })
  it('viewer cannot create widgets or list users', async () => {
    const w = await api('/api/widgets', { method: 'POST', body: JSON.stringify({ widgetId: 'W1', channelName: 'x' }) }, viewerToken)
    expect(w.status).toBe(403)
    const u = await api('/api/users', {}, viewerToken)
    expect(u.status).toBe(403)
  })
  it('admin registers a widget (source api), saves a redis config, and switches source', async () => {
    const created = await api('/api/widgets', { method: 'POST', body: JSON.stringify({ widgetId: 'TEST_WIDGET_1', channelName: 'Test Channel' }) }, adminToken)
    expect(created.status).toBe(201)
    // Switching to redis without a config must fail
    const bad = await api('/api/widgets/TEST_WIDGET_1', { method: 'PATCH', body: JSON.stringify({ source: 'redis' }) }, adminToken)
    expect(bad.status).toBe(400)
    const saved = await api('/api/widgets/TEST_WIDGET_1/config', { method: 'PUT', body: JSON.stringify({ name: 'Cinescape AI', widget_color: '#E50914' }) }, adminToken)
    expect(saved.status).toBe(200)
    const ok = await api('/api/widgets/TEST_WIDGET_1', { method: 'PATCH', body: JSON.stringify({ source: 'redis' }) }, adminToken)
    expect(ok.status).toBe(200)
    // Public endpoint serves the redis config, no auth
    const pub = await fetch(`${base}/api/public/widget/TEST_WIDGET_1/config`)
    expect(pub.status).toBe(200)
    expect(pub.headers.get('x-config-source')).toBe('redis')
    expect((await pub.json()).widget_color).toBe('#E50914')
  })
  it('protects the last admin', async () => {
    const list = await (await api('/api/users', {}, adminToken)).json()
    const admin = list.users.find((u: { role: string }) => u.role === 'admin')
    const r = await api(`/api/users/${admin.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'viewer' }) }, adminToken)
    expect(r.status).toBe(400)
  })
})
