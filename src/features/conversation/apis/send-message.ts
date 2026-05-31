import { env } from '@/core/env'
import { mockState } from '../mocks/mock-state'
import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

import type { SendMessageRequest } from '@/features/conversation/types/send-message-request'
import type { SendMessageResponse } from '@/features/conversation/types/send-message-response'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
  logger.debug('sendMessage', 'Sending message', data)

  if (env.useMock) {
    logger.debug('sendMessage', 'Using mocked send message')
    return mockState.sendMessage(data)
  }

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to send message')
  }

  const response = await apiClient.post<SendMessageResponse>(`/v1/widget/${widgetId}/send-message`, data)

  logger.debug('sendMessage', 'Message sent successfully', {
    messageId: response.data.message_id,
    conversationId: response.data.conversation_id,
  })
  return response.data
}
