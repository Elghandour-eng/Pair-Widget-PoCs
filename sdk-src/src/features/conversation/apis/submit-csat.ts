import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface SubmitCsatRequest {
  widgetId: string
  conversationId: string
  rating: number
  survey_message_ulid: string
}

export async function submitCsat({
  widgetId,
  conversationId,
  rating,
  survey_message_ulid,
}: SubmitCsatRequest): Promise<void> {
  logger.debug('submitCsat', 'Submitting CSAT rating', { widgetId, conversationId, rating, survey_message_ulid })

  await apiClient.post(`/v1/widget/${widgetId}/conversations/${conversationId}/csat`, {
    rating,
    survey_message_ulid,
  })

  logger.debug('submitCsat', 'CSAT rating submitted successfully')
}
