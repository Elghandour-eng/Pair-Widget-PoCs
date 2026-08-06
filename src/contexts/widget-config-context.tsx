import { useSuspenseQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

import { WidgetConfigQueryOptions } from '@/config/queries/use-widget-config-queries'
import type { PairAiWidgetSettings, WidgetConfig } from '@/config/types/widget-config'
import { mapToWidgetConfig } from '@/config/utils/map-widget-config'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface WidgetConfigContextType {
  widgetConfig: WidgetConfig
}

const WidgetConfigContext = createContext<WidgetConfigContextType | undefined>(undefined)

export function WidgetConfigProvider({ children }: { children: ReactNode }) {
  logger.debug('WidgetConfigProvider', 'Initializing widget config provider')

  // Fetch API config
  const { data: apiConfig } = useSuspenseQuery(WidgetConfigQueryOptions())

  // State to store postMessage settings from host SDK
  const [sdkConfig, setSdkConfig] = useState<Partial<PairAiWidgetSettings> | undefined>(undefined)

  // State to store dynamic metadata updates from postMessage
  const [dynamicMetadata, setDynamicMetadata] = useState<Record<string, unknown>>({})

  // Listen for postMessage from SDK
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sdk:config') {
        const receivedConfig = event.data.data
        if (receivedConfig) {
          logger.debug('WidgetConfigProvider', 'Received sdk:config via postMessage', receivedConfig)
          setSdkConfig(receivedConfig)
        }
      } else if (event.data?.type === 'metadata:update') {
        const receivedMetadata = event.data.data || event.data.metadata
        if (receivedMetadata && typeof receivedMetadata === 'object') {
          logger.debug('WidgetConfigProvider', 'Received metadata:update via postMessage', receivedMetadata)
          setDynamicMetadata((prev) => ({
            ...prev,
            ...receivedMetadata,
          }))
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Resolve window settings (combine local/parent window settings with postMessage sdkConfig)
  const windowSettings = useMemo(() => {
    const parentSettings = (function () {
      try {
        if (typeof window !== 'undefined') {
          const parentWin = window.parent !== window ? window.parent : null
          const topWin = window.top !== window ? window.top : null
          console.log('[WidgetConfigProvider] Trying parent/top windows:', {
            hasParentWin: !!parentWin,
            hasTopWin: !!topWin,
            parentSettingsObj: parentWin?.PairAiWidgetSettings,
            topSettingsObj: topWin?.PairAiWidgetSettings,
          })
          if (parentWin?.PairAiWidgetSettings) return parentWin.PairAiWidgetSettings
          if (topWin?.PairAiWidgetSettings) return topWin.PairAiWidgetSettings
        }
      } catch (err) {
        console.warn('[WidgetConfigProvider] Cross-origin block reading parent/top settings:', err)
      }
      return undefined
    })()

    const combined = {
      ...(parentSettings || window.PairAiWidgetSettings || {}),
      ...(sdkConfig || {}),
    } as PairAiWidgetSettings

    if (Object.keys(dynamicMetadata).length > 0) {
      combined.metadata = {
        ...(combined.metadata || {}),
        ...dynamicMetadata,
      }
    }

    // Preserve refreshFn function from parentSettings or local window if sdkConfig stripped it
    const refreshFn = parentSettings?.refreshFn || window.PairAiWidgetSettings?.refreshFn
    if (refreshFn) {
      combined.refreshFn = refreshFn
    }

    return combined
  }, [sdkConfig, dynamicMetadata])

  // Map to WidgetConfig
  const widgetConfig = useMemo(() => {
    logger.debug('WidgetConfigProvider', 'Mapping API response and window settings to WidgetConfig', {
      hasApiConfig: !!apiConfig,
      hasWindowSettings: !!windowSettings,
    })
    return mapToWidgetConfig(apiConfig, windowSettings as PairAiWidgetSettings)
  }, [apiConfig, windowSettings])

  logger.debug('WidgetConfigProvider', 'Widget config mapped successfully', widgetConfig)

  return <WidgetConfigContext.Provider value={{ widgetConfig }}>{children}</WidgetConfigContext.Provider>
}

export function useWidgetConfigContext() {
  const context = useContext(WidgetConfigContext)
  if (context === undefined) {
    throw new Error('useWidgetConfigContext must be used within a WidgetConfigProvider')
  }
  return context
}
