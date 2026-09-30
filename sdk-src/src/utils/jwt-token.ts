import { jwtDecode } from 'jwt-decode'

import type { DecodedWidgetToken } from '@/types/jwt-token'
import { createDebugLogger, getFilePathFromUrl } from './logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Decodes a JWT token and returns the decoded payload
 * @param token - The JWT token string to decode
 * @returns The decoded token payload, or null if decoding fails
 */
export function decodeWidgetToken(token: string): DecodedWidgetToken | null {
  try {
    logger.debug('decodeWidgetToken', 'Decoding JWT token')
    const decoded = jwtDecode<DecodedWidgetToken>(token)
    logger.debug('decodeWidgetToken', 'Token decoded successfully', {
      widgetId: decoded.widgetId,
      contactId: decoded.contactId,
      workspaceId: decoded.workspaceId,
    })
    return decoded
  } catch (error) {
    logger.debug('decodeWidgetToken', 'Failed to decode token', error)
    return null
  }
}
