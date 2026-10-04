import { describe, expect, it } from 'vitest'

process.env.JWT_SECRET = 'test-secret-test-secret-1234'
process.env.VITE_PUSHER_APP_KEY = 'widget-key-0000000000'
process.env.VITE_PUSHER_HOST = 'pusher.example.test'
process.env.VITE_PUSHER_PORT = '443'

const { authKeyOf, pusherStatus, recordPairPusherAuth } = await import('./pusherEnv.js')

describe('pusher key agreement', () => {
  it('reads the key out of a Pusher auth signature', () => {
    expect(authKeyOf('abc123:deadbeef')).toBe('abc123')
    expect(authKeyOf(':deadbeef')).toBeNull()
    expect(authKeyOf('nocolon')).toBeNull()
    expect(authKeyOf(42)).toBeNull()
  })

  it('reports what the widget is served, masked, before any subscription', () => {
    expect(pusherStatus()).toEqual({
      target: 'self-hosted',
      host: 'pusher.example.test',
      cluster: null,
      port: '443',
      forceTls: null,
      key: 'widg…000',
      signedWith: null,
      mismatch: null,
    })
  })

  it('ignores bodies that are not an auth signature', () => {
    recordPairPusherAuth('not json')
    recordPairPusherAuth(JSON.stringify({ error: 'nope' }))
    recordPairPusherAuth(Buffer.from('null'))
    expect(pusherStatus().signedWith).toBeNull()
    expect(pusherStatus().mismatch).toBeNull()
  })

  it('agrees when Pair signs with the key the widget is served', () => {
    recordPairPusherAuth(JSON.stringify({ auth: 'widget-key-0000000000:sig' }))
    expect(pusherStatus().signedWith).toBe('widg…000')
    expect(pusherStatus().mismatch).toBe(false)
  })

  it('flags a Pair key other than the one the widget is served', () => {
    recordPairPusherAuth(Buffer.from(JSON.stringify({ auth: 'pair-key-1111111111:sig' })))
    expect(pusherStatus().signedWith).toBe('pair…111')
    expect(pusherStatus().mismatch).toBe(true)
  })
})
