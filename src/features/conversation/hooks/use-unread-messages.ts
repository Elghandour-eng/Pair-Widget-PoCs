import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { Message } from '@/features/conversation/types/message'
import { useMessageReadTracking } from './use-message-read-tracking'

interface UseUnreadMessagesOptions {
  messages: Message[]
  isAtBottom: boolean
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  isLoadingMore: boolean
  onMarkAllAsRead?: () => void
}

export function useUnreadMessages({
  messages,
  isAtBottom,
  scrollContainerRef,
  isLoadingMore,
  onMarkAllAsRead,
}: UseUnreadMessagesOptions) {
  const [lastReadIndex, setLastReadIndex] = useState<number>(-1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUnreadButton, setShowUnreadButton] = useState(false)
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set())
  const unreadButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousMessagesLengthRef = useRef(messages.length)
  const wasLoadingRef = useRef(false)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Helper function to count unread messages (excluding user's own messages)
  const countUnreadMessages = useCallback(
    (fromIndex: number) => {
      let count = 0
      for (let i = fromIndex + 1; i < messages.length; i++) {
        // Only count messages that are not from the user (contact)
        if (messages[i].sender_type !== 'contact') {
          count++
        }
      }
      return count
    },
    [messages],
  )

  // Mark all messages as read
  const markAllAsRead = useCallback(() => {
    setLastReadIndex(messages.length - 1)
    const allMessageIds = new Set(messages.map((m) => m.ulid))
    setReadMessages(allMessageIds)
    setUnreadCount(0)
    setShowUnreadButton(false)
    // Clear any pending timeout
    if (unreadButtonTimeoutRef.current) {
      clearTimeout(unreadButtonTimeoutRef.current)
      unreadButtonTimeoutRef.current = null
    }
    onMarkAllAsRead?.()
  }, [messages, onMarkAllAsRead])

  // Initialize: mark all messages as read on first load
  useLayoutEffect(() => {
    if (messages.length > 0 && lastReadIndex < 0) {
      markAllAsRead()
    }
  }, [messages.length, messages, lastReadIndex, markAllAsRead])

  // Adjust lastReadIndex when messages are prepended at the top (when loading older messages)
  useLayoutEffect(() => {
    // Detect when loading completes: was loading, now not loading
    const justFinishedLoading = wasLoadingRef.current && !isLoadingMore
    wasLoadingRef.current = isLoadingMore

    const previousLength = previousMessagesLengthRef.current
    const currentLength = messages.length
    const messagesAdded = currentLength - previousLength

    // Adjust lastReadIndex when messages are prepended at the top
    // When new messages are added at the top, old messages shift down by messagesAdded
    // So we need to adjust lastReadIndex by adding messagesAdded to maintain the same logical position
    if (justFinishedLoading && messagesAdded > 0 && lastReadIndex >= 0) {
      const adjustedLastReadIndex = lastReadIndex + messagesAdded
      setLastReadIndex(adjustedLastReadIndex)
    }

    previousMessagesLengthRef.current = currentLength
  }, [messages.length, lastReadIndex, isLoadingMore])

  // Track unread messages (messages after last read index, excluding user messages)
  useEffect(() => {
    if (lastReadIndex < 0 && messages.length > 0) {
      // Initialize: mark all messages as read if at bottom
      if (isAtBottom) {
        markAllAsRead()
      }
    } else if (messages.length > lastReadIndex + 1) {
      // New messages arrived after last read
      if (!isAtBottom) {
        const newUnreadCount = countUnreadMessages(lastReadIndex)
        setUnreadCount(newUnreadCount)

        // Clear any existing timeout
        if (unreadButtonTimeoutRef.current) {
          clearTimeout(unreadButtonTimeoutRef.current)
        }

        // Show button after 100ms delay
        unreadButtonTimeoutRef.current = setTimeout(() => {
          setShowUnreadButton(true)
        }, 100)
      } else {
        // If at bottom, don't show the button
        setShowUnreadButton(false)
        if (unreadButtonTimeoutRef.current) {
          clearTimeout(unreadButtonTimeoutRef.current)
          unreadButtonTimeoutRef.current = null
        }
      }
    } else {
      // No unread messages
      setShowUnreadButton(false)
      if (unreadButtonTimeoutRef.current) {
        clearTimeout(unreadButtonTimeoutRef.current)
        unreadButtonTimeoutRef.current = null
      }
    }

    return () => {
      if (unreadButtonTimeoutRef.current) {
        clearTimeout(unreadButtonTimeoutRef.current)
      }
    }
  }, [messages.length, lastReadIndex, isAtBottom, countUnreadMessages, markAllAsRead])

  // Handle marking a message as read (after 5 second fade timer)
  const handleMarkMessageAsRead = useCallback((messageId: string) => {
    setReadMessages((prev) => new Set(prev).add(messageId))
  }, [])

  // Handle updating last read index (immediately when message comes into view)
  const handleUpdateLastReadIndex = useCallback(
    (messageIndex: number) => {
      setLastReadIndex(messageIndex)
      // Recalculate unread count
      const remainingUnread = countUnreadMessages(messageIndex)
      setUnreadCount(remainingUnread)
    },
    [countUnreadMessages],
  )

  // Use intersection observer to track message reads
  useMessageReadTracking({
    messages,
    scrollContainerRef,
    messageRefs,
    lastReadIndex,
    readMessages,
    onMarkMessageAsRead: handleMarkMessageAsRead,
    onUpdateLastReadIndex: handleUpdateLastReadIndex,
  })

  // Set message ref callback
  const setMessageRef = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element)
    } else {
      messageRefs.current.delete(messageId)
    }
  }, [])

  // Check if a message is unread
  const isUnread = useCallback(
    (index: number, messageId: string) => {
      return index > lastReadIndex && !readMessages.has(messageId)
    },
    [lastReadIndex, readMessages],
  )

  return {
    lastReadIndex,
    unreadCount,
    showUnreadButton,
    readMessages,
    messageRefs,
    setMessageRef,
    isUnread,
    markAllAsRead,
  }
}
