import { publicApiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import type { WidgetConfigResponse } from '../types/widget-config'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function WidgetConfig(): Promise<WidgetConfigResponse> {
  logger.debug('WidgetConfig', 'Fetching widget configuration')

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to fetch widget configuration')
  }

  const response = await publicApiClient.get(`/v1/widget/${widgetId}/config`)
  logger.debug('WidgetConfig', 'Widget configuration fetched successfully', response.data)

  return response.data
}
