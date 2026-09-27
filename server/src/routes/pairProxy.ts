import { Router } from 'express'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'

/**
 * The widget points its `beBaseUrl` at this server so the design config is served
 * from the studio. But it uses the same base for every other call it makes
 * (conversations, messages, tokens…), so anything under /v1 that this server does
 * not answer itself is forwarded to the real Pair backend transparently.
 */
export const pairProxyRouter = Router()

const FORWARD_HEADERS = ['content-type', 'accept', 'authorization', 'x-request-id', 'accept-language']

pairProxyRouter.use(async (req, res) => {
  const base = env.PAIR_API_BASE_URL.replace(/\/$/, '')
  const target = `${base}/v1${req.url}`
  try {
    const headers: Record<string, string> = {}
    for (const h of FORWARD_HEADERS) {
      const v = req.get(h)
      if (v) headers[h] = v
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method)
    // express.json has already consumed JSON bodies; everything else still streams.
    const isJson = !!req.is('application/json')
    const init: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers,
      ...(hasBody
        ? isJson
          ? { body: JSON.stringify(req.body ?? {}) }
          : { body: req as unknown as ReadableStream, duplex: 'half' }
        : {}),
    }

    const upstream = await fetch(target, init)
    res.status(upstream.status)
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (err) {
    logger.warn({ err: (err as Error).message, target, method: req.method }, 'pair proxy failed')
    res.status(502).json({ error: { code: 'upstream_unreachable', message: 'Pair API is unreachable' } })
  }
})
