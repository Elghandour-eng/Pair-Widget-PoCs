import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { checkIfAtBottom, checkIfAtTop, scrollToBottom } from '@/features/conversation/utils/scroll-utils'
import { throttle } from '@/lib/throttle'

const SCROLL_THROTTLE_MS = 100 // Throttle scroll handler to run every 100ms
// How long after a wheel/touch/key the scrolling still counts as the visitor's own
// (covers momentum scrolling on touch screens).
const USER_SCROLL_WINDOW_MS = 1000

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
  const contentRef = useRef<HTMLDivElement>(null)
  // True while the view follows the newest message. Only the visitor scrolling
  // up turns it off; our own scrolls (and a smooth scroll still in flight) never do.
  const [isAtBottom, setIsAtBottom] = useState(true)
  const followRef = useRef(true)
  const userScrollAtRef = useRef(0)
  const isLoadingMoreRef = useRef(isLoadingMore)
  isLoadingMoreRef.current = isLoadingMore
  const previousMessagesLengthRef = useRef(messages.length)
  const hasInitializedRef = useRef(false)
  const scrollPositionBeforeLoadRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)
  const wasLoadingRef = useRef(false)

  const setFollow = useCallback((follow: boolean) => {
    followRef.current = follow
    setIsAtBottom(follow)
  }, [])

  // Handle scroll events (throttled to reduce overhead)
  const handleScrollInternal = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const atBottom = checkIfAtBottom(container)
    const atTop = checkIfAtTop(container)
    const byUser = Date.now() - userScrollAtRef.current < USER_SCROLL_WINDOW_MS
    if (atBottom) setFollow(true)
    else if (byUser) setFollow(false)

    // Load more messages when scrolling to top
    if (atTop && hasMore && onLoadMore && !isLoadingMore) {
      onLoadMore()
    }

    // Call callback when reaching bottom
    if (atBottom && messages.length > 0) {
      onReachBottom?.()
    }
  }, [hasMore, onLoadMore, isLoadingMore, messages.length, onReachBottom, setFollow])

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
          setFollow(checkIfAtBottom(container))
        }
      })
    }
  }, [isLoadingMore, messages.length, setFollow])

  // A new message while following: bring it into view
  useLayoutEffect(() => {
    const previousLength = previousMessagesLengthRef.current
    const currentLength = messages.length

    if (currentLength > previousLength && followRef.current && !isLoadingMore) {
      scrollToBottom(scrollContainerRef.current, 'instant')
    }

    previousMessagesLengthRef.current = currentLength
  }, [messages.length, isLoadingMore])

  // Anything that grows the conversation while following — a streamed reply,
  // the typing dots, an image or card that loads late — keeps the bottom in view
  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (followRef.current && !isLoadingMoreRef.current) {
        scrollToBottom(scrollContainerRef.current, 'instant')
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // Note when the visitor scrolls on their own, so only that can stop the follow
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const markUserScroll = () => {
      userScrollAtRef.current = Date.now()
    }
    // A press on the container itself is its scrollbar; taps on a message's buttons don't count
    const markScrollbar = (e: PointerEvent) => {
      if (e.target === container) markUserScroll()
    }
    const markKeyScroll = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) markUserScroll()
    }

    container.addEventListener('wheel', markUserScroll, { passive: true })
    container.addEventListener('touchmove', markUserScroll, { passive: true })
    container.addEventListener('pointerdown', markScrollbar, { passive: true })
    container.addEventListener('keydown', markKeyScroll)

    return () => {
      container.removeEventListener('wheel', markUserScroll)
      container.removeEventListener('touchmove', markUserScroll)
      container.removeEventListener('pointerdown', markScrollbar)
      container.removeEventListener('keydown', markKeyScroll)
    }
  }, [])

  return {
    scrollContainerRef,
    contentRef,
    isAtBottom,
    handleScroll,
  }
}
