import { useSyncExternalStore } from 'react'

import { streamingStore } from '@/features/conversation/stores/streaming-store'
import type { StreamState } from '@/features/conversation/stores/streaming-store'

/**
 * React hook that subscribes to the streaming store and returns the active
 * stream for a given conversation. Re-renders only when the store changes.
 *
 * @param conversationId - The conversation to watch, or null
 * @returns activeStream and a convenience hasActiveStream flag
 */
export function useStreaming(conversationId: string | null): {
  activeStream: StreamState | null
  hasActiveStream: boolean
} {
  // Subscribe to store changes — the snapshot value itself drives re-renders
  // even though we read the active stream imperatively below.
  useSyncExternalStore(streamingStore.subscribe, streamingStore.getSnapshot)

  const activeStream = conversationId ? streamingStore.getActiveStreamForConversation(conversationId) : null

  return {
    activeStream,
    hasActiveStream: activeStream !== null,
  }
}
