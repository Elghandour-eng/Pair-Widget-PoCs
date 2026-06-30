import { useEffect, useRef } from 'react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Component that syncs widget color and launcher configuration from config to SDK bubble
 * Must be rendered inside both WidgetConfigProvider and WidgetUIProvider
 */
export function WidgetColorSync() {
  const { widgetConfig } = useWidgetConfigContext()
  const { setBubbleColor } = useWidgetUIContext()
  const hasSentConfigRef = useRef(false)

  const sendConfigToSdk = () => {
    if (window.parent && window.self !== window.top) {
      const configPayload = {
        primaryColor: widgetConfig.primaryColor,
        position: widgetConfig.position,
        type: widgetConfig.type,
        launcherTitle: widgetConfig.launcherTitle,
        openAutomatically: widgetConfig.openAutomatically,
        launcherStyles: widgetConfig.launcherStyles,
        showFooter: widgetConfig.showFooter,
      }
      logger.debug('WidgetColorSync', 'Sending widget config update to SDK', configPayload)
      window.parent.postMessage({ type: 'widget:configUpdated', config: configPayload }, '*')
    }
  }

  useEffect(() => {
    if (widgetConfig.primaryColor && !hasSentConfigRef.current) {
      // Send legacy bubble color for safety
      setBubbleColor(widgetConfig.primaryColor)
      // Send complete config update to SDK
      sendConfigToSdk()
      hasSentConfigRef.current = true
    }
  }, [widgetConfig, setBubbleColor])

  // Also send color and config when SDK requests config
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sdk:config' && widgetConfig.primaryColor) {
        logger.debug('WidgetColorSync', 'SDK requested config, syncing configuration')
        setBubbleColor(widgetConfig.primaryColor)
        sendConfigToSdk()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [widgetConfig, setBubbleColor])

  return null
}
