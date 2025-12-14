import { useEffect, useRef } from 'react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Component that syncs widget color from config to SDK bubble
 * Must be rendered inside both WidgetConfigProvider and WidgetUIProvider
 * Sends color immediately when config is available, and also with ready message
 */
export function WidgetColorSync() {
  const { widgetConfig } = useWidgetConfigContext()
  const { setBubbleColor } = useWidgetUIContext()
  const hasSentColorRef = useRef(false)

  useEffect(() => {
    if (widgetConfig.primaryColor && !hasSentColorRef.current) {
      logger.debug('WidgetColorSync', 'Sending bubble color to SDK', {
        color: widgetConfig.primaryColor,
      })
      setBubbleColor(widgetConfig.primaryColor)
      hasSentColorRef.current = true
    }
  }, [widgetConfig.primaryColor, setBubbleColor])

  // Also send color with ready message if SDK requests it
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sdk:config' && widgetConfig.primaryColor) {
        // SDK sent config request, send color immediately
        logger.debug('WidgetColorSync', 'SDK requested config, sending color', {
          color: widgetConfig.primaryColor,
        })
        setBubbleColor(widgetConfig.primaryColor)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [widgetConfig.primaryColor, setBubbleColor])

  return null
}
