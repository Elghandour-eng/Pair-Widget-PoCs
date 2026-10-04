import { randomBytes } from 'node:crypto'

import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'

/**
 * The few LiveKit calls a voice call needs, without the SDK: an access token is
 * an HS256 JWT signed with the API secret, and the room service is plain Twirp
 * over HTTP. Keys come from the deployment's environment and never reach the
 * widget; the widget only ever sees a token for one room.
 */

export function livekitConfigured(): boolean {
  return !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)
}

/** Health: whether calls can be placed, without saying what the keys are. */
export function livekitStatus(): { configured: boolean; url: string | null } {
  return { configured: livekitConfigured(), url: env.LIVEKIT_URL || null }
}

/** The room service lives on the same host as the signalling socket, over HTTP(S). */
function httpBase(): string {
  return env.LIVEKIT_URL.replace(/^ws(s?):\/\//i, 'http$1://').replace(/\/$/, '')
}

interface VideoGrant {
  room?: string
  roomJoin?: boolean
  roomCreate?: boolean
  roomAdmin?: boolean
  canPublish?: boolean
  canSubscribe?: boolean
  canPublishData?: boolean
  canPublishSources?: string[]
}

function sign(claims: { identity?: string; name?: string; metadata?: string; attributes?: Record<string, string>; video: VideoGrant }, ttlSec: number): string {
  const { identity, ...rest } = claims
  return jwt.sign(rest, env.LIVEKIT_API_SECRET, {
    algorithm: 'HS256',
    issuer: env.LIVEKIT_API_KEY,
    expiresIn: ttlSec,
    notBefore: 0,
    ...(identity ? { subject: identity, jwtid: identity } : {}),
  })
}

/** A visitor's token: join one room, speak with the microphone only, listen, send data. */
export function visitorToken(opts: {
  room: string
  identity: string
  name: string
  metadata: Record<string, unknown>
  /** Read by the agent when the visitor joins; Solef picks its agent from `prolife.agent_id`. */
  attributes?: Record<string, string>
  ttlSec: number
}): string {
  return sign(
    {
      identity: opts.identity,
      name: opts.name,
      metadata: JSON.stringify(opts.metadata),
      attributes: { source: 'widget', ...opts.attributes },
      video: {
        room: opts.room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: ['microphone'],
      },
    },
    opts.ttlSec,
  )
}

/**
 * Creates the room before the visitor joins, so the agent dispatched into it
 * finds its routing metadata (the agent's number) on the room from the start.
 * A named agent is dispatched explicitly; otherwise the server's automatic
 * dispatch sends whichever agent workers are registered without a name.
 */
export async function createCallRoom(opts: {
  name: string
  metadata: Record<string, unknown>
  agentName?: string
}): Promise<void> {
  const admin = sign({ video: { roomCreate: true, roomAdmin: true, room: opts.name } }, 60)
  const metadata = JSON.stringify(opts.metadata)
  const body: Record<string, unknown> = {
    name: opts.name,
    metadata,
    // Nobody left: close the room quickly rather than hold an agent in it.
    empty_timeout: 30,
    departure_timeout: 10,
    max_participants: 4,
  }
  if (opts.agentName) body.agents = [{ agent_name: opts.agentName, metadata }]
  const res = await fetch(`${httpBase()}/twirp/livekit.RoomService/CreateRoom`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${admin}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    throw Object.assign(new Error(`LiveKit refused the room (${res.status}): ${detail}`), { status: res.status })
  }
}

/** Short, unguessable, and only characters every LiveKit room name accepts. */
export function callId(): string {
  return randomBytes(9).toString('base64url')
}
