import { useSuspenseQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useMemo } from 'react'

import { WidgetConfigQueryOptions } from '@/config/queries/use-widget-config-queries'
import type { WidgetConfig } from '@/config/types/widget-config'
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

  // Get window settings
  const windowSettings = window.PairAiWidgetSettings

  // Map to WidgetConfig
  const widgetConfig = useMemo(() => {
    logger.debug('WidgetConfigProvider', 'Mapping API response and window settings to WidgetConfig', {
      hasApiConfig: !!apiConfig,
      hasWindowSettings: !!windowSettings,
    })
    return mapToWidgetConfig(apiConfig, windowSettings)
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
