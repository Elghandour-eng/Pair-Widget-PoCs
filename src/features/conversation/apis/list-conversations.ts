import { env } from '@/core/env'
import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { mockState } from '../mocks/mock-state'

import type { ConversationsListResponse } from '@/features/conversation/types/conversation'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface ListConversationsParams {
  status?: 'open' | 'closed' | 'pending'
  page?: number
  limit?: number
}

export async function listConversations(params?: ListConversationsParams): Promise<ConversationsListResponse> {
  logger.debug('listConversations', 'Fetching conversations list', params)

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to list conversations')
  }

  const queryParams = new URLSearchParams()
  if (params?.status) {
    queryParams.append('status', params.status)
  }
  if (params?.page) {
    queryParams.append('page', params.page.toString())
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString())
  }

  const queryString = queryParams.toString()
  const url = `/v1/widget/${widgetId}/conversations${queryString ? `?${queryString}` : ''}`

  if (env.useMock) {
    const response = mockState.getConversations()
    logger.debug('listConversations', 'Using conversations list mock', response)
    return response
  }

  const response = await apiClient.get<ConversationsListResponse>(url)

  logger.debug('listConversations', 'Conversations list fetched successfully', {
    count: response.data.data.length,
    total: response.data.meta.total,
  })
  return response.data
}
