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
  const lastSentRef = useRef('')

  const sendConfigToSdk = () => {
    if (window.parent && window.self !== window.top) {
      const configPayload = {
        primaryColor: widgetConfig.primaryColor,
        position: widgetConfig.position,
        type: widgetConfig.type,
        launcherTitle: widgetConfig.launcherTitle,
        openAutomatically: widgetConfig.openAutomatically,
        launcherStyles: widgetConfig.launcherStyles,
        launcherDesign: widgetConfig.launcherDesign,
        showFooter: widgetConfig.showFooter,
        // The studio's saved panel size, so the SDK sizes its holder to the
        // design even when the pasted snippet predates it.
        panel: widgetConfig.launcherDesign?.panel,
      }
      logger.debug('WidgetColorSync', 'Sending widget config update to SDK', configPayload)
      window.parent.postMessage({ type: 'widget:configUpdated', config: configPayload }, '*')
    }
  }

  useEffect(() => {
    // Re-send whenever the mapped config actually changes — a language or
    // theme switch re-fetches the config, and the launcher must follow it.
    const fingerprint = JSON.stringify([
      widgetConfig.primaryColor,
      widgetConfig.position,
      widgetConfig.type,
      widgetConfig.launcherTitle,
      widgetConfig.launcherStyles,
      widgetConfig.launcherDesign,
      widgetConfig.launcherDesign?.panel,
      widgetConfig.showFooter,
    ])
    if (widgetConfig.primaryColor && lastSentRef.current !== fingerprint) {
      // Send legacy bubble color for safety
      setBubbleColor(widgetConfig.primaryColor)
      // Send complete config update to SDK
      sendConfigToSdk()
      lastSentRef.current = fingerprint
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
