import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { checkIfAtBottom, checkIfAtTop, scrollToBottom } from '@/features/conversation/utils/scroll-utils'
import { throttle } from '@/lib/throttle'

const SCROLL_THROTTLE_MS = 100 // Throttle scroll handler to run every 100ms

interface UseConversationScrollOptions {
  messages: Array<{ ulid: string }>
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  onReachBottom?: () => void
}

export function useConversationScroll({
  messages,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  onReachBottom,
}: UseConversationScrollOptions) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const previousMessagesLengthRef = useRef(messages.length)
  const isUserScrollingRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const scrollPositionBeforeLoadRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)
  const wasLoadingRef = useRef(false)

  // Handle scroll events (throttled to reduce overhead)
  const handleScrollInternal = useCallback(() => {
    if (!scrollContainerRef.current) return

    const atBottom = checkIfAtBottom(scrollContainerRef.current)
    const atTop = checkIfAtTop(scrollContainerRef.current)
    setIsAtBottom(atBottom)

    // Load more messages when scrolling to top
    if (atTop && hasMore && onLoadMore && !isLoadingMore) {
      onLoadMore()
    }

    // Call callback when reaching bottom
    if (atBottom && messages.length > 0) {
      onReachBottom?.()
    }
  }, [hasMore, onLoadMore, isLoadingMore, messages.length, onReachBottom])

  // Throttled scroll handler to reduce overhead from frequent scroll events
  const handleScroll = useMemo(() => throttle(handleScrollInternal, SCROLL_THROTTLE_MS), [handleScrollInternal])

  // Initialize: scroll to bottom on first load
  useLayoutEffect(() => {
    if (!hasInitializedRef.current && messages.length > 0) {
      hasInitializedRef.current = true
      scrollToBottom(scrollContainerRef.current, 'instant')
    }
  }, [messages.length])

  // Continuously track scroll position when loading older messages
  // This captures position BEFORE React renders new messages
  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // If currently loading, continuously track the scroll position
    // This ensures we have the latest position right before new messages are rendered
    if (isLoadingMore) {
      const capturePosition = () => {
        scrollPositionBeforeLoadRef.current = {
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
        }
      }

      // Capture immediately
      capturePosition()

      // Also capture on every scroll during loading to handle user scrolling during load
      const handleScrollDuringLoad = () => capturePosition()
      container.addEventListener('scroll', handleScrollDuringLoad, { passive: true })

      return () => {
        container.removeEventListener('scroll', handleScrollDuringLoad)
      }
    }
  }, [isLoadingMore])

  // Restore scroll position after new messages are rendered
  useLayoutEffect(() => {
    const container = scrollContainerRef.current

    // Detect when loading completes: was loading, now not loading
    const justFinishedLoading = wasLoadingRef.current && !isLoadingMore
    wasLoadingRef.current = isLoadingMore

    if (justFinishedLoading && scrollPositionBeforeLoadRef.current && container) {
      const { scrollTop: capturedScrollTop, scrollHeight: capturedScrollHeight } = scrollPositionBeforeLoadRef.current

      // The new messages have been rendered, calculate the height difference
      requestAnimationFrame(() => {
        if (container && scrollPositionBeforeLoadRef.current) {
          const newScrollHeight = container.scrollHeight
          const heightDifference = newScrollHeight - capturedScrollHeight
          const newScrollTop = capturedScrollTop + heightDifference

          container.scrollTop = newScrollTop
          scrollPositionBeforeLoadRef.current = null
        }
      })
    }
  }, [isLoadingMore, messages.length])

  // Auto-scroll when new messages arrive, but only if user is at bottom
  // TODO: this should be handled on Pusher message received event
  useLayoutEffect(() => {
    const previousLength = previousMessagesLengthRef.current
    const currentLength = messages.length

    // Only auto-scroll if:
    // 1. New messages were added (length increased)
    // 2. User is at bottom
    // 3. Not currently user-scrolling
    // 4. Not loading more messages (to avoid scroll jump when loading older messages)
    if (currentLength > previousLength && isAtBottom && !isUserScrollingRef.current && !isLoadingMore) {
      scrollToBottom(scrollContainerRef.current, 'smooth')
    }

    previousMessagesLengthRef.current = currentLength
  }, [messages.length, isAtBottom, isLoadingMore])

  // Track user scrolling to prevent auto-scroll during manual scroll
  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let scrollTimeout: NodeJS.Timeout

    const handleScrollStart = () => {
      isUserScrollingRef.current = true
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false
      }, 100)
    }

    container.addEventListener('scroll', handleScrollStart, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScrollStart)
      clearTimeout(scrollTimeout)
    }
  }, [])

  return {
    scrollContainerRef,
    isAtBottom,
    handleScroll,
  }
}
