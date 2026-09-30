import { apiClient } from '@/core/http'
import { getPayloadEnrichments } from '@/utils/payload-enricher'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

import type { SendMessageRequest } from '@/features/conversation/types/send-message-request'
import type { SendMessageResponse } from '@/features/conversation/types/send-message-response'

import type { WidgetConfig } from '@/config/types/widget-config'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function sendMessage(data: SendMessageRequest, widgetConfig: WidgetConfig): Promise<SendMessageResponse> {
  const enrichments = getPayloadEnrichments(widgetConfig)
  const payload = {
    ...data,
    ...enrichments,
  }

  logger.debug('sendMessage', 'Sending message with payload', payload)

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to send message')
  }

  const response = await apiClient.post<SendMessageResponse>(`/v1/widget/${widgetId}/send-message`, payload)

  logger.debug('sendMessage', 'Message sent successfully', {
    messageId: response.data.message_id,
    conversationId: response.data.conversation_id,
  })
  return response.data
}
