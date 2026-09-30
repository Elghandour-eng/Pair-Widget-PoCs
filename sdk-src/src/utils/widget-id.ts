import { createDebugLogger, getFilePathFromUrl } from './logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Gets the widget ID from global window.PairAiWidgetSettings or URL parameters (for development)
 * Priority order:
 * 1. window.PairAiWidgetSettings.widgetId (set by the embedding script)
 * 2. URL parameter (?widgetId=...) - for development only
 */
export function getWidgetId(): string | null {
  logger.debug('getWidgetId', 'Attempting to retrieve widget ID')

  // Try window.PairAiWidgetSettings first (set by embedding script)
  if (window.PairAiWidgetSettings?.widgetId) {
    const widgetId = window.PairAiWidgetSettings.widgetId
    logger.debug('getWidgetId', 'Widget ID found in window.PairAiWidgetSettings', { widgetId })
    return widgetId
  }

  // Try URL parameter (for development)
  const urlParams = new URLSearchParams(window.location.search)
  const widgetIdFromUrl = urlParams.get('widgetId')
  if (widgetIdFromUrl) {
    logger.debug('getWidgetId', 'Widget ID found in URL parameters (development mode)', { widgetId: widgetIdFromUrl })
    return widgetIdFromUrl
  }

  logger.debug('getWidgetId', 'Widget ID not found in window.PairAiWidgetSettings or URL parameters')
  return null
}
