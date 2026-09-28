import { env } from '@/core/env'
import { publicApiClient } from '@/core/http'
import { viewBaseUrl, type ViewOverride } from '@/core/view-override'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import type { WidgetConfigDto } from '../types/widget-config-dto'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function WidgetConfig(view: ViewOverride = {}): Promise<WidgetConfigDto> {
  logger.debug('WidgetConfig', 'Fetching widget configuration', { view })

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to fetch widget configuration')
  }

  // The header's language / theme switch refetches the config from the view's
  // own base; everything else (chat traffic) stays on the configured base.
  const response = await publicApiClient.get(`/v1/widget/${widgetId}/config`, {
    baseURL: viewBaseUrl(env.baseURL, view),
  })
  logger.debug('WidgetConfig', 'Widget configuration fetched successfully', response.data)

  return response.data
}
