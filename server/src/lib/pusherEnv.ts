import { env } from '../config/env.js'
import { logger } from './logger.js'

/**
 * Which Pusher the widget is told to use, and whether Pair agrees.
 *
 * The widget opens its socket with VITE_PUSHER_APP_KEY against VITE_PUSHER_HOST
 * (Pusher's cloud when that is blank) and then asks Pair to sign the private
 * conversation channel: POST /v1/widget/:id/auth/pusher, which this server
 * proxies. Pair answers `{ auth: "<its key>:<hmac>" }`, and the Pusher server
 * accepts the subscription only when that key is the one the socket was opened
 * with. When the two differ the subscription is refused ("Invalid key in
 * subscription auth data") and no event ever reaches the widget: a message stays
 * "Sending…" although its HTTP call succeeded, and agent replies never arrive
 * live. Every request this server sees succeeds, so nothing here reports it —
 * unless this module does. It reads Pair's key off each proxied auth response
 * and compares it with the key this deployment serves the widget.
 */

/** Enough of a key to recognise it, not enough to use it. */
const mask = (key: string): string | null =>
  key === '' ? null : key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-3)}` : '…'

// Pair's key as last seen in a proxied auth response.
let signedWith: string | null = null
// Each mismatching key is logged once, not on every subscription.
const reported = new Set<string>()

/** The key in a Pusher auth signature, `"<key>:<hmac>"`, or null when it is not one. */
export const authKeyOf = (auth: unknown): string | null => {
  if (typeof auth !== 'string') return null
  const i = auth.indexOf(':')
  return i > 0 ? auth.slice(0, i) : null
}

/**
 * Whether the widget's key and Pair's last seen key agree: null when it cannot
 * be told yet (no key served to the widget, or no subscription proxied so far).
 */
const mismatch = (): boolean | null =>
  env.VITE_PUSHER_APP_KEY === '' || signedWith === null ? null : signedWith !== env.VITE_PUSHER_APP_KEY

/**
 * Records the body Pair returned to a proxied channel-auth request. Anything
 * that is not a JSON object with an `auth` signature is ignored; this never
 * throws, because the proxy must answer the widget whatever Pair said.
 */
export const recordPairPusherAuth = (raw: Buffer | string): void => {
  let key: string | null
  try {
    key = authKeyOf((JSON.parse(raw.toString()) as { auth?: unknown } | null)?.auth)
  } catch {
    return
  }
  if (!key) return
  signedWith = key
  if (mismatch() === true && !reported.has(key)) {
    reported.add(key)
    logger.error(
      pusherStatus(),
      'Pair signs channel subscriptions with a Pusher key other than the one the widget is served: the Pusher server will refuse them and no message or reply reaches the widget live. Set VITE_PUSHER_APP_KEY (and VITE_PUSHER_HOST) in this deployment\'s environment to the Pusher that Pair itself uses, then restart.',
    )
  }
}

/**
 * The Pusher settings the widget is served, for /api/health and the boot log.
 * Keys are masked: the client key is public in every browser anyway, but the
 * health page is not the place to hand it out.
 */
export const pusherStatus = (): {
  target: 'self-hosted' | 'cloud'
  host: string | null
  cluster: string | null
  port: string | null
  forceTls: string | null
  key: string | null
  signedWith: string | null
  mismatch: boolean | null
} => ({
  target: env.VITE_PUSHER_HOST ? 'self-hosted' : 'cloud',
  host: env.VITE_PUSHER_HOST || null,
  cluster: env.VITE_PUSHER_CLUSTER || null,
  port: env.VITE_PUSHER_PORT || null,
  forceTls: env.VITE_PUSHER_FORCE_TLS || null,
  key: mask(env.VITE_PUSHER_APP_KEY),
  signedWith: signedWith === null ? null : mask(signedWith),
  mismatch: mismatch(),
})
