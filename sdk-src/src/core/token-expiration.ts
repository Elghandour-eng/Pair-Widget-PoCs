import { decodeWidgetToken } from '../utils/jwt-token'
import { createDebugLogger, getFilePathFromUrl } from '../utils/logger'
import { TOKEN_KEY_PREFIX } from './token-storage'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Checks all tokens in localStorage and removes any that are expired.
 * This should be called at application startup.
 */
export function checkAndRemoveExpiredTokens(): void {
  if (typeof window === 'undefined') {
    return
  }

  logger.debug('tokenExpiration', 'Checking for expired tokens')

  const keysToRemove: string[] = []

  // Iterate over all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(TOKEN_KEY_PREFIX)) {
      const token = localStorage.getItem(key)
      if (token) {
        // We use the existing decode utility which handles the jwt-decode library
        // and provides type safety for the expiration field
        const decoded = decodeWidgetToken(token)

        if (decoded && decoded.exp) {
          // JWT exp is in seconds, Date.now() is in milliseconds
          const currentTime = Date.now() / 1000

          if (decoded.exp < currentTime) {
            logger.debug('tokenExpiration', 'Found expired token', {
              key,
              exp: decoded.exp,
              now: currentTime,
              diff: decoded.exp - currentTime,
            })
            keysToRemove.push(key)
          }
        }
      }
    }
  }

  if (keysToRemove.length > 0) {
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key)
      logger.debug('tokenExpiration', 'Removed expired token', { key })
    })
    logger.debug('tokenExpiration', `Cleaned up ${keysToRemove.length} expired tokens`)
  } else {
    logger.debug('tokenExpiration', 'No expired tokens found')
  }
}
