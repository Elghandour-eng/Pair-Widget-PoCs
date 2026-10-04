import { useCallback, useEffect, useRef } from 'react'

import { WidgetContent } from '@/components/widget-content'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { ConversationMessage } from '@/features/conversation/components/conversation-message/conversation-message'
import { EmptyMessage } from '@/features/conversation/components/empty-message'
import { LoadMore } from '@/features/conversation/components/load-more'
import { StreamingMessage } from '@/features/conversation/components/streaming-message'
import { TypingIndicator } from '@/features/conversation/components/typing-indicator'
import { UnreadIndicator } from '@/features/conversation/components/unread-indicator'
import { useQuestionContext } from '@/features/conversation/contexts/question-context'
import { useConversationScroll } from '@/features/conversation/hooks/use-conversation-scroll'
import { useStreaming } from '@/features/conversation/hooks/use-streaming'
import type { Message, QuestionMessage } from '@/features/conversation/types/message'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { scrollToBottom } from '../utils/scroll-utils'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface ConversationMessagesProps {
  messages: Message[]
  conversationId: string | null
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
}

function ConversationMessages({
  messages: allMessages,
  conversationId,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: ConversationMessagesProps) {
  // Filter out system messages
  const messages = allMessages.filter((msg) => msg.sender_type !== 'system')
  const { widgetConfig } = useWidgetConfigContext()
  const { isOpen: isWidgetOpen } = useWidgetUIContext()
  const { unreadMessages, getFirstUnreadMessageId, markConversationAsRead, markAsRead, typingStates } =
    useUnreadMessages()
  const typingState = conversationId ? typingStates.get(conversationId) : undefined
  const isTyping = typingState?.isTyping ?? false
  const { activeQuestionGroup, setActiveQuestionGroup, dismissedQuestions } = useQuestionContext()
  const { activeStream, hasActiveStream } = useStreaming(conversationId)

  const lastMessage = messages[messages.length - 1]

  // Track if the latest message has an active question group
  useEffect(() => {
    if (lastMessage) {
      const questions: QuestionMessage[] = []
      if (lastMessage.next_msg?.type === 'question') {
        questions.push(lastMessage.next_msg as QuestionMessage)
      }
      if (lastMessage.next_messages) {
        lastMessage.next_messages.forEach((item) => {
          if (item.type === 'question') {
            questions.push(item as QuestionMessage)
          }
        })
      }

      if (questions.length > 0 && !dismissedQuestions.includes(lastMessage.ulid)) {
        if (activeQuestionGroup?.messageUlid !== lastMessage.ulid) {
          setActiveQuestionGroup({
            messageUlid: lastMessage.ulid,
            questions,
            activeQuestionIndex: 0,
          })
        }
      } else {
        if (activeQuestionGroup) {
          setActiveQuestionGroup(null)
        }
      }
    } else {
      if (activeQuestionGroup) {
        setActiveQuestionGroup(null)
      }
    }
  }, [lastMessage, setActiveQuestionGroup, activeQuestionGroup?.messageUlid, dismissedQuestions])

  // Inject greeting message if enabled and we're at the beginning of the conversation history
  if (widgetConfig.greetingEnabled && widgetConfig.greetingMessage && !hasMore) {
    // Only add if there isn't already a greeting message (check first message)
    // We check content match to avoid duplication if it was somehow persisted
    const firstMsg = messages[0]
    if (!firstMsg || firstMsg.content !== widgetConfig.greetingMessage) {
      const greetingMessage: Message = {
        ulid: 'greeting-message',
        type: 'message',
        content: widgetConfig.greetingMessage,
        message_type: 'text',
        sender_type: 'agent', // Use agent type to avoid "Bot" label/icon if specific processing exists
        sent_at: new Date().toISOString(), // Use current time or a fixed 'start' time
        status: 'delivered',
        is_csat_survey: false,
        sender_name: widgetConfig.businessName || widgetConfig.name,
        sender_avatar: widgetConfig.avatarUrl,
      }
      messages.unshift(greetingMessage)
    }
  }

  // Get unread messages for current conversation
  const conversationUnreadMessages = conversationId ? unreadMessages.get(conversationId) || [] : []
  const unreadCount = conversationUnreadMessages.length

  // Debug log whenever messages change
  logger.debug('🟣 MESSAGE:RENDER', 'ConversationMessages rendering', {
    conversationId,
    messageCount: messages.length,
    unreadCount,
    hasMore,
    isLoadingMore,
    firstMessageId: messages[0]?.ulid,
    lastMessageId: messages[messages.length - 1]?.ulid,
  })

  // Use scroll management hook
  const { scrollContainerRef, contentRef, isAtBottom, handleScroll } = useConversationScroll({
    messages,
    hasMore,
    onLoadMore,
    isLoadingMore,
    onReachBottom: () => {
      // Mark conversation as read when user scrolls to bottom
      // This ensures unread indicator is cleared when user actively views all messages
      if (conversationId && unreadCount > 0 && isWidgetOpen) {
        logger.debug('ConversationMessages', 'User reached bottom, marking conversation as read', {
          conversationId,
          unreadCount,
        })
        markConversationAsRead(conversationId)
      }
    },
  })

  // Track message elements for progressive unread marking
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Progressive unread marking with Intersection Observer
  useEffect(() => {
    if (!conversationId || conversationUnreadMessages.length === 0) {
      return
    }

    // Create observer that marks messages as read when they become visible
    const observer = new IntersectionObserver(
      (entries) => {
        const messagesToMarkAsRead: string[] = []

        entries.forEach((entry) => {
          // If message is visible (at least 50% in viewport)
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const messageId = entry.target.getAttribute('data-message-id')
            if (messageId) {
              // Check if this message is in the unread list
              const isUnread = conversationUnreadMessages.some((unread) => unread.messageId === messageId)
              if (isUnread) {
                messagesToMarkAsRead.push(messageId)
                logger.debug('Progressive mark as read', 'Message became visible', {
                  messageId,
                  conversationId,
                })
              }
            }
          }
        })

        // Mark all visible unread messages as read
        if (messagesToMarkAsRead.length > 0) {
          logger.debug('Progressive mark as read', 'Marking messages as read', {
            count: messagesToMarkAsRead.length,
            messageIds: messagesToMarkAsRead,
            conversationId,
          })
          if (isWidgetOpen) markAsRead(conversationId, messagesToMarkAsRead)
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '0px',
        threshold: [0, 0.5, 1], // Trigger when 0%, 50%, or 100% visible
      },
    )

    // Observe all unread message elements
    conversationUnreadMessages.forEach((unread) => {
      const element = messageRefs.current.get(unread.messageId)
      if (element) {
        observer.observe(element)
      }
    })

    // Cleanup
    return () => {
      observer.disconnect()
    }
  }, [conversationId, conversationUnreadMessages, markAsRead, scrollContainerRef])

  // Callback to register message elements
  const registerMessageRef = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element)
    } else {
      messageRefs.current.delete(messageId)
    }
  }, [])

  // Scroll to bottom when clicking unread indicator
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom(scrollContainerRef.current, 'smooth')
    // Messages will be marked as read progressively by Intersection Observer
  }, [scrollContainerRef])

  // Scroll to first unread message
  const handleScrollToFirstUnread = useCallback(() => {
    if (!conversationId) return

    const firstUnreadMessageId = getFirstUnreadMessageId(conversationId)
    if (!firstUnreadMessageId) {
      handleScrollToBottom()
      return
    }

    // Find the message element and scroll to it
    const messageElement = document.querySelector(`[data-message-id="${firstUnreadMessageId}"]`)
    if (messageElement && scrollContainerRef.current) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Messages will be marked as read progressively by Intersection Observer
    } else {
      handleScrollToBottom()
    }
  }, [conversationId, getFirstUnreadMessageId, handleScrollToBottom, scrollContainerRef])

  return (
    <WidgetContent
      className="relative flex-1 overflow-hidden p-0"
      props={{
        style: widgetConfig.widgetBgColor ? { background: widgetConfig.widgetBgColor } : { backgroundColor: '#FAFAFA' },
      }}
    >
      {isLoadingMore && <LoadMore />}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex h-full w-full flex-col overflow-x-hidden overflow-y-auto px-4 py-6"
      >
        <div ref={contentRef} className="flex flex-col gap-3 py-4">
          {messages.length === 0 && !isTyping ? (
            <EmptyMessage />
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((message, index) => {
                // Check if message is in the unread list
                const isUnread = conversationUnreadMessages.some((unread) => unread.messageId === message.ulid)

                logger.debug('🟣 MESSAGE:RENDER', 'Rendering individual message', {
                  index,
                  messageId: message.ulid,
                  senderType: message.sender_type,
                  content: message.content?.substring(0, 30),
                  isUnread,
                })

                return (
                  <div
                    key={message.ulid}
                    data-message-id={message.ulid}
                    ref={(el) => registerMessageRef(message.ulid, el)}
                  >
                    <ConversationMessage
                      message={message}
                      isUnread={isUnread}
                      primaryColor={widgetConfig.primaryColor}
                      websiteName={widgetConfig.name}
                      isLastMessage={index === messages.length - 1}
                    />
                  </div>
                )
              })}
              {activeStream && <StreamingMessage stream={activeStream} />}
              {isTyping && !hasActiveStream && (
                <TypingIndicator senderName={typingState?.senderName} senderType={typingState?.senderType} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unread messages indicator */}
      {unreadCount > 0 && !isAtBottom && (
        <UnreadIndicator
          unreadCount={unreadCount}
          onScrollToBottom={handleScrollToBottom}
          onScrollToFirstUnread={handleScrollToFirstUnread}
        />
      )}
    </WidgetContent>
  )
}

export { ConversationMessages }
