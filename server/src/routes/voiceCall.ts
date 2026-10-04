import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

import { HttpError, badRequest } from '../lib/errors.js'
import { callId, createCallRoom, livekitConfigured, visitorToken } from '../lib/livekit.js'
import { logger } from '../lib/logger.js'
import { normalizeVoiceCall, voiceCallHasAgent } from '../lib/voiceCall.js'
import { asyncHandler } from '../middleware/error.js'
import { resolveConfig } from '../services/widgets.js'
import { env } from '../config/env.js'

/**
 * Places a voice call: creates a LiveKit room the voice agent is dispatched
 * into, and hands the widget a token for that room alone. Mounted on /v1 and
 * /api/public, beside the config the widget already reads from here.
 */
export const voiceCallRouter = Router()

const body = z
  .object({
    lang: z.string().max(10).optional(),
    visitorId: z.string().max(80).optional(),
    userId: z.string().max(120).optional(),
    name: z.string().max(120).optional(),
    page: z.string().max(500).optional(),
  })
  .partial()

const unavailable = (message: string) => new HttpError(503, message, 'call_unavailable')

voiceCallRouter.post(
  '/widget/:widgetId/call',
  // A call holds an agent for minutes; a few per visitor per minute is plenty.
  rateLimit({ windowMs: 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false }),
  asyncHandler(async (req, res) => {
    const parsed = body.safeParse(req.body ?? {})
    if (!parsed.success) throw badRequest('Invalid call request', parsed.error.flatten())
    const input = parsed.data

    const { config } = await resolveConfig(req.params.widgetId)
    const c = config as Record<string, any>
    const call = normalizeVoiceCall(c.widget_v2_config?.voice_call, c.locale)
    if (!call.enabled) throw unavailable('Voice calls are turned off for this widget')
    if (!voiceCallHasAgent(call)) throw unavailable('No voice agent is set for this widget')
    if (!livekitConfigured()) throw unavailable('Voice calls are not configured on this server')

    const lang = call.language === 'widget' ? (/^ar/i.test(input.lang ?? c.locale ?? '') ? 'ar' : 'en') : call.language
    const id = callId()
    const room = `widget-${req.params.widgetId.slice(0, 40)}-${id}`
    const identity = `visitor-${(input.visitorId ?? id).replace(/[^\w-]/g, '').slice(0, 40) || id}`
    // What the agent reads to pick its configuration and greet in the right
    // language. `phone_number` / `callee_number` are the routing keys the Pair
    // voice agent looks up on the room; a Solef agent is picked by the
    // visitor's `prolife.agent_id` attribute (below).
    const metadata = {
      agent_id: call.agentId || undefined,
      phone_number: call.agentNumber || undefined,
      callee_number: call.agentNumber || undefined,
      caller_number: identity,
      source: 'widget',
      widget_id: req.params.widgetId,
      language: lang,
      user_id: input.userId,
      visitor_name: input.name,
      page_url: input.page,
    }

    try {
      await createCallRoom({ name: room, metadata, agentName: call.agentName || undefined })
    } catch (err) {
      logger.warn({ err, widgetId: req.params.widgetId }, 'voice call: room not created')
      throw new HttpError(502, 'The call could not be placed', 'call_failed')
    }

    // The token outlives the call limit by a margin, so a call is never cut by
    // its own credentials; the widget ends it at the limit itself.
    const ttlSec = (call.maxDurationSec || 3600) + 120
    const attributes: Record<string, string> = { 'prolife.language': lang }
    if (call.agentId) attributes['prolife.agent_id'] = call.agentId
    if (input.name) attributes['prolife.customer_name'] = input.name
    const token = visitorToken({ room, identity, name: input.name || 'Visitor', metadata: { language: lang, source: 'widget' }, attributes, ttlSec })
    logger.info({ widgetId: req.params.widgetId, room, lang, agentId: call.agentId || undefined }, 'voice call placed')
    res.status(201).json({ url: env.LIVEKIT_URL, token, room, identity, language: lang, maxDurationSec: call.maxDurationSec })
  }),
)
