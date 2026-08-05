import { apiClient } from '@/core/http'
import type { WidgetConfig } from '@/config/types/widget-config'
import { getPayloadEnrichments } from '@/utils/payload-enricher'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface DispatchActionRequest {
  conversationId: string
  actionUlid: string
  sourceMessageUlid: string
  parameters?: Record<string, unknown>
  widgetConfig: WidgetConfig
}

export interface DispatchActionResponse {
  success: boolean
  response?: {
    body: Record<string, unknown>
    status: number
  }
  error_code: string | null
  error_message: string | null
  duration_ms: number
  audit_ulid: string
}

export async function dispatchAction({
  conversationId,
  actionUlid,
  sourceMessageUlid,
  parameters,
  widgetConfig,
}: DispatchActionRequest): Promise<DispatchActionResponse> {
  const enrichments = getPayloadEnrichments(widgetConfig)
  const payload = {
    source_message_ulid: sourceMessageUlid,
    parameters: parameters || {},
    ...enrichments,
  }

  logger.debug('dispatchAction', 'Dispatching action with payload', {
    conversationId,
    actionUlid,
    payload,
  })

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to dispatch action')
  }

  const response = await apiClient.post<DispatchActionResponse>(
    `/v1/widget/${widgetId}/conversations/${conversationId}/actions/${actionUlid}/dispatch`,
    payload,
  )

  logger.debug('dispatchAction', 'Action dispatched successfully', response.data)
  return response.data
}
