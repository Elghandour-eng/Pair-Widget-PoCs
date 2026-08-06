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
function getExpirationTimestampMs(expiresAt: number | undefined, baseTimeMs: number): number | null {
  if (expiresAt === undefined || expiresAt === null || isNaN(expiresAt)) {
    return null
  }

  if (expiresAt > 1_000_000_000_000) {
    // Already milliseconds timestamp
    return expiresAt
  }

  if (expiresAt > 1_000_000_000) {
    // Seconds timestamp
    return expiresAt * 1000
  }

  // Relative duration in seconds
  return baseTimeMs + expiresAt * 1000
}

interface UseVisitorTokenRefreshOptions {
  widgetConfig: WidgetConfig
}

export function useVisitorTokenRefresh({ widgetConfig }: UseVisitorTokenRefreshOptions) {
  const visitorCredential = widgetConfig.visitorCredential
  const initialExpires = visitorCredential?.accessTokenExpiresIn
  const [accessToken, setAccessToken] = useState<string | undefined>(visitorCredential?.accessToken)
  const [accessTokenExpiresIn, setAccessTokenExpiresIn] = useState<number | undefined>(initialExpires)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const refreshFnRef = useRef(visitorCredential?.refreshFn)

  // Keep refreshFn ref updated
  useEffect(() => {
    refreshFnRef.current = widgetConfig.visitorCredential?.refreshFn
  }, [widgetConfig.visitorCredential?.refreshFn])

  // Update state whenever widgetConfig.visitorCredential updates
  useEffect(() => {
    const vc = widgetConfig.visitorCredential
    if (!vc) return

    if (vc.accessToken !== undefined) {
      setAccessToken(vc.accessToken)
    }
    const currentExpires = vc.accessTokenExpiresIn
    if (currentExpires !== undefined) {
      setAccessTokenExpiresIn(currentExpires)
    }
    logger.debug('useVisitorTokenRefresh', 'Updated credentials from widgetConfig', {
      accessToken: vc.accessToken,
      accessTokenExpiresIn: currentExpires,
      _updatedAt: vc._updatedAt,
    })
    setLastRefreshedAt(Date.now())
  }, [
    widgetConfig.visitorCredential?.accessToken,
    widgetConfig.visitorCredential?.accessTokenExpiresIn,
    widgetConfig.visitorCredential?._updatedAt,
  ])

  const executeRefresh = useCallback(async () => {
    const fn = refreshFnRef.current
    if (!fn) {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        logger.debug(
          'useVisitorTokenRefresh',
          'No local refreshFn in iframe, sending widget:requestTokenRefresh postMessage to host SDK',
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
        const newExpires = res.accessTokenExpiresIn
        if (newExpires !== undefined) {
          setAccessTokenExpiresIn(newExpires)
          if (window.PairAiWidgetSettings) {
            window.PairAiWidgetSettings.accessTokenExpiresIn = newExpires
          }
        }
        setLastRefreshedAt(Date.now())
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
    if ((!refreshFnRef.current && !inIframe) || accessTokenExpiresIn === undefined) {
      logger.debug(
        'useVisitorTokenRefresh',
        'Missing refreshFn/iframe context or accessTokenExpiresIn, no timer scheduled',
        { hasRefreshFn: !!refreshFnRef.current, inIframe, accessTokenExpiresIn },
      )
      return
    }

    const expMs = getExpirationTimestampMs(accessTokenExpiresIn, lastRefreshedAt)
    if (!expMs) return

    const nowMs = Date.now()
    const targetRefreshTimeMs = expMs - REFRESH_WARNING_BUFFER_MS
    const delayMs = targetRefreshTimeMs - nowMs

    const logDetails = {
      accessTokenExpiresIn,
      now: new Date(nowMs).toLocaleTimeString(),
      expiresAt: new Date(expMs).toLocaleTimeString(),
      targetRefreshTime: new Date(targetRefreshTimeMs).toLocaleTimeString(),
      delayMs,
      delaySeconds: (delayMs / 1000).toFixed(1),
    }

    logger.debug('useVisitorTokenRefresh', 'Visitor token expiration timer setup', logDetails)

    if (delayMs <= 0) {
      logger.debug(
        'useVisitorTokenRefresh',
        'Token is expiring in less than 30s or already expired. Triggering refresh immediately.',
      )
      executeRefresh()
    } else {
      logger.debug(
        'useVisitorTokenRefresh',
        `Scheduling visitor token refresh in ${(delayMs / 1000).toFixed(1)} seconds`,
      )
      timerRef.current = setTimeout(() => {
        logger.debug('useVisitorTokenRefresh', 'Timer fired! Executing token refresh...')
        executeRefresh()
      }, delayMs)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [accessTokenExpiresIn, lastRefreshedAt, executeRefresh])

  return {
    accessToken,
    accessTokenExpiresIn,
    isRefreshing,
    refreshTokenNow: executeRefresh,
  }
}
