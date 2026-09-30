import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'

import { tokenStorage } from '@/core/token-storage'
import { listConversations, type ListConversationsParams } from '@/features/conversation/apis/list-conversations'
import { conversationKeys } from '@/features/conversation/constants/conversation-keys'
import type { ConversationsListResponse } from '@/features/conversation/types/conversation'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const ConversationsQueryOptions = (params?: ListConversationsParams) => {
  logger.debug('ConversationsQueryOptions', 'Creating conversations query options', params)

  const widgetId = getWidgetId()
  return queryOptions<ConversationsListResponse>({
    queryKey: conversationKeys.CONVERSATION(widgetId || '', params),
    queryFn: () => {
      if (!widgetId) {
        throw new Error('Widget ID is required to query conversations')
      }
      return listConversations(params)
    },
    enabled: !!widgetId && !!tokenStorage.get(widgetId),
    staleTime: Infinity, // Infinite stale time to avoid unnecessary re-fetching
  })
}

export function useConversations(params?: ListConversationsParams) {
  logger.debug('useConversations', 'Initializing conversations query hook', params)

  return useQuery(ConversationsQueryOptions(params))
}

export function useSuspenseConversations(params?: ListConversationsParams) {
  logger.debug('useSuspenseConversations', 'Initializing suspense conversations query hook', params)

  return useSuspenseQuery(ConversationsQueryOptions(params))
}
