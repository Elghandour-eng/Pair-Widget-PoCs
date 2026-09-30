import Pusher, { type Channel } from 'pusher-js'

import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

import type { Conversation } from '@/features/conversation/types/conversation'
import type { PusherNewMessageEventData } from '../types/pusher-events'
import { getPrivateConversationChannelName } from './channel-names'
import { getPusherClient } from './pusher-client'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Subscribes to Pusher channels for a list of conversations
 * @param conversations - Array of conversation objects with ulid property
 * @param onMessage - Optional callback when a message event is received
 * @returns Object with pusher instance and subscribed channels
 */
export function subscribeToConversations(
  conversations: Conversation[],
  onMessage?: (conversationId: string, data: unknown) => void,
): { pusher: Pusher; channels: Map<Conversation['ulid'], Channel> } {
  logger.debug('subscribeToConversations', 'Subscribing to conversation channels', {
    conversationCount: conversations.length,
  })

  const pusher = getPusherClient()
  const channels = new Map<Conversation['ulid'], Channel>()

  for (const conversation of conversations) {
    logger.debug('subscribeToConversation', 'conversation data', {
      conversation,
    })
    const channelName = getPrivateConversationChannelName(conversation.ulid)

    try {
      logger.debug('subscribeToConversations', 'Subscribing to channel', {
        conversationId: conversation.ulid,
        channelName,
      })

      const channel = pusher.subscribe(channelName)

      // Handle subscription success
      channel.bind('pusher:subscription_succeeded', () => {
        logger.debug('subscribeToConversations', 'Channel subscription succeeded', {
          conversationId: conversation.ulid,
          channelName,
        })
      })

      // Handle subscription error
      channel.bind('pusher:subscription_error', (status: number) => {
        logger.debug('subscribeToConversations', 'Channel subscription error', {
          conversationId: conversation.ulid,
          channelName,
          status,
        })
      })

      // Listen to new message events
      if (onMessage) {
        const createEventHandler = (eventName: string) => {
          return (data: PusherNewMessageEventData | string) => {
            logger.debug('subscribeToConversations', `Pusher event: ${eventName}`, {
              conversationId: conversation.ulid,
              channelName,
              eventName,
              dataType: typeof data,
              rawData: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
            })
            onMessage(conversation.ulid, data)
          }
        }

        // Bind to both event name formats
        channel.bind('new_message', createEventHandler('new_message'))
        channel.bind('new-message', createEventHandler('new-message'))
      }

      channels.set(conversation.ulid, channel)
    } catch (error) {
      logger.debug('subscribeToConversations', 'Error subscribing to channel', {
        conversationId: conversation.ulid,
        channelName,
        error,
      })
    }
  }

  logger.debug('subscribeToConversations', 'Subscribed to all conversation channels', {
    subscribedCount: channels.size,
    totalCount: conversations.length,
  })

  return { pusher, channels }
}

/**
 * Unsubscribes from conversation channels
 * @param channels - Map of conversation channels to unsubscribe from
 */
export function unsubscribeFromConversations(channels: Map<Conversation['ulid'], Channel>): void {
  logger.debug('unsubscribeFromConversations', 'Unsubscribing from conversation channels', {
    channelCount: channels.size,
  })

  for (const [conversationId, channel] of channels.entries()) {
    try {
      logger.debug('unsubscribeFromConversations', 'Unsubscribing from channel', {
        conversationId,
        channelName: channel.name,
      })
      channel.unbind_all()
      channel.unsubscribe()
    } catch (error) {
      logger.debug('unsubscribeFromConversations', 'Error unsubscribing from channel', {
        conversationId,
        error,
      })
    }
  }

  channels.clear()
  logger.debug('unsubscribeFromConversations', 'Unsubscribed from all conversation channels')
}
