import type { WidgetConfig } from '@/config/types/widget-config'
import { publicApiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

import type { PreChatFormPayload } from '@/features/pre-chat-form/types/pre-chat-form-payload'
import type { PreChatResponse } from '@/features/pre-chat-form/types/pre-chat-response'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function PreChat(data: PreChatFormPayload, widgetConfig: WidgetConfig): Promise<PreChatResponse> {
  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to register widget user')
  }

  const userToken = widgetConfig.visitorCredential?.accessToken
  const userId = data.user_id || widgetConfig.userId

  const payload: PreChatFormPayload = {
    ...data,
    ...(userId ? { user_id: userId } : {}),
    ...(userToken ? { user_token: userToken } : {}),
  }

  logger.debug('PreChat', 'Submitting pre-chat registration payload', payload)

  const response = await publicApiClient.post<PreChatResponse>(`/v1/widget/${widgetId}/register`, payload)

  logger.debug('PreChat', 'Pre-chat form submitted successfully', { token: response.data.token })
  return response.data
}
