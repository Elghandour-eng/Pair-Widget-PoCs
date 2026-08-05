import { useCallback, useEffect, useRef, useState } from 'react'

import type { WidgetConfig } from '@/config/types/widget-config'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// Warning buffer: trigger refresh 30 seconds before expiration
const REFRESH_WARNING_BUFFER_MS = 30_000

/**
 * Calculates absolute expiration timestamp in milliseconds from various formats:
 * 1. Absolute Unix timestamp in ms (> 1_000_000_000_000)
 * 2. Absolute Unix timestamp in s (> 1_000_000_000)
 * 3. Relative duration in seconds (<= 1_000_000_000, e.g. 84600)
 */
function getExpirationTimestampMs(expiresAt: number | undefined): number | null {
  if (expiresAt === undefined || expiresAt === null || isNaN(expiresAt)) {
    return null
  }

  const nowMs = Date.now()

  if (expiresAt > 1_000_000_000_000) {
    // Already milliseconds timestamp
    return expiresAt
  }

  if (expiresAt > 1_000_000_000) {
    // Seconds timestamp
    return expiresAt * 1000
  }

  // Relative duration in seconds
  return nowMs + expiresAt * 1000
}

interface UseVisitorTokenRefreshOptions {
  widgetConfig: WidgetConfig
}

export function useVisitorTokenRefresh({ widgetConfig }: UseVisitorTokenRefreshOptions) {
  const visitorCredential = widgetConfig.visitorCredential
  const [accessToken, setAccessToken] = useState<string | undefined>(visitorCredential?.accessToken)
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState<number | undefined>(
    visitorCredential?.accessTokenExpiresAt,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const refreshFnRef = useRef(visitorCredential?.refreshFn)

  // Keep refreshFn ref updated
  useEffect(() => {
    refreshFnRef.current = widgetConfig.visitorCredential?.refreshFn
  }, [widgetConfig.visitorCredential?.refreshFn])

  // Update state if initial config props change
  useEffect(() => {
    if (widgetConfig.visitorCredential?.accessToken !== undefined) {
      setAccessToken(widgetConfig.visitorCredential.accessToken)
    }
    if (widgetConfig.visitorCredential?.accessTokenExpiresAt !== undefined) {
      setAccessTokenExpiresAt(widgetConfig.visitorCredential.accessTokenExpiresAt)
    }
  }, [widgetConfig.visitorCredential?.accessToken, widgetConfig.visitorCredential?.accessTokenExpiresAt])

  const executeRefresh = useCallback(async () => {
    const fn = refreshFnRef.current
    if (!fn) {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        logger.debug(
          'useVisitorTokenRefresh',
          'No local refreshFn, sending widget:requestTokenRefresh postMessage to host SDK',
        )
        window.parent.postMessage({ type: 'widget:requestTokenRefresh' }, '*')
      } else {
        logger.debug('useVisitorTokenRefresh', 'No refreshFn provided and not in iframe, skipping refresh execution')
      }
      return
    }

    logger.debug('useVisitorTokenRefresh', 'Triggering visitor token refresh...')
    setIsRefreshing(true)

    try {
      const res = await fn()
      logger.debug('useVisitorTokenRefresh', 'Visitor token refresh successful', res)

      if (res) {
        if (res.accessToken) {
          setAccessToken(res.accessToken)
          if (window.PairAiWidgetSettings) {
            window.PairAiWidgetSettings.accessToken = res.accessToken
          }
        }
        if (res.accessTokenExpiresAt !== undefined) {
          setAccessTokenExpiresAt(res.accessTokenExpiresAt)
          if (window.PairAiWidgetSettings) {
            window.PairAiWidgetSettings.accessTokenExpiresAt = res.accessTokenExpiresAt
          }
        }
      }
    } catch (error) {
      logger.debug('useVisitorTokenRefresh', 'Error during visitor token refresh execution', error)
      // Retry in 5 seconds if refresh failed
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        executeRefresh()
      }, 5000)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const inIframe = typeof window !== 'undefined' && window.parent && window.parent !== window
    if ((!refreshFnRef.current && !inIframe) || accessTokenExpiresAt === undefined) {
      logger.debug(
        'useVisitorTokenRefresh',
        'Missing refreshFn/iframe context or accessTokenExpiresAt, no timer scheduled',
      )
      return
    }

    const expMs = getExpirationTimestampMs(accessTokenExpiresAt)
    if (!expMs) return

    const nowMs = Date.now()
    const targetRefreshTimeMs = expMs - REFRESH_WARNING_BUFFER_MS
    const delayMs = targetRefreshTimeMs - nowMs

    logger.debug('useVisitorTokenRefresh', 'Visitor token expiration timer setup', {
      nowMs: new Date(nowMs).toISOString(),
      expMs: new Date(expMs).toISOString(),
      targetRefreshTimeMs: new Date(targetRefreshTimeMs).toISOString(),
      delayMs,
      delaySeconds: Math.round(delayMs / 1000),
    })

    if (delayMs <= 0) {
      logger.debug(
        'useVisitorTokenRefresh',
        'Token is expiring in less than 30s or already expired. Triggering immediately.',
      )
      executeRefresh()
    } else {
      logger.debug(
        'useVisitorTokenRefresh',
        `Scheduling visitor token refresh in ${Math.round(delayMs / 1000)} seconds`,
      )
      timerRef.current = setTimeout(() => {
        executeRefresh()
      }, delayMs)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [accessTokenExpiresAt, executeRefresh])

  return {
    accessToken,
    accessTokenExpiresAt,
    isRefreshing,
    refreshTokenNow: executeRefresh,
  }
}
