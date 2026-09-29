/**
 * SSE transport (opt-in): replaces Pusher for widgets served by an engine that
 * streams over HTTP. Enabled when window.PairAiWidgetSettings.transport === 'sse'
 * (passed by the SDK via the iframe URL). It feeds the exact same sinks the
 * Pusher path uses — the streaming store for deltas and the message-cache
 * writer for final messages — so the whole conversation UI works unchanged.
 */
import { env } from '@/core/env'
import { queryClient } from '@/queryClient'
import { tokenStorage } from '@/core/token-storage'
import { streamingStore } from '@/features/conversation/stores/streaming-store'
import { handleIncomingPusherMessage } from '@/features/conversation/utils/handle-pusher-message'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function isSseTransport(): boolean {
  try {
    return (window.PairAiWidgetSettings as { transport?: string } | undefined)?.transport === 'sse'
  } catch {
    return false
  }
}

const active = new Map<string, AbortController>()

interface SseEvent {
  event: 'thinking' | 'delta' | 'complete' | 'message'
  conversation_id: string
  stream_id?: string
  delta?: string
  seq?: number
  text?: string
  message?: unknown
}

export function sseSubscribe(conversationId: string): void {
  if (active.has(conversationId)) return
  const widgetId = getWidgetId()
  if (!widgetId) return
  const ctrl = new AbortController()
  active.set(conversationId, ctrl)
  void run(widgetId, conversationId, ctrl).finally(() => {
    if (active.get(conversationId) === ctrl) active.delete(conversationId)
  })
}

async function run(widgetId: string, conversationId: string, ctrl: AbortController, attempt = 0): Promise<void> {
  const url = `${env.baseURL}/v1/widget/${widgetId}/conversations/${conversationId}/stream`
  // Watchdog: a turn whose final message never lands (server restart, dropped
  // turn) must not leave the provisional bubble spinning forever — clear the
  // stream and refetch the persisted messages instead.
  let watchdog: ReturnType<typeof setTimeout> | undefined
  const disarm = () => {
    if (watchdog) clearTimeout(watchdog)
    watchdog = undefined
  }
  const arm = () => {
    disarm()
    watchdog = setTimeout(() => {
      logger.debug('sseSubscribe', 'stream stalled — clearing and refetching', { conversationId })
      streamingStore.removeStreamsForConversation(conversationId)
      void queryClient.invalidateQueries({
        queryKey: ['conversations', widgetId, conversationId, 'messages'],
        exact: false,
      })
    }, 45000)
  }
  try {
    const token = tokenStorage.get(widgetId)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok || !res.body) throw new Error(`stream http ${res.status}`)
    logger.debug('sseSubscribe', 'connected', { conversationId })
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let tail = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      tail += dec.decode(value, { stream: true })
      const lines = tail.split('\n')
      tail = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        let e: SseEvent
        try {
          e = JSON.parse(line.slice(5)) as SseEvent
        } catch {
          continue
        }
        if (e.event === 'thinking' && e.stream_id) {
          arm()
          streamingStore.handleThinking(conversationId, e.stream_id, e.text ?? '')
        } else if (e.event === 'delta' && e.stream_id && typeof e.delta === 'string') {
          arm()
          streamingStore.handleDelta(conversationId, e.stream_id, e.delta, e.seq ?? 0)
        } else if (e.event === 'complete' && e.stream_id) {
          arm()
          streamingStore.handleComplete(conversationId, e.stream_id)
        } else if (e.event === 'message' && e.message) {
          disarm()
          // the cache writer expects the Pusher envelope shape: { message, conversationUlid }
          handleIncomingPusherMessage(conversationId, { message: e.message, conversationUlid: conversationId })
          streamingStore.removeStreamsForConversation(conversationId)
        }
      }
    }
  } catch (err) {
    if (ctrl.signal.aborted) {
      disarm()
      return
    }
    logger.debug('sseSubscribe', 'stream dropped, retrying', { conversationId, attempt, err: (err as Error).message })
  }
  disarm()
  if (!ctrl.signal.aborted) {
    // the server keeps the stream open; reaching here means it dropped — back off and reconnect
    await new Promise((r) => setTimeout(r, Math.min(15000, 1000 * 2 ** attempt)))
    if (!ctrl.signal.aborted) return run(widgetId, conversationId, ctrl, attempt + 1)
  }
}

export function sseUnsubscribeAll(): void {
  for (const ctrl of active.values()) ctrl.abort()
  active.clear()
}
