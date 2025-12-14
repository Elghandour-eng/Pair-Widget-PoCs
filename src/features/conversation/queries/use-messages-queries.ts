import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'

import { getMessages, type GetMessagesParams } from '@/features/conversation/apis/get-messages'
import { conversationKeys } from '@/features/conversation/constants/conversation-keys'
import type { MessagesListResponse } from '@/features/conversation/types/message'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import type { Conversation } from '../types/conversation'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const MessagesInfiniteQueryOptions = (conversationId: Conversation['ulid'], limit?: number) => {
  const widgetId = getWidgetId() || ''
  const queryKey = conversationKeys.MESSAGES(widgetId, conversationId, { limit })
  const enabled = !!conversationId && !!widgetId

  logger.debug('🟣 MESSAGE:RENDER', 'MessagesInfiniteQueryOptions called', {
    conversationId,
    widgetId,
    limit,
    queryKey,
    enabled,
  })

  return infiniteQueryOptions<MessagesListResponse>({
    queryKey,
    queryFn: ({ pageParam }) => {
      logger.debug('🟣 MESSAGE:RENDER', 'Query function executing - fetching from API', {
        conversationId,
        pageParam,
        limit,
      })

      const params: GetMessagesParams = { limit }
      if (pageParam) {
        params.before = pageParam as string
      }
      return getMessages(conversationId, params)
    },
    initialPageParam: undefined,
    getNextPageParam: () => undefined, // We only support backward pagination (loading older messages)
    getPreviousPageParam: (firstPage) => {
      // For scrolling to top (loading older messages), we use the first message's ULID
      // The first message in the array is the oldest (after reversal)
      if (firstPage.has_more && firstPage.data.length > 0) {
        return firstPage.data[0].ulid
      }
      return undefined
    },
    staleTime: Infinity,
    enabled,
  })
}

export function useMessages(conversationId: Conversation['ulid'], params?: GetMessagesParams) {
  logger.debug('🟣 MESSAGE:RENDER', 'useMessages hook called', {
    conversationId,
    params,
    hasConversationId: !!conversationId,
  })

  const result = useInfiniteQuery(MessagesInfiniteQueryOptions(conversationId, params?.limit))

  logger.debug('🟣 MESSAGE:RENDER', 'useInfiniteQuery returned', {
    conversationId,
    hasData: !!result.data,
    pagesCount: result.data?.pages?.length || 0,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isError: result.isError,
    status: result.status,
  })

  return result
}
