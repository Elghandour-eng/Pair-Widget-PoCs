import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamState {
  conversationId: string
  streamId: string
  /** Accumulated answer text (from contiguous deltas) */
  text: string
  /** Latest thinking status text (transient, not part of the answer) */
  thinking: string
  /** Next expected sequence number for contiguous flushing */
  nextSeq: number
  /** Out-of-order deltas waiting to be flushed */
  pending: Map<number, string>
  /** Whether widget.message.complete has arrived */
  completeSeen: boolean
  /** Last time this stream was updated (for stale cleanup) */
  updatedAt: number
}

/** Immutable snapshot exposed to React */
export interface StreamingSnapshot {
  /** All active streams keyed by streamId */
  streams: ReadonlyMap<string, StreamState>
  /** Monotonically increasing version counter for change detection */
  version: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Streams older than this are removed automatically */
const STALE_TIMEOUT_MS = 60_000 // 60 seconds
/** How often to check for stale streams */
const CLEANUP_INTERVAL_MS = 15_000 // 15 seconds

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

type Listener = () => void

const streams = new Map<string, StreamState>()
const listeners = new Set<Listener>()
let version = 0
let cleanupInterval: ReturnType<typeof setInterval> | null = null

function emitChange(): void {
  version += 1
  for (const listener of listeners) {
    listener()
  }
}

// ---------------------------------------------------------------------------
// Stale cleanup
// ---------------------------------------------------------------------------

function startCleanupIfNeeded(): void {
  if (cleanupInterval !== null) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    let changed = false
    for (const [streamId, state] of streams) {
      if (now - state.updatedAt > STALE_TIMEOUT_MS) {
        logger.debug('streamingStore', 'Removing stale stream', {
          streamId,
          conversationId: state.conversationId,
          age: now - state.updatedAt,
        })
        streams.delete(streamId)
        changed = true
      }
    }
    if (changed) emitChange()
    if (streams.size === 0) stopCleanup()
  }, CLEANUP_INTERVAL_MS)
}

function stopCleanup(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getOrCreateStream(streamId: string, conversationId: string): StreamState {
  let state = streams.get(streamId)
  if (!state) {
    state = {
      conversationId,
      streamId,
      text: '',
      thinking: '',
      nextSeq: 0,
      pending: new Map(),
      completeSeen: false,
      updatedAt: Date.now(),
    }
    streams.set(streamId, state)
    startCleanupIfNeeded()
    logger.debug('streamingStore', 'Created new stream', { streamId, conversationId })
  }
  return state
}

// ---------------------------------------------------------------------------
// Public mutation API (called from Pusher event handlers)
// ---------------------------------------------------------------------------

function handleThinking(conversationId: string, streamId: string, text: string): void {
  const state = getOrCreateStream(streamId, conversationId)
  state.thinking = text
  state.updatedAt = Date.now()
  logger.debug('streamingStore', 'Thinking update', { streamId, text: text.substring(0, 80) })
  emitChange()
}

function handleDelta(conversationId: string, streamId: string, delta: string, seq: number): void {
  const state = getOrCreateStream(streamId, conversationId)

  // Duplicate: already rendered or already buffered
  if (seq < state.nextSeq || state.pending.has(seq)) {
    logger.debug('streamingStore', 'Duplicate delta ignored', { streamId, seq, nextSeq: state.nextSeq })
    return
  }

  // Buffer the delta
  state.pending.set(seq, delta)

  // Flush contiguous sequence
  while (state.pending.has(state.nextSeq)) {
    state.text += state.pending.get(state.nextSeq)!
    state.pending.delete(state.nextSeq)
    state.nextSeq += 1
  }

  // Clear thinking text once real content starts arriving
  state.thinking = ''
  state.updatedAt = Date.now()

  logger.debug('streamingStore', 'Delta processed', {
    streamId,
    seq,
    nextSeq: state.nextSeq,
    textLength: state.text.length,
    pendingCount: state.pending.size,
  })

  emitChange()
}

function handleComplete(conversationId: string, streamId: string): void {
  const state = getOrCreateStream(streamId, conversationId)
  state.completeSeen = true
  state.updatedAt = Date.now()
  logger.debug('streamingStore', 'Stream complete', { streamId, textLength: state.text.length })
  emitChange()
}

function removeStreamsForConversation(conversationId: string): void {
  let changed = false
  for (const [streamId, state] of streams) {
    if (state.conversationId === conversationId) {
      logger.debug('streamingStore', 'Removing stream for conversation', { streamId, conversationId })
      streams.delete(streamId)
      changed = true
    }
  }
  if (changed) {
    if (streams.size === 0) stopCleanup()
    emitChange()
  }
}

// ---------------------------------------------------------------------------
// Public query API
// ---------------------------------------------------------------------------

function getActiveStreamForConversation(conversationId: string): StreamState | null {
  for (const state of streams.values()) {
    if (state.conversationId === conversationId) {
      return state
    }
  }
  return null
}

function hasActiveStream(conversationId: string): boolean {
  return getActiveStreamForConversation(conversationId) !== null
}

// ---------------------------------------------------------------------------
// React integration (useSyncExternalStore)
// ---------------------------------------------------------------------------

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): number {
  return version
}

// ---------------------------------------------------------------------------
// Exported singleton
// ---------------------------------------------------------------------------

export const streamingStore = {
  // Mutations
  handleThinking,
  handleDelta,
  handleComplete,
  removeStreamsForConversation,

  // Queries
  getActiveStreamForConversation,
  hasActiveStream,

  // React integration
  subscribe,
  getSnapshot,
} as const
