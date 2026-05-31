import { publicApiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

import { env } from '@/core/env'
import { mockPreChatResponse } from '@/features/conversation/mocks/mock-pre-chat'
import type { PreChatFormPayload } from '@/features/pre-chat-form/types/pre-chat-form-payload'
import type { PreChatResponse } from '@/features/pre-chat-form/types/pre-chat-response'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function PreChat(data: PreChatFormPayload): Promise<PreChatResponse> {
  logger.debug('PreChat', 'Submitting pre-chat form data', data)

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to register widget user')
  }

  if (env.useMock) {
    logger.debug('PreChat', 'Using pre-chat form mock', mockPreChatResponse)
    return mockPreChatResponse
  }

  const response = await publicApiClient.post<PreChatResponse>(`/v1/widget/${widgetId}/register`, data)

  logger.debug('PreChat', 'Pre-chat form submitted successfully', { token: response.data.token })
  return response.data
}
