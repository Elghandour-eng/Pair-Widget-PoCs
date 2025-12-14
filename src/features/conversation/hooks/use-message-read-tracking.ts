import { useEffect, useRef } from 'react'

import type { Message } from '@/features/conversation/types/message'

interface UseMessageReadTrackingOptions {
  messages: Message[]
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  messageRefs: React.RefObject<Map<string, HTMLDivElement>>
  lastReadIndex: number
  readMessages: Set<string>
  onMarkMessageAsRead: (messageId: string) => void
  onUpdateLastReadIndex: (messageIndex: number) => void
}

export function useMessageReadTracking({
  messages,
  scrollContainerRef,
  messageRefs,
  lastReadIndex,
  readMessages,
  onMarkMessageAsRead,
  onUpdateLastReadIndex,
}: UseMessageReadTrackingOptions) {
  const fadeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Intersection Observer to mark messages as read when they come into viewport
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || messages.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageElement = entry.target as HTMLDivElement
            const messageId = messageElement.dataset.messageId
            if (messageId) {
              const messageIndex = messages.findIndex((m) => m.ulid === messageId)
              if (messageIndex !== -1) {
                const message = messages[messageIndex]
                // If message is unread and not already being processed, start fade timer
                if (!readMessages.has(messageId) && messageIndex > lastReadIndex && message.sender_type !== 'contact') {
                  // Clear any existing timeout for this message
                  const existingTimeout = fadeTimeoutsRef.current.get(messageId)
                  if (existingTimeout) {
                    clearTimeout(existingTimeout)
                  }

                  // Start 5 second timer to fade the indicator (mark as read after 5 seconds)
                  const timeoutId = setTimeout(() => {
                    onMarkMessageAsRead(messageId)
                    fadeTimeoutsRef.current.delete(messageId)
                  }, 5000)
                  fadeTimeoutsRef.current.set(messageId, timeoutId)
                }

                // Update last read index if this is a new message (not user's own)
                if (messageIndex > lastReadIndex && message.sender_type !== 'contact') {
                  // Find the highest read index (may skip user messages)
                  let newLastReadIndex = messageIndex
                  // Update to the highest unread message index
                  onUpdateLastReadIndex(newLastReadIndex)
                } else if (messageIndex > lastReadIndex) {
                  // Even if it's a user message, update the index to track position
                  onUpdateLastReadIndex(messageIndex)
                }
              }
            }
          } else {
            // If message leaves viewport, clear the fade timeout
            const messageElement = entry.target as HTMLDivElement
            const messageId = messageElement.dataset.messageId
            if (messageId) {
              const timeoutId = fadeTimeoutsRef.current.get(messageId)
              if (timeoutId) {
                clearTimeout(timeoutId)
                fadeTimeoutsRef.current.delete(messageId)
              }
            }
          }
        })
      },
      {
        root: container,
        rootMargin: '0px',
        threshold: 0.5, // Message is considered visible when 50% is in viewport
      },
    )

    // Observe all message elements that are currently in the DOM
    // Use a small delay to ensure DOM is updated after messages change
    const timeoutId = setTimeout(() => {
      messageRefs.current.forEach((element) => {
        observer.observe(element)
      })
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      // Clear all fade timeouts
      fadeTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      fadeTimeoutsRef.current.clear()
      observer.disconnect()
    }
  }, [
    messages,
    lastReadIndex,
    readMessages,
    scrollContainerRef,
    messageRefs,
    onMarkMessageAsRead,
    onUpdateLastReadIndex,
  ])
}
