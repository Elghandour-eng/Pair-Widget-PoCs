import type Pusher from 'pusher-js'
import type { Channel } from 'pusher-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { TOKEN_CHANGED_EVENT, tokenStorage } from '@/core/token-storage'
import { ConversationsQueryOptions } from '@/features/conversation/queries/use-conversations-queries'
import { streamingStore } from '@/features/conversation/stores/streaming-store'
import { handleIncomingPusherMessage } from '@/features/conversation/utils/handle-pusher-message'
import { isSseTransport, sseSubscribe } from '@/core/sse-transport'
import type {
  PusherNewMessageEventData,
  WidgetThinkingData,
  WidgetDeltaData,
  WidgetCompleteData,
} from '@/pusher/types/pusher-events'
import { getPrivateConversationChannelName } from '@/pusher/utils/channel-names'
import { getPusherClient } from '@/pusher/utils/pusher-client'
import { unwrapEnvelope } from '@/pusher/utils/unwrap-envelope'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface UnreadMessage {
  messageId: string
  conversationId: string
  timestamp: number
}

interface LastIncomingMessage {
  messageId: string
  conversationId: string
  content: string
  senderName: string | undefined
  senderAvatar: string | undefined
  timestamp: number
}

interface UnreadMessagesContextType {
  // Map of conversation ID to array of unread message IDs
  unreadMessages: Map<string, UnreadMessage[]>
  // Total unread count across all conversations (respects visibility rules)
  totalUnreadCount: number
  // Get unread count that should show on badge (considers widget state)
  getVisibleUnreadCount: () => number
  // Add an unread message
  addUnreadMessage: (conversationId: string, messageId: string) => void
  // Mark messages as read for a conversation
  markAsRead: (conversationId: string, messageIds?: string[]) => void
  // Mark all messages in a conversation as read
  markConversationAsRead: (conversationId: string) => void
  // Get first unread message ID for a conversation
  getFirstUnreadMessageId: (conversationId: string) => string | null
  // Subscribe to a new conversation (used when creating first message)
  subscribeToConversation: (conversationId: string) => void
  // Set current viewing state (for badge visibility logic)
  setViewingConversation: (conversationId: string | null, isOpen: boolean, currentScreen: string) => void
  // Latest incoming message data for preview UI
  lastIncomingMessage: LastIncomingMessage | null
  // Whether user dismissed the preview
  isPreviewDismissed: boolean
  // Dismiss preview function
  dismissPreview: () => void
  typingStates: Map<string, { isTyping: boolean; senderName?: string; senderType?: string }>
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined)

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [unreadMessages, setUnreadMessages] = useState<Map<string, UnreadMessage[]>>(new Map())
  const [pusherInstance, setPusherInstance] = useState<Pusher | null>(null)
  const [channels, setChannels] = useState<Map<string, Channel>>(new Map())
  const widgetId = getWidgetId()
  const [hasToken, setHasToken] = useState<boolean>(!!tokenStorage.get(widgetId))
  const [viewingState, setViewingState] = useState<{
    conversationId: string | null
    isOpen: boolean
    currentScreen: string
  }>({
    conversationId: null,
    isOpen: false,
    currentScreen: 'welcome',
  })
  const [lastIncomingMessage, setLastIncomingMessage] = useState<LastIncomingMessage | null>(null)
  const [isPreviewDismissed, setIsPreviewDismissed] = useState(true)
  const [typingStates, setTypingStates] = useState<
    Map<string, { isTyping: boolean; senderName?: string; senderType?: string }>
  >(new Map())

  // Calculate total unread count
  const totalUnreadCount = Array.from(unreadMessages.values()).reduce((total, messages) => total + messages.length, 0)

  // Get visible unread count based on widget state
  // Badge shows when: widget closed OR (widget open but NOT viewing conversation screen)
  const getVisibleUnreadCount = useCallback(() => {
    const { isOpen, currentScreen, conversationId } = viewingState

    // If widget is closed, show all unread
    if (!isOpen) {
      return totalUnreadCount
    }

    // If widget is open but not on conversation screen, show all unread
    if (currentScreen !== 'conversation') {
      return totalUnreadCount
    }

    // If on conversation screen, exclude that conversation's unread from badge
    // (but still track them for the in-conversation indicator)
    if (conversationId) {
      const currentConversationUnread = unreadMessages.get(conversationId)?.length || 0
      return totalUnreadCount - currentConversationUnread
    }

    return totalUnreadCount
  }, [totalUnreadCount, unreadMessages, viewingState.isOpen, viewingState.currentScreen, viewingState.conversationId])

  // Set current viewing state
  const setViewingConversation = useCallback(
    (conversationId: string | null, isOpen: boolean, currentScreen: string) => {
      setViewingState({ conversationId, isOpen, currentScreen })

      logger.debug('setViewingConversation', 'Updated viewing state', {
        conversationId,
        isOpen,
        currentScreen,
      })
    },
    [], // No dependencies - just updates state
  )

  const dismissPreview = useCallback(() => {
    setIsPreviewDismissed(true)
  }, [])

  // Add an unread message
  // SSE transport bridge: incoming agent messages raise the unread badge and
  // the closed-widget preview through the same state the Pusher path uses.
  useEffect(() => {
    const onSseIncoming = (ev: Event) => {
      const d = (ev as CustomEvent).detail as
        | {
            conversationId?: string
            message?: { ulid?: string; content?: string; sender_name?: string; sender_avatar?: string }
          }
        | undefined
      if (!d?.conversationId || !d.message?.ulid) return
      addUnreadMessage(d.conversationId, d.message.ulid)
      setLastIncomingMessage({
        messageId: d.message.ulid,
        conversationId: d.conversationId,
        content: d.message.content || '',
        senderName: d.message.sender_name,
        senderAvatar: d.message.sender_avatar,
        timestamp: Date.now(),
      })
      setIsPreviewDismissed(false)
    }
    window.addEventListener('pair:sse-incoming', onSseIncoming)
    return () => window.removeEventListener('pair:sse-incoming', onSseIncoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addUnreadMessage = useCallback((conversationId: string, messageId: string) => {
    logger.debug('addUnreadMessage', 'Adding unread message', {
      conversationId,
      messageId,
    })

    setUnreadMessages((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(conversationId) || []

      // Don't add duplicate message IDs
      if (existing.some((msg) => msg.messageId === messageId)) {
        logger.debug('addUnreadMessage', 'Message already marked as unread, skipping', {
          conversationId,
          messageId,
        })
        return prev
      }

      newMap.set(conversationId, [
        ...existing,
        {
          messageId,
          conversationId,
          timestamp: Date.now(),
        },
      ])

      logger.debug('addUnreadMessage', 'Unread message added', {
        conversationId,
        messageId,
        totalUnread: newMap.get(conversationId)?.length,
      })

      return newMap
    })
  }, [])

  // Mark specific messages as read
  const markAsRead = useCallback((conversationId: string, messageIds?: string[]) => {
    logger.debug('markAsRead', 'Marking messages as read', {
      conversationId,
      messageIds,
    })

    setUnreadMessages((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(conversationId) || []

      if (!messageIds || messageIds.length === 0) {
        // If no message IDs provided, clear all
        newMap.delete(conversationId)
      } else {
        // Remove specific message IDs
        const filtered = existing.filter((msg) => !messageIds.includes(msg.messageId))
        if (filtered.length > 0) {
          newMap.set(conversationId, filtered)
        } else {
          newMap.delete(conversationId)
        }
      }

      logger.debug('markAsRead', 'Messages marked as read', {
        conversationId,
        remainingUnread: newMap.get(conversationId)?.length || 0,
      })

      return newMap
    })
  }, [])

  // Mark all messages in a conversation as read
  const markConversationAsRead = useCallback(
    (conversationId: string) => {
      logger.debug('markConversationAsRead', 'Marking conversation as read', {
        conversationId,
      })
      markAsRead(conversationId)
    },
    [markAsRead],
  )

  // Get first unread message ID
  const getFirstUnreadMessageId = useCallback(
    (conversationId: string): string | null => {
      const messages = unreadMessages.get(conversationId) || []
      if (messages.length === 0) return null

      // Sort by timestamp (oldest first)
      const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
      return sorted[0]?.messageId || null
    },
    [unreadMessages],
  )

  // Subscribe to a single conversation
  const subscribeToConversation = useCallback(
    (conversationId: string) => {
      if (isSseTransport()) {
        // SSE transport: no Pusher channel — one HTTP stream per conversation feeds the same sinks
        sseSubscribe(conversationId)
        return
      }
      const widgetId = getWidgetId()
      logger.debug('subscribeToConversation', 'Subscribing to new conversation', {
        conversationId,
        hasPusherInstance: !!pusherInstance,
        hasToken: !!tokenStorage.get(widgetId),
      })

      // If pusher instance doesn't exist but we have a token, try to get/create it
      let pusher = pusherInstance
      if (!pusher) {
        const token = tokenStorage.get(widgetId)
        if (!token) {
          logger.debug('subscribeToConversation', 'No token available, cannot subscribe')
          return
        }

        logger.debug('subscribeToConversation', 'Pusher instance not ready, attempting to initialize')
        try {
          pusher = getPusherClient()
          setPusherInstance(pusher)
          logger.debug('subscribeToConversation', 'Pusher instance initialized successfully')
        } catch (error) {
          logger.debug('subscribeToConversation', 'Failed to initialize Pusher instance', { error })
          return
        }
      }

      // Check if already subscribed
      if (channels.has(conversationId)) {
        logger.debug('subscribeToConversation', 'Already subscribed to conversation', {
          conversationId,
        })
        return
      }

      const channelName = getPrivateConversationChannelName(conversationId)

      try {
        const channel = pusher.subscribe(channelName)

        // Handle subscription success
        channel.bind('pusher:subscription_succeeded', () => {
          logger.debug('subscribeToConversation', 'Channel subscription succeeded', {
            conversationId,
            channelName,
          })
        })

        // Handle subscription error
        channel.bind('pusher:subscription_error', (status: number) => {
          logger.debug('subscribeToConversation', 'Channel subscription error', {
            conversationId,
            channelName,
            status,
          })
        })

        // Listen to new message events
        const handleNewMessage = (data: PusherNewMessageEventData | string) => {
          logger.debug('🔵 MESSAGE:RENDER', 'Pusher event received in subscribeToConversation', {
            conversationId,
            dataType: typeof data,
            rawDataPreview: typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200),
          })

          try {
            // Parse data if it's a string
            const parsedData: PusherNewMessageEventData = typeof data === 'string' ? JSON.parse(data) : data

            // Clear typing state and active streams when persisted message arrives
            setTypingStates((prev) => {
              const newMap = new Map(prev)
              newMap.delete(conversationId)
              return newMap
            })
            streamingStore.removeStreamsForConversation(conversationId)

            logger.debug('🔵 MESSAGE:RENDER', 'Parsed Pusher data', {
              conversationId,
              hasData: !!parsedData.data,
              hasMessage: !!parsedData.data?.message,
              messageId: parsedData.data?.message?.ulid,
            })

            // First, add message to cache for rendering (handles both incoming and outgoing)
            logger.debug('🔵 MESSAGE:RENDER', 'Calling handleIncomingPusherMessage', {
              conversationId,
            })
            handleIncomingPusherMessage(conversationId, data)
            logger.debug('🔵 MESSAGE:RENDER', 'handleIncomingPusherMessage completed', {
              conversationId,
            })

            // Extract message from the event data
            const message = parsedData.data?.message

            if (message) {
              logger.debug('🔵 MESSAGE:RENDER', 'Message extracted from event', {
                conversationId,
                messageId: message.ulid,
                senderType: message.sender_type,
                content: message.content?.substring(0, 50),
              })

              // Only add to unread if it's from an agent or bot (not from the user/contact) or system
              if (message.sender_type !== 'contact' && message.sender_type !== 'system') {
                logger.debug('🔵 MESSAGE:RENDER', 'Adding to unread (agent/bot message)', {
                  conversationId,
                  messageId: message.ulid,
                })
                addUnreadMessage(conversationId, message.ulid)
                setLastIncomingMessage({
                  messageId: message.ulid,
                  conversationId,
                  content: message.content || '',
                  senderName: message.sender_name,
                  senderAvatar: message.sender_avatar,
                  timestamp: Date.now(),
                })
                setIsPreviewDismissed(false)
              } else {
                logger.debug('🔵 MESSAGE:RENDER', 'Skipping unread (user message)', {
                  conversationId,
                  messageId: message.ulid,
                })
              }
            } else {
              logger.debug('🔵 MESSAGE:RENDER', 'No message found in parsed data', {
                conversationId,
                parsedData,
              })
            }
          } catch (error) {
            logger.debug('🔵 MESSAGE:RENDER', 'Error in handleNewMessage', {
              conversationId,
              error,
              errorMessage: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // Bind to both event name formats
        channel.bind('new_message', handleNewMessage)
        channel.bind('new-message', handleNewMessage)

        const handleTyping = (data: any) => {
          logger.debug('🔵 TYPING:EVENT', 'Pusher typing event received in subscribeToConversation', {
            conversationId,
            dataType: typeof data,
          })
          try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data
            const typingData = parsedData.data
            if (typingData && typingData.conversation_id) {
              const isTyping = typingData.status === 'start'
              const senderName = typingData.sender_name
              const senderType = typingData.sender_type

              const isAiTyping = !senderType || senderType === 'ai' || senderType === 'ai_agent' || senderType === 'bot'

              // Guard: for AI typing, ignore 'stop' — stop is advisory and can be emitted before the first delta.
              // Typing indicator will be hidden when new-message arrives, activeStream takes over, or 15s timeout.
              if (!isTyping && isAiTyping) {
                logger.debug(
                  '🔵 TYPING:EVENT',
                  'Ignoring typing stop for AI agent — waiting for deltas or new-message',
                  {
                    conversationId: typingData.conversation_id,
                  },
                )
                return
              }

              setTypingStates((prev) => {
                const newMap = new Map(prev)
                newMap.set(typingData.conversation_id, { isTyping, senderName, senderType })
                return newMap
              })

              if (isTyping) {
                setTimeout(() => {
                  setTypingStates((prev) => {
                    const current = prev.get(typingData.conversation_id)
                    if (current && current.isTyping && current.senderName === senderName) {
                      const newMap = new Map(prev)
                      newMap.delete(typingData.conversation_id)
                      return newMap
                    }
                    return prev
                  })
                }, 15000)
              }
            }
          } catch (error) {
            logger.debug('🔵 TYPING:EVENT', 'Error in handleTyping', { error })
          }
        }

        channel.bind('widget.typing', handleTyping)
        channel.bind('widget_typing', handleTyping)

        // --- AI Streaming events ---
        channel.bind('widget.thinking', (data: unknown) => {
          const envelope = unwrapEnvelope<WidgetThinkingData>(data)
          if (envelope) {
            logger.debug('🔵 STREAM:EVENT', 'widget.thinking received', {
              conversationId,
              streamId: envelope.stream_id,
            })
            streamingStore.handleThinking(envelope.conversation_id, envelope.stream_id, envelope.text)
          }
        })

        channel.bind('widget.message.delta', (data: unknown) => {
          const envelope = unwrapEnvelope<WidgetDeltaData>(data)
          if (envelope) {
            logger.debug('🔵 STREAM:EVENT', 'widget.message.delta received', {
              conversationId,
              streamId: envelope.stream_id,
              seq: envelope.seq,
            })
            streamingStore.handleDelta(envelope.conversation_id, envelope.stream_id, envelope.delta, envelope.seq)
          }
        })

        channel.bind('widget.message.complete', (data: unknown) => {
          const envelope = unwrapEnvelope<WidgetCompleteData>(data)
          if (envelope) {
            logger.debug('🔵 STREAM:EVENT', 'widget.message.complete received', {
              conversationId,
              streamId: envelope.stream_id,
            })
            streamingStore.handleComplete(envelope.conversation_id, envelope.stream_id)
          }
        })

        // Update channels map
        setChannels((prev) => {
          const newMap = new Map(prev)
          newMap.set(conversationId, channel)
          return newMap
        })

        logger.debug('subscribeToConversation', 'Successfully subscribed to conversation', {
          conversationId,
          channelName,
        })
      } catch (error) {
        logger.debug('subscribeToConversation', 'Error subscribing to conversation', {
          conversationId,
          channelName,
          error,
        })
      }
    },
    [pusherInstance, channels, addUnreadMessage],
  )

  // Watch for token changes (e.g., when user completes pre-chat form)
  useEffect(() => {
    const checkToken = () => {
      const widgetId = getWidgetId()
      const currentToken = tokenStorage.get(widgetId)
      const hasCurrentToken = !!currentToken

      if (hasCurrentToken !== hasToken) {
        logger.debug('UnreadMessagesProvider', 'Token state changed', {
          hadToken: hasToken,
          hasTokenNow: hasCurrentToken,
        })
        setHasToken(hasCurrentToken)
      }
    }

    // Check immediately
    checkToken()

    // Listen for custom token change event (from tokenStorage)
    // The "as any" cast is needed because CustomEvent adds strict type checking in some TS configs
    const handleTokenChange = () => {
      // We can trust the event to tell us the truth, or just re-check
      checkToken()
    }

    window.addEventListener(TOKEN_CHANGED_EVENT, handleTokenChange)

    // Listen for storage events (for cross-tab changes)
    window.addEventListener('storage', checkToken)

    return () => {
      window.removeEventListener(TOKEN_CHANGED_EVENT, handleTokenChange)
      window.removeEventListener('storage', checkToken)
    }
  }, [hasToken])

  // Initialize Pusher and subscribe to all conversations
  useEffect(() => {
    const widgetId = getWidgetId()
    const token = tokenStorage.get(widgetId)

    if (!token) {
      logger.debug('UnreadMessagesProvider', 'No token found, skipping Pusher initialization')
      return
    }

    if (isSseTransport()) {
      logger.debug('UnreadMessagesProvider', 'SSE transport enabled, skipping Pusher initialization')
      return
    }

    logger.debug('UnreadMessagesProvider', 'Initializing Pusher subscriptions', {
      hasExistingPusher: !!pusherInstance,
      hasExistingChannels: channels.size,
    })

    // Get Pusher instance (this will reuse existing instance if already created)
    const pusher = getPusherClient()
    setPusherInstance(pusher)

    // Fetch conversations and subscribe to them
    const initializeSubscriptions = async () => {
      try {
        const conversationsData = await queryClient.ensureQueryData(ConversationsQueryOptions())
        const conversations = conversationsData.data || []

        logger.debug('UnreadMessagesProvider', 'Fetched conversations for subscription', {
          count: conversations.length,
        })

        // Subscribe to each conversation
        const newChannels = new Map<string, Channel>()

        for (const conversation of conversations) {
          const channelName = getPrivateConversationChannelName(conversation.ulid)

          try {
            logger.debug('UnreadMessagesProvider', 'Subscribing to conversation channel', {
              conversationId: conversation.ulid,
              channelName,
            })

            const channel = pusher.subscribe(channelName)

            // Handle subscription success
            channel.bind('pusher:subscription_succeeded', () => {
              logger.debug('UnreadMessagesProvider', 'Channel subscription succeeded', {
                conversationId: conversation.ulid,
                channelName,
              })
            })

            // Handle subscription error
            channel.bind('pusher:subscription_error', (status: number) => {
              logger.debug('UnreadMessagesProvider', 'Channel subscription error', {
                conversationId: conversation.ulid,
                channelName,
                status,
              })
            })

            // Listen to new message events
            const handleNewMessage = (data: PusherNewMessageEventData | string) => {
              logger.debug('UnreadMessagesProvider', 'Received new message event', {
                conversationId: conversation.ulid,
                dataType: typeof data,
              })

              try {
                logger.debug('🔵 MESSAGE:RENDER', 'Pusher event received in provider init', {
                  conversationId: conversation.ulid,
                  dataType: typeof data,
                })

                // Parse data if it's a string
                const parsedData: PusherNewMessageEventData = typeof data === 'string' ? JSON.parse(data) : data

                // Clear typing state and active streams when persisted message arrives
                setTypingStates((prev) => {
                  const newMap = new Map(prev)
                  newMap.delete(conversation.ulid)
                  return newMap
                })
                streamingStore.removeStreamsForConversation(conversation.ulid)

                logger.debug('🔵 MESSAGE:RENDER', 'Calling handleIncomingPusherMessage from provider', {
                  conversationId: conversation.ulid,
                })

                // First, add message to cache for rendering (handles both incoming and outgoing)
                handleIncomingPusherMessage(conversation.ulid, data)

                logger.debug('🔵 MESSAGE:RENDER', 'handleIncomingPusherMessage completed from provider', {
                  conversationId: conversation.ulid,
                })

                // Extract message from the event data
                const message = parsedData.data?.message

                if (message) {
                  logger.debug('🔵 MESSAGE:RENDER', 'Processing message in provider', {
                    conversationId: conversation.ulid,
                    messageId: message.ulid,
                    senderType: message.sender_type,
                  })

                  // Only add to unread if it's from an agent or bot (not from the user/contact) or system
                  if (message.sender_type !== 'contact' && message.sender_type !== 'system') {
                    addUnreadMessage(conversation.ulid, message.ulid)
                    setLastIncomingMessage({
                      messageId: message.ulid,
                      conversationId: conversation.ulid,
                      content: message.content || '',
                      senderName: message.sender_name,
                      senderAvatar: message.sender_avatar,
                      timestamp: Date.now(),
                    })
                    setIsPreviewDismissed(false)
                  }
                }
              } catch (error) {
                logger.debug('🔵 MESSAGE:RENDER', 'Error in provider message handler', {
                  conversationId: conversation.ulid,
                  error,
                })
              }
            }

            // Bind to both event name formats
            channel.bind('new_message', handleNewMessage)
            channel.bind('new-message', handleNewMessage)

            const handleTyping = (data: any) => {
              logger.debug('🔵 TYPING:EVENT', 'Pusher typing event received in provider init', {
                conversationId: conversation.ulid,
                dataType: typeof data,
              })
              try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data
                const typingData = parsedData.data
                if (typingData && typingData.conversation_id) {
                  const isTyping = typingData.status === 'start'
                  const senderName = typingData.sender_name
                  const senderType = typingData.sender_type

                  const isAiTyping =
                    !senderType || senderType === 'ai' || senderType === 'ai_agent' || senderType === 'bot'

                  // Guard: for AI typing, ignore 'stop' — stop is advisory and can be emitted before the first delta.
                  // Typing indicator will be hidden when new-message arrives, activeStream takes over, or 15s timeout.
                  if (!isTyping && isAiTyping) {
                    logger.debug(
                      '🔵 TYPING:EVENT',
                      'Ignoring typing stop for AI agent — waiting for deltas or new-message',
                      {
                        conversationId: typingData.conversation_id,
                      },
                    )
                    return
                  }

                  setTypingStates((prev) => {
                    const newMap = new Map(prev)
                    newMap.set(typingData.conversation_id, { isTyping, senderName, senderType })
                    return newMap
                  })

                  if (isTyping) {
                    setTimeout(() => {
                      setTypingStates((prev) => {
                        const current = prev.get(typingData.conversation_id)
                        if (current && current.isTyping && current.senderName === senderName) {
                          const newMap = new Map(prev)
                          newMap.delete(typingData.conversation_id)
                          return newMap
                        }
                        return prev
                      })
                    }, 15000)
                  }
                }
              } catch (error) {
                logger.debug('🔵 TYPING:EVENT', 'Error in handleTyping in provider init', { error })
              }
            }

            channel.bind('widget.typing', handleTyping)
            channel.bind('widget_typing', handleTyping)

            // --- AI Streaming events ---
            channel.bind('widget.thinking', (data: unknown) => {
              const envelope = unwrapEnvelope<WidgetThinkingData>(data)
              if (envelope) {
                logger.debug('🔵 STREAM:EVENT', 'widget.thinking received (init)', {
                  conversationId: conversation.ulid,
                  streamId: envelope.stream_id,
                })
                streamingStore.handleThinking(envelope.conversation_id, envelope.stream_id, envelope.text)
              }
            })

            channel.bind('widget.message.delta', (data: unknown) => {
              const envelope = unwrapEnvelope<WidgetDeltaData>(data)
              if (envelope) {
                logger.debug('🔵 STREAM:EVENT', 'widget.message.delta received (init)', {
                  conversationId: conversation.ulid,
                  streamId: envelope.stream_id,
                  seq: envelope.seq,
                })
                streamingStore.handleDelta(envelope.conversation_id, envelope.stream_id, envelope.delta, envelope.seq)
              }
            })

            channel.bind('widget.message.complete', (data: unknown) => {
              const envelope = unwrapEnvelope<WidgetCompleteData>(data)
              if (envelope) {
                logger.debug('🔵 STREAM:EVENT', 'widget.message.complete received (init)', {
                  conversationId: conversation.ulid,
                  streamId: envelope.stream_id,
                })
                streamingStore.handleComplete(envelope.conversation_id, envelope.stream_id)
              }
            })

            newChannels.set(conversation.ulid, channel)
          } catch (error) {
            logger.debug('UnreadMessagesProvider', 'Error subscribing to conversation', {
              conversationId: conversation.ulid,
              channelName,
              error,
            })
          }
        }

        setChannels(newChannels)

        logger.debug('UnreadMessagesProvider', 'Subscribed to all conversation channels', {
          subscribedCount: newChannels.size,
          totalCount: conversations.length,
        })
      } catch (error) {
        logger.debug('UnreadMessagesProvider', 'Error initializing subscriptions', { error })
      }
    }

    initializeSubscriptions()

    // Cleanup function
    return () => {
      logger.debug('UnreadMessagesProvider', 'Cleaning up Pusher subscriptions', {
        channelsToClean: channels.size,
      })

      // Unsubscribe from all channels
      channels.forEach((channel, conversationId) => {
        try {
          logger.debug('UnreadMessagesProvider', 'Unsubscribing from channel', {
            conversationId,
            channelName: channel.name,
          })
          channel.unbind_all()
          channel.unsubscribe()
        } catch (error) {
          logger.debug('UnreadMessagesProvider', 'Error unsubscribing from channel', {
            conversationId,
            error,
          })
        }
      })

      // Clear channels after cleanup
      setChannels(new Map())
    }
  }, [hasToken]) // Re-run when token state changes

  // Reconnect hydration: re-fetch messages and clear stale streams on reconnect
  useEffect(() => {
    const widgetId = getWidgetId()

    const handleReconnect = () => {
      logger.debug('UnreadMessagesProvider', 'Pusher reconnected — hydrating messages', {
        channelCount: channels.size,
      })

      channels.forEach((_, conversationId) => {
        // Re-fetch messages from REST API
        queryClient.invalidateQueries({
          queryKey: ['conversations', widgetId, conversationId, 'messages'],
          exact: false,
        })
        // Clear any stale provisional streams
        streamingStore.removeStreamsForConversation(conversationId)
      })
    }

    window.addEventListener('pusher:reconnected', handleReconnect)
    return () => window.removeEventListener('pusher:reconnected', handleReconnect)
  }, [channels])

  return (
    <UnreadMessagesContext.Provider
      value={{
        unreadMessages,
        totalUnreadCount,
        getVisibleUnreadCount,
        addUnreadMessage,
        markAsRead,
        markConversationAsRead,
        getFirstUnreadMessageId,
        subscribeToConversation,
        setViewingConversation,
        lastIncomingMessage,
        isPreviewDismissed,
        dismissPreview,
        typingStates,
      }}
    >
      {children}
    </UnreadMessagesContext.Provider>
  )
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext)
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider')
  }
  return context
}
