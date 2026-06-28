import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface SendFeedbackRequest {
  conversationId: string
  messageId: string
  feedback: 'liked' | 'disliked'
}

export interface SendFeedbackResponse {
  success: boolean
  message_ulid: string
  feedback: 'liked' | 'disliked'
}

export async function submitFeedback({
  conversationId,
  messageId,
  feedback,
}: SendFeedbackRequest): Promise<SendFeedbackResponse> {
  logger.debug('submitFeedback', 'Submitting feedback', { conversationId, messageId, feedback })

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to submit feedback')
  }

  const response = await apiClient.put<SendFeedbackResponse>(
    `/v1/widget/${widgetId}/conversations/${conversationId}/messages/${messageId}/feedback`,
    { feedback },
  )

  logger.debug('submitFeedback', 'Feedback submitted successfully', response.data)
  return response.data
}
