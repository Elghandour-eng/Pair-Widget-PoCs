import { apiClient } from '@/core/http'
import { env } from '@/core/env'
import { mockState } from '../mocks/mock-state'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

import type { Message, MessagesListResponse } from '@/features/conversation/types/message'
import { mockProductMessage } from '../mocks/mock-product-message'
import { mockQuestionMessage } from '../mocks/mock-question-message'
import { mockSuggestionMessage } from '../mocks/mock-suggestion-message'
import type { Conversation } from '../types/conversation'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface GetMessagesParams {
  before?: Message['ulid']
  limit?: number
}

export async function getMessages(
  conversationId: Conversation['ulid'],
  params?: GetMessagesParams,
): Promise<MessagesListResponse> {
  logger.debug('getMessages', 'Fetching conversation messages', { conversationId, params })

  if (env.useMock) {
    logger.debug('getMessages', 'Using mocked get messages for conversation', { conversationId })
    return mockState.getMessages(conversationId)
  }

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to get messages')
  }
  if (!conversationId) {
    throw new Error('Conversation ID is required to get messages')
  }

  const queryParams = new URLSearchParams()
  if (params?.before) {
    queryParams.append('before', params.before)
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString())
  }

  const queryString = queryParams.toString()
  const url = `/v1/widget/${widgetId}/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`

  // API returns messages in normalized format already
  const response = await apiClient.get<MessagesListResponse>(url)

  // API returns messages with newest first, but we want oldest first (newest at bottom)
  // Simply reverse the array to show oldest messages at top, newest at bottom
  const reversedMessages = [...response.data.data].reverse()

  logger.debug('getMessages', 'Messages fetched successfully', {
    count: response.data.data.length,
    hasMore: response.data.has_more,
  })

  // Append mock suggestion and question messages only on initial load (not when loading older pages)
  if (!params?.before) {
    reversedMessages.push(mockSuggestionMessage)
    reversedMessages.push(mockProductMessage)
    reversedMessages.push(mockQuestionMessage)
  }

  return {
    ...response.data,
    data: reversedMessages,
  }
}
