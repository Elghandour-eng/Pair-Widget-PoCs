import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { conversationKeys } from '../constants/conversation-keys'
import type { ApiMessage, Message } from '../types/message'
import { mapApiMessageToMessage } from './map-api-message'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Parses Pusher message event data
 * The data comes as a stringified JSON with nested structure:
 * {
 *   "title": "New Message",
 *   "body": "New Message",
 *   "data": {
 *     "message": {...},
 *     "conversationUlid": "...",
 *     "timestamp": "..."
 *   },
 *   "eventName": "new-message"
 * }
 */
interface PusherMessageData {
  title?: string
  body?: string
  data?: {
    message?: Message | ApiMessage
    conversationUlid?: string
    conversation_id?: number
    timestamp?: string
  }
  eventName?: string
  // Also support direct message structure
  message?: Message | ApiMessage
  conversationUlid?: string
  conversation_id?: number
}

function parsePusherMessageData(data: unknown): { message: Message; conversationId: string } | null {
  try {
    logger.debug('🟠 MESSAGE:RENDER', 'parsePusherMessageData called', {
      dataType: typeof data,
      isString: typeof data === 'string',
      dataPreview: typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200),
    })

    // The data might be a string that needs parsing, or already an object
    let parsedData: PusherMessageData
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
        logger.debug('🟠 MESSAGE:RENDER', 'Successfully parsed string data', {
          hasData: !!parsedData.data,
          hasMessage: !!parsedData.message,
          keys: Object.keys(parsedData),
        })
      } catch (parseError) {
        logger.debug('🔴 MESSAGE:RENDER', 'Failed to parse string data - JSON parse error', {
          error: parseError,
          data: data.substring(0, 500),
        })
        return null
      }
    } else {
      parsedData = data as PusherMessageData
      logger.debug('🟠 MESSAGE:RENDER', 'Data is already an object', {
        keys: Object.keys(parsedData),
      })
    }

    logger.debug('🟠 MESSAGE:RENDER', 'Analyzing parsed data structure', {
      hasData: !!parsedData.data,
      hasDataMessage: !!parsedData.data?.message,
      hasDirectMessage: !!parsedData.message,
      conversationUlid: parsedData.data?.conversationUlid || parsedData.conversationUlid,
      fullStructure: JSON.stringify(parsedData, null, 2).substring(0, 500),
    })

    // Handle nested structure: data.data.message (from Pusher event) or data.message (direct)
    const messageData = parsedData.data?.message || parsedData.message
    const conversationId =
      parsedData.data?.conversationUlid ||
      parsedData.data?.conversation_id?.toString() ||
      parsedData.conversationUlid ||
      parsedData.conversation_id?.toString()

    if (!messageData) {
      logger.debug('🔴 MESSAGE:RENDER', 'No message data found in parsed data - CANNOT RENDER', {
        parsedData,
        hasData: !!parsedData.data,
        hasMessage: !!parsedData.message,
        keys: Object.keys(parsedData),
      })
      return null
    }

    if (!conversationId) {
      logger.debug('🔴 MESSAGE:RENDER', 'No conversation ID found - CANNOT RENDER', {
        parsedData,
        conversationUlid: parsedData.data?.conversationUlid || parsedData.conversationUlid,
        conversationIdNum: parsedData.data?.conversation_id || parsedData.conversation_id,
      })
      return null
    }

    // Check if it's an API message format (has numeric id and created_at as number)
    const isApiMessage = 'id' in messageData && typeof (messageData as ApiMessage).id === 'number'

    logger.debug('🟠 MESSAGE:RENDER', 'Determining message format', {
      isApiMessage,
      hasId: 'id' in messageData,
      hasUlid: 'ulid' in messageData,
    })

    let normalizedMessage: Message
    if (isApiMessage) {
      // Convert API message to internal format
      logger.debug('🟠 MESSAGE:RENDER', 'Converting API message format to internal format')
      normalizedMessage = mapApiMessageToMessage(messageData as ApiMessage)
    } else {
      // Already in normalized format
      logger.debug('🟠 MESSAGE:RENDER', 'Message already in normalized format')
      normalizedMessage = messageData as Message
    }

    logger.debug('✅ MESSAGE:RENDER', 'Successfully parsed Pusher message - READY TO RENDER', {
      messageId: normalizedMessage.ulid,
      conversationId,
      senderType: normalizedMessage.sender_type,
      content: normalizedMessage.content?.substring(0, 50),
      messageType: normalizedMessage.message_type,
    })

    return {
      message: normalizedMessage,
      conversationId: conversationId as string,
    }
  } catch (error) {
    logger.debug('🔴 MESSAGE:RENDER', 'Exception in parsePusherMessageData - CANNOT RENDER', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      dataPreview: typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200),
    })
    return null
  }
}

/**
 * Handles incoming Pusher message and updates React Query cache
 */
export function handleIncomingPusherMessage(conversationId: string, data: unknown): void {
  console.log('[Debugging] handleIncomingPusherMessage called', { conversationId, dataType: typeof data })
  logger.debug('🟢 MESSAGE:RENDER', 'handleIncomingPusherMessage called', {
    conversationId,
    dataType: typeof data,
  })

  const parsed = parsePusherMessageData(data)
  if (!parsed) {
    console.error('[Debugging] handleIncomingPusherMessage failed to parse message data!')
    logger.debug('🔴 MESSAGE:RENDER', 'Failed to parse message data - message will NOT render', {
      conversationId,
      dataPreview: typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200),
    })
    return
  }

  const { message, conversationId: parsedConversationId } = parsed

  // Use the conversationId from the parsed data if available, otherwise use the one passed in
  const targetConversationId = parsedConversationId || conversationId

  console.log('[Debugging] handleIncomingPusherMessage successfully parsed', {
    messageId: message.ulid,
    conversationId: targetConversationId,
    senderType: message.sender_type,
    status: message.status,
  })
  logger.debug('🟢 MESSAGE:RENDER', 'Message parsed successfully, adding to React Query cache', {
    messageId: message.ulid,
    conversationId: targetConversationId,
    senderType: message.sender_type,
    content: message.content?.substring(0, 50),
  })

  const widgetId = getWidgetId()
  if (!widgetId) {
    console.error('[Debugging] handleIncomingPusherMessage error: widgetId not found!')
    logger.debug('🔴 MESSAGE:RENDER', 'Widget ID not found - message will NOT render', {
      conversationId: targetConversationId,
      messageId: message.ulid,
    })
    return
  }

  // Get the query key filter - match all queries for this conversation regardless of params
  const queryKeyFilter = ['conversations', widgetId, targetConversationId, 'messages']
  console.log('[Debugging] handleIncomingPusherMessage queryKeyFilter:', queryKeyFilter)

  logger.debug('🟢 MESSAGE:RENDER', 'Updating React Query Infinite cache for all matching queries', {
    widgetId,
    conversationId: targetConversationId,
    queryKeyFilter,
    messageId: message.ulid,
  })

  // Update ALL cache entries that match this conversation (regardless of limit param)
  // useInfiniteQuery expects { pages: [...], pageParams: [...] }
  queryClient.setQueriesData<{
    pages: Array<{ data: Message[]; has_more: boolean; next_cursor?: string }>
    pageParams: unknown[]
  }>(
    {
      queryKey: queryKeyFilter,
      exact: false, // Match any query that starts with this key
    },
    (oldData) => {
      console.log(
        '[Debugging] handleIncomingPusherMessage setQueriesData callback executing. hasOldData:',
        !!oldData,
        'messageId:',
        message.ulid,
      )
      logger.debug('🟢 MESSAGE:RENDER', 'setQueryData callback executing', {
        hasOldData: !!oldData,
        pagesCount: oldData?.pages?.length || 0,
        messageId: message.ulid,
      })

      if (!oldData || !oldData.pages || oldData.pages.length === 0) {
        // If no data exists, create new paginated structure
        const newData = {
          pages: [
            {
              data: [message],
              has_more: false,
            },
          ],
          pageParams: [undefined],
        }

        logger.debug('✅ MESSAGE:RENDER', 'Created new cache from scratch, returning', {
          messageId: message.ulid,
          totalPages: 1,
          totalMessages: 1,
        })

        return newData
      }

      // Work with the last page (most recent messages)
      const lastPageIndex = oldData.pages.length - 1
      const lastPage = oldData.pages[lastPageIndex]

      // Check if message already exists in any page
      for (let pageIndex = 0; pageIndex < oldData.pages.length; pageIndex++) {
        const page = oldData.pages[pageIndex]
        const existingIndex = page.data.findIndex((m) => m.ulid === message.ulid)

        if (existingIndex !== -1) {
          console.log(
            '[Debugging] handleIncomingPusherMessage found existing message to update at pageIndex:',
            pageIndex,
            'existingIndex:',
            existingIndex,
            'newStatus:',
            message.status,
          )
          // Update existing message
          const updatedPages = [...oldData.pages]
          const updatedMessages = [...page.data]
          updatedMessages[existingIndex] = message
          updatedPages[pageIndex] = { ...page, data: updatedMessages }

          const newData = {
            ...oldData,
            pages: updatedPages,
          }

          logger.debug('✅ MESSAGE:RENDER', 'Updated existing message, returning cache', {
            messageId: message.ulid,
            pageIndex,
            messageIndex: existingIndex,
            totalPages: newData.pages.length,
          })

          return newData
        }
      }

      // Check if there's a pending message with same content (optimistic update replacement)
      for (let pageIndex = 0; pageIndex < oldData.pages.length; pageIndex++) {
        const page = oldData.pages[pageIndex]
        const pendingIndex = page.data.findIndex(
          (m) =>
            m.ulid.startsWith('temp-') &&
            m.content === message.content &&
            m.sender_type === message.sender_type &&
            Math.abs(new Date(m.sent_at).getTime() - new Date(message.sent_at).getTime()) < 5000,
        )

        if (pendingIndex !== -1) {
          // Replace optimistic message with real one
          const updatedPages = [...oldData.pages]
          const updatedMessages = [...page.data]
          updatedMessages[pendingIndex] = message
          updatedPages[pageIndex] = { ...page, data: updatedMessages }

          const newData = {
            ...oldData,
            pages: updatedPages,
          }

          logger.debug('✅ MESSAGE:RENDER', 'Replaced optimistic message, returning cache', {
            tempId: page.data[pendingIndex].ulid,
            realId: message.ulid,
            pageIndex,
            messageIndex: pendingIndex,
            totalPages: newData.pages.length,
          })

          return newData
        }
      }

      // Add new message to the last page
      // Messages are sorted oldest to newest, so new messages go at the end
      const updatedPages = [...oldData.pages]
      const updatedLastPage = {
        ...lastPage,
        data: [...lastPage.data, message],
      }
      updatedPages[lastPageIndex] = updatedLastPage

      const newData = {
        ...oldData,
        pages: updatedPages,
      }

      logger.debug('✅ MESSAGE:RENDER', 'Returning updated cache data', {
        messageId: message.ulid,
        messageTime: message.sent_at,
        pageIndex: lastPageIndex,
        newPageLength: updatedLastPage.data.length,
        oldPageLength: lastPage.data.length,
        totalPages: newData.pages.length,
        totalMessagesInLastPage: newData.pages[newData.pages.length - 1].data.length,
      })

      return newData
    },
  )

  logger.debug('✅ MESSAGE:RENDER', 'Cache updated for all matching queries - React Query should auto re-render', {
    messageId: message.ulid,
    conversationId: targetConversationId,
    queryKeyFilter,
  })
}

/**
 * Adds an outgoing message optimistically to the cache
 */
export function addOutgoingMessageToCache(conversationId: string, message: Message): void {
  logger.debug('addOutgoingMessageToCache', 'Adding outgoing message to cache', {
    messageId: message.ulid,
    conversationId,
  })

  const widgetId = getWidgetId()
  if (!widgetId) {
    logger.debug('addOutgoingMessageToCache', 'Widget ID not found, skipping cache update')
    return
  }

  const queryKey = conversationKeys.MESSAGES(widgetId, conversationId)

  queryClient.setQueryData<{ data: Message[]; has_more: boolean; next_cursor?: string }>(queryKey, (oldData) => {
    if (!oldData) {
      return {
        data: [message],
        has_more: false,
      }
    }

    // Check if message already exists
    const messageExists = oldData.data.some((m) => m.ulid === message.ulid)
    if (messageExists) {
      // Update existing message (e.g., change status from pending to sent)
      return {
        ...oldData,
        data: oldData.data.map((m) => (m.ulid === message.ulid ? message : m)),
      }
    }

    // Add new message
    return {
      ...oldData,
      data: [...oldData.data, message],
    }
  })
}

/**
 * Updates an existing message in the cache (e.g., status change)
 */
export function updateMessageInCache(conversationId: string, messageId: string, updates: Partial<Message>): void {
  logger.debug('updateMessageInCache', 'Updating message in cache', {
    messageId,
    conversationId,
    updates,
  })

  const widgetId = getWidgetId()
  if (!widgetId) {
    return
  }

  const queryKey = conversationKeys.MESSAGES(widgetId, conversationId)

  queryClient.setQueryData<{ data: Message[]; has_more: boolean; next_cursor?: string }>(queryKey, (oldData) => {
    if (!oldData) {
      return oldData
    }

    return {
      ...oldData,
      data: oldData.data.map((m) => (m.ulid === messageId ? { ...m, ...updates } : m)),
    }
  })
}
