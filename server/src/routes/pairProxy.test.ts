import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-test-secret-1234'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/9'
process.env.REDIS_PREFIX = 'pwp-test-proxy:'
process.env.VITE_PUSHER_APP_KEY = 'widget-key-0000000000'
process.env.VITE_PUSHER_HOST = 'pusher.example.test'

// A stand-in for Pair that signs channel subscriptions with a key of its own —
// the staging misconfiguration this check exists for.
const PAIR_KEY = 'pair-key-1111111111'
const pair = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/widget/W1/auth/pusher') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ auth: `${PAIR_KEY}:deadbeef` }))
    return
  }
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})
await new Promise<void>((resolve) => pair.listen(0, '127.0.0.1', resolve))
process.env.PAIR_API_BASE_URL = `http://127.0.0.1:${(pair.address() as AddressInfo).port}`

const { createApp } = await import('../app.js')
const { connectRedis, redis } = await import('../lib/redis.js')

let server: Server
let base: string
const health = async () => ((await (await fetch(`${base}/api/health`)).json()) as { pusher: Record<string, unknown> }).pusher

beforeAll(async () => {
  await connectRedis()
  server = createApp().listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  server.close()
  pair.close()
  await redis.quit()
})

describe('pair proxy: pusher key agreement', () => {
  it('health shows the Pusher the widget is served, undecided until Pair has signed something', async () => {
    expect(await health()).toMatchObject({ target: 'self-hosted', host: 'pusher.example.test', key: 'widg…000', signedWith: null, mismatch: null })
  })

  it('passes the channel auth through untouched and notices Pair signed with another key', async () => {
    const res = await fetch(`${base}/v1/widget/W1/auth/pusher`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ socket_id: '1.1', channel_name: 'private-conversation-1' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ auth: `${PAIR_KEY}:deadbeef` })
    expect(await health()).toMatchObject({ signedWith: 'pair…111', mismatch: true })
  })

  it('leaves the record alone when Pair refuses the request', async () => {
    const res = await fetch(`${base}/v1/widget/W2/auth/pusher`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(res.status).toBe(404)
    expect(await health()).toMatchObject({ signedWith: 'pair…111', mismatch: true })
  })
})
