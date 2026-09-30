import { createDebugLogger, getFilePathFromUrl } from '../utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const TOKEN_KEY_PREFIX = 'pair_ai_widget_token'

function getTokenKey(widgetId: string | null): string {
  if (!widgetId) {
    // Fallback to old key for backward compatibility if widgetId is not available
    return TOKEN_KEY_PREFIX
  }
  return `${TOKEN_KEY_PREFIX}_${widgetId}`
}

// Event name for token changes
export const TOKEN_CHANGED_EVENT = 'pair-ai-widget:token-changed'

export const tokenStorage = {
  get(widgetId: string | null): string | null {
    if (typeof window === 'undefined') {
      logger.debug('tokenStorage', 'Window is undefined, returning null')
      return null
    }
    const key = getTokenKey(widgetId)
    const token = localStorage.getItem(key)
    logger.debug('tokenStorage', 'Getting token', { widgetId, key, hasToken: !!token })
    return token
  },

  set(token: string, widgetId: string | null): void {
    if (typeof window === 'undefined') {
      logger.debug('tokenStorage', 'Window is undefined, returning void')
      return
    }
    // A backend that still requires the pre-chat form answers register with
    // token: null. Storing that literal made every later call send
    // `Authorization: Bearer null` and 401 — so nothing false-y is ever kept.
    if (!token || token === 'null' || token === 'undefined') {
      logger.debug('tokenStorage', 'Refusing to store an empty token', { widgetId })
      return
    }
    const key = getTokenKey(widgetId)
    localStorage.setItem(key, token)
    logger.debug('tokenStorage', 'Token saved', { widgetId, key })

    // Dispatch event so listeners (like UnreadMessagesProvider) can update immediately without polling
    window.dispatchEvent(new CustomEvent(TOKEN_CHANGED_EVENT, { detail: { widgetId, hasToken: true } }))
  },

  remove(widgetId: string | null): void {
    if (typeof window === 'undefined') {
      logger.debug('tokenStorage', 'Window is undefined, returning void')
      return
    }
    const key = getTokenKey(widgetId)
    localStorage.removeItem(key)
    logger.debug('tokenStorage', 'Token removed', { widgetId, key })

    // Dispatch event so listeners know the token is gone
    window.dispatchEvent(new CustomEvent(TOKEN_CHANGED_EVENT, { detail: { widgetId, hasToken: false } }))
  },
}
