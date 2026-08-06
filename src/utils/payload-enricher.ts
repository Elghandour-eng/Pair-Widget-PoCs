import type { WidgetConfig } from '@/config/types/widget-config'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface PayloadEnrichments {
  visitor_credential?: string
  headers?: Record<string, string>
  query_params?: Record<string, unknown>
}

/**
 * Constructs request payload enrichments (visitor_credential, headers, query_params)
 * using exclusively the mapped WidgetConfig and looking up keys in metadata.
 */
export function getPayloadEnrichments(widgetConfig: WidgetConfig): PayloadEnrichments {
  const enrichments: PayloadEnrichments = {}

  // 1. visitor_credential (sent if accessToken exists in visitorCredential)
  const visitorToken = widgetConfig.visitorCredential?.accessToken

  if (visitorToken && typeof visitorToken === 'string' && visitorToken.trim() !== '') {
    enrichments.visitor_credential = visitorToken
  }

  const metadata = widgetConfig.metadata || {}

  // 2. headers: lookup mapped hostHeaderMappings inside metadata
  const headerMappings = widgetConfig.hostHeaderMappings
  if (headerMappings && typeof headerMappings === 'object') {
    const resolvedHeaders: Record<string, string> = {}
    for (const [headerName, metadataKey] of Object.entries(headerMappings)) {
      if (metadataKey && metadata[metadataKey] !== undefined && metadata[metadataKey] !== null) {
        const rawValue = metadata[metadataKey]
        resolvedHeaders[headerName] = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue)
      } else {
        logger.debug(
          'getPayloadEnrichments',
          `Header mapping error: metadata key "${metadataKey}" for header "${headerName}" is missing in metadata`,
          { headerName, metadataKey, metadata },
        )
      }
    }
    if (Object.keys(resolvedHeaders).length > 0) {
      enrichments.headers = resolvedHeaders
    }
  }

  // 3. query_params: lookup mapped hostParamMappings inside metadata
  const paramMappings = widgetConfig.hostParamMappings
  if (paramMappings && typeof paramMappings === 'object') {
    const resolvedQueryParams: Record<string, unknown> = {}
    for (const [paramName, metadataKey] of Object.entries(paramMappings)) {
      if (metadataKey && metadata[metadataKey] !== undefined) {
        resolvedQueryParams[paramName] = metadata[metadataKey]
      } else {
        logger.debug(
          'getPayloadEnrichments',
          `Param mapping error: metadata key "${metadataKey}" for param "${paramName}" is missing in metadata`,
          { paramName, metadataKey, metadata },
        )
      }
    }
    if (Object.keys(resolvedQueryParams).length > 0) {
      enrichments.query_params = resolvedQueryParams
    }
  }

  logger.debug('getPayloadEnrichments', 'Generated payload enrichments from WidgetConfig', enrichments)
  return enrichments
}
