import { useSyncExternalStore } from 'react'
import type { LocalAudioTrack, RemoteAudioTrack, Room } from 'livekit-client'

import { env } from '@/core/env'
import { publicApiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * One voice call at a time, outside React: the call outlives the screens it is
 * started from (and, when the design allows it, the panel being closed), so its
 * state lives here and every component reads it through `useVoiceCall()`.
 *
 * livekit-client is imported when a call starts, not with the widget: most
 * visitors never call, and it is the heaviest thing the call needs.
 */

export type CallStatus = 'idle' | 'confirm' | 'connecting' | 'live' | 'ended' | 'failed'
/** Why a call stopped, which picks the line the ended / failed screen shows. */
export type CallEndReason = 'hangup' | 'remote' | 'timeLimit' | 'failed' | 'micDenied' | 'unavailable'
export type AgentState = 'initializing' | 'listening' | 'thinking' | 'speaking'

export interface Caption {
  id: string
  /** Who said it: the agent, or the visitor (their own speech, transcribed). */
  from: 'agent' | 'visitor'
  text: string
  final: boolean
}

export interface CallState {
  status: CallStatus
  reason?: CallEndReason
  startedAt?: number
  muted: boolean
  agentState?: AgentState
  /** The browser blocked playback until the visitor interacts again. */
  audioBlocked: boolean
  captions: Caption[]
  /** The call screen is folded into a bar so the chat stays usable. */
  minimized: boolean
}

const IDLE: CallState = { status: 'idle', muted: false, audioBlocked: false, captions: [], minimized: false }

let state: CallState = IDLE
const listeners = new Set<() => void>()

function setState(patch: Partial<CallState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useVoiceCall(): CallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function getCallState(): CallState {
  return state
}

/** The host page hears about the call the same way it hears everything else. */
function tellHost(type: string, data?: Record<string, unknown>) {
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage({ type, data }, '*')
  } catch {
    // A detached frame has no one to tell.
  }
}

/* ---------------------------------- call ---------------------------------- */

let room: Room | null = null
let micTrack: LocalAudioTrack | null = null
let agentTrack: RemoteAudioTrack | null = null
let audioHost: HTMLDivElement | null = null
let limitTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
const analysers: { agent?: Analyser; visitor?: Analyser } = {}

interface Analyser {
  calculateVolume: () => number
  analyser: AnalyserNode
  cleanup: () => Promise<void>
}

export interface StartOptions {
  lang: string
  maxDurationSec: number
  /** Ask first, or dial straight away (a host page's own button already asked). */
  confirm: boolean
}

/** The studio's own origin: a view-forced base (/pv/…, /lang/…) has no call route. */
function callBase(): string {
  return env.baseURL.replace(/\/$/, '').replace(/\/(pv\/[^/]+\/[^/]+|lang\/[^/]+)$/, '')
}

function visitorId(): string {
  const key = `pair_widget_visitor_${getWidgetId() ?? ''}`
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    localStorage.setItem(key, id)
    return id
  } catch {
    return Math.random().toString(36).slice(2, 14)
  }
}

let pending: StartOptions | null = null

/** The phone button: shows the confirmation, or dials when the design does not ask. */
export function requestCall(opts: StartOptions) {
  if (state.status === 'connecting' || state.status === 'live') {
    setState({ minimized: false })
    return
  }
  if (opts.confirm) {
    pending = opts
    setState({ ...IDLE, status: 'confirm' })
    return
  }
  void startCall(opts)
}

export function confirmCall() {
  if (state.status !== 'confirm' || !pending) return
  const opts = pending
  pending = null
  void startCall(opts)
}

export function dismissCall() {
  if (state.status === 'connecting' || state.status === 'live') return
  pending = null
  setState(IDLE)
}

export function setMinimized(minimized: boolean) {
  if (state.status === 'connecting' || state.status === 'live') setState({ minimized })
}

async function startCall(opts: StartOptions) {
  const mine = ++attempt
  setState({ ...IDLE, status: 'connecting' })
  tellHost('widget:callState', { status: 'connecting' })

  const lk = await import('livekit-client')

  // The microphone first: a visitor who refuses it never wakes an agent up.
  try {
    micTrack = await lk.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })
  } catch (err) {
    logger.debug('startCall', 'microphone refused', err)
    return fail('micDenied')
  }
  if (mine !== attempt) return micTrack.stop()

  let grant: { url: string; token: string; room: string; maxDurationSec?: number }
  try {
    const res = await publicApiClient.post(
      `/v1/widget/${getWidgetId()}/call`,
      {
        lang: opts.lang,
        visitorId: visitorId(),
        userId: window.PairAiWidgetSettings?.userId,
        page: document.referrer || undefined,
      },
      { baseURL: callBase() },
    )
    grant = res.data
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status
    logger.debug('startCall', 'no call granted', err)
    return fail(status === 503 ? 'unavailable' : 'failed')
  }
  if (mine !== attempt) return cleanup()

  const r = new lk.Room({ adaptiveStream: false, dynacast: false, disconnectOnPageLeave: true })
  room = r

  r.on(lk.RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== lk.Track.Kind.Audio) return
    agentTrack = track as RemoteAudioTrack
    if (!audioHost) {
      audioHost = document.createElement('div')
      audioHost.style.display = 'none'
      document.body.appendChild(audioHost)
    }
    audioHost.appendChild(track.attach())
    try {
      analysers.agent = lk.createAudioAnalyser(agentTrack, { fftSize: 64, smoothingTimeConstant: 0.75 })
    } catch {
      // No Web Audio: the call still works, the visualizer just stays still.
    }
  })
  r.on(lk.RoomEvent.TrackUnsubscribed, (track) => {
    track.detach().forEach((el) => el.remove())
  })
  r.on(lk.RoomEvent.AudioPlaybackStatusChanged, () => setState({ audioBlocked: !r.canPlaybackAudio }))
  r.on(lk.RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
    const s = participant.attributes?.['lk.agent.state']
    if (s === 'listening' || s === 'thinking' || s === 'speaking' || s === 'initializing') setState({ agentState: s })
  })
  r.on(lk.RoomEvent.Disconnected, () => {
    if (room !== r) return
    finish(state.status === 'live' ? 'remote' : 'failed')
  })
  // Captions from LiveKit Agents 1.x: one text stream per segment, delta chunks.
  r.registerTextStreamHandler('lk.transcription', async (reader, participant) => {
    const id = reader.info.attributes?.['lk.segment_id'] ?? reader.info.id
    const from: Caption['from'] = participant.identity === r.localParticipant.identity ? 'visitor' : 'agent'
    let text = ''
    for await (const chunk of reader) {
      text += chunk
      upsertCaption({ id, from, text, final: false })
    }
    upsertCaption({ id, from, text, final: true })
  })
  // …and from older agents, which send whole segments.
  r.on(lk.RoomEvent.TranscriptionReceived, (segments, participant) => {
    const from: Caption['from'] = participant?.identity === r.localParticipant.identity ? 'visitor' : 'agent'
    segments.forEach((s) => upsertCaption({ id: s.id, from, text: s.text, final: s.final }))
  })

  try {
    await r.connect(grant.url, grant.token, { autoSubscribe: true })
    await r.localParticipant.publishTrack(micTrack, { source: lk.Track.Source.Microphone })
    await r.startAudio().catch(() => undefined)
  } catch (err) {
    logger.debug('startCall', 'could not join the room', err)
    return fail('failed')
  }
  if (mine !== attempt) return cleanup()

  try {
    analysers.visitor = lk.createAudioAnalyser(micTrack, { fftSize: 64, smoothingTimeConstant: 0.8 })
  } catch {
    // As above: no Web Audio, no levels.
  }

  const limit = grant.maxDurationSec ?? opts.maxDurationSec
  if (limit > 0) limitTimer = setTimeout(() => finish('timeLimit'), limit * 1000)
  setState({ status: 'live', startedAt: Date.now(), audioBlocked: !r.canPlaybackAudio, agentState: 'initializing' })
  tellHost('widget:callStarted', { room: grant.room })
}

function upsertCaption(c: Caption) {
  const i = state.captions.findIndex((x) => x.id === c.id)
  const captions = i === -1 ? [...state.captions, c] : state.captions.map((x, j) => (j === i ? c : x))
  // A few lines are a caption; more is a transcript, which is the chat's job.
  setState({ captions: captions.filter((x) => x.text.trim()).slice(-4) })
}

export function endCall() {
  if (state.status === 'connecting' || state.status === 'live') finish('hangup')
}

export function toggleMute() {
  if (!micTrack || state.status !== 'live') return
  const muted = !state.muted
  void (muted ? micTrack.mute() : micTrack.unmute())
  setState({ muted })
}

/** A blocked autoplay is released by any tap; the call screen calls this on one. */
export function resumeAudio() {
  if (room && !room.canPlaybackAudio) void room.startAudio().then(() => setState({ audioBlocked: false }))
}

/** Sound levels 0–1 and the agent's spectrum, for the visualizer's animation frame. */
export function callLevels(): { agent: number; visitor: number; bins: Uint8Array | null } {
  let bins: Uint8Array<ArrayBuffer> | null = null
  if (analysers.agent) {
    bins = new Uint8Array(new ArrayBuffer(analysers.agent.analyser.frequencyBinCount))
    analysers.agent.analyser.getByteFrequencyData(bins)
  }
  return {
    agent: analysers.agent?.calculateVolume() ?? 0,
    visitor: state.muted ? 0 : (analysers.visitor?.calculateVolume() ?? 0),
    bins,
  }
}

function fail(reason: CallEndReason) {
  cleanup()
  setState({ status: 'failed', reason, minimized: false })
  tellHost('widget:callEnded', { reason })
}

function finish(reason: CallEndReason) {
  const wasLive = state.status === 'live'
  const duration = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0
  cleanup()
  setState({ status: 'ended', reason, minimized: false, agentState: undefined })
  if (wasLive || reason === 'hangup') tellHost('widget:callEnded', { reason, durationSec: duration })
}

function cleanup() {
  attempt++
  if (limitTimer) clearTimeout(limitTimer)
  limitTimer = null
  void analysers.agent?.cleanup().catch(() => undefined)
  void analysers.visitor?.cleanup().catch(() => undefined)
  analysers.agent = analysers.visitor = undefined
  const r = room
  room = null
  if (r) void r.disconnect()
  micTrack?.stop()
  micTrack = null
  agentTrack = null
  audioHost?.remove()
  audioHost = null
}

// Leaving the page hangs up cleanly instead of leaving the agent talking to no one.
window.addEventListener('pagehide', () => {
  if (state.status === 'connecting' || state.status === 'live') cleanup()
})
