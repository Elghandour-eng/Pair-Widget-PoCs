import { useSuspenseQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, startTransition, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { WidgetConfigQueryOptions } from '@/config/queries/use-widget-config-queries'
import type { PairAiWidgetSettings, WidgetConfig } from '@/config/types/widget-config'
import { mapToWidgetConfig } from '@/config/utils/map-widget-config'
import { getViewOverride, setViewOverride, type ViewOverride } from '@/core/view-override'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface WidgetConfigContextType {
  widgetConfig: WidgetConfig
  /** The visitor's own language/theme choice, from the header controls. */
  view: ViewOverride
  setView: (view: ViewOverride) => void
}

const WidgetConfigContext = createContext<WidgetConfigContextType | undefined>(undefined)

export function WidgetConfigProvider({ children }: { children: ReactNode }) {
  logger.debug('WidgetConfigProvider', 'Initializing widget config provider')

  // The visitor's language/theme choice: kept per widget, applied by fetching
  // the config again from the matching /pv base.
  const [view, setViewState] = useState<ViewOverride>(() => getViewOverride(getWidgetId()))
  const setView = (next: ViewOverride) => {
    setViewOverride(getWidgetId(), next)
    // A transition keeps the current design on screen while the re-themed /
    // re-translated config loads — no white flash from the suspense boundary.
    startTransition(() => setViewState(next))
    // Announce the switch to whoever hosts us — it shows up in any postMessage
    // console watching the SDK, and a host page could react to it too.
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'widget:viewChanged', data: { lang: next.lang ?? 'default', theme: next.theme ?? 'design' } },
          '*',
        )
      }
    } catch {
      // Cross-origin host without a listener: nothing to announce to.
    }
  }

  // The listener below is bound once, so it reads the live view through a ref
  // rather than closing over a stale one.
  const viewRef = useRef(view)
  viewRef.current = view
  const setViewRef = useRef(setView)
  setViewRef.current = setView

  // Fetch API config
  const { data: apiConfig } = useSuspenseQuery(WidgetConfigQueryOptions(view))

  // The document follows the config's own locale, so an Arabic view lays the
  // whole widget out right-to-left exactly as the studio previews it.
  useEffect(() => {
    const locale = typeof apiConfig.locale === 'string' ? apiConfig.locale : 'en'
    document.documentElement.lang = locale
    document.documentElement.dir = /^(ar|he|fa|ur)/i.test(locale) ? 'rtl' : 'ltr'
  }, [apiConfig.locale])

  // The studio's panel font applies to the whole widget; without one the
  // stylesheet's own stack stays.
  useEffect(() => {
    document.body.style.fontFamily = apiConfig.panel_font_family ?? ''
    // Text that names DM Sans itself steps aside too (see styles.css).
    document.body.classList.toggle('pair-panel-font', !!apiConfig.panel_font_family)
  }, [apiConfig.panel_font_family])

  // State to store postMessage settings from host SDK
  const [sdkConfig, setSdkConfig] = useState<Partial<PairAiWidgetSettings> | undefined>(undefined)

  // State to store dynamic metadata updates from postMessage
  const [dynamicMetadata, setDynamicMetadata] = useState<Record<string, unknown>>({})
  const dynamicMetadataRef = useRef(dynamicMetadata)
  dynamicMetadataRef.current = dynamicMetadata

  // Listen for postMessage from SDK
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sdk:config') {
        const receivedConfig = event.data.data
        if (receivedConfig) {
          logger.debug('WidgetConfigProvider', 'Received sdk:config via postMessage', receivedConfig)
          setSdkConfig({
            ...receivedConfig,
            _updatedAt: Date.now(),
          })
        }
      } else if (
        event.data?.type === 'sdk:setView' ||
        event.data?.type === 'sdk:setLanguage' ||
        event.data?.type === 'sdk:setTheme'
      ) {
        // The host switching language/theme at runtime. The visitor's own header
        // controls call the very same `setView`, so a host switch and a visitor
        // switch are the same operation — no reload, no separate code path.
        const payload = (event.data.data ?? event.data) as { lang?: unknown; theme?: unknown }
        const lang = payload.lang === 'en' || payload.lang === 'ar' ? payload.lang : undefined
        const theme = payload.theme === 'light' || payload.theme === 'dark' ? payload.theme : undefined
        const current = viewRef.current
        const next: ViewOverride =
          event.data.type === 'sdk:setLanguage'
            ? { ...current, lang }
            : event.data.type === 'sdk:setTheme'
              ? { ...current, theme }
              : { lang, theme }
        logger.debug('WidgetConfigProvider', 'Received a view change from the host', next)
        setViewRef.current(next)
      } else if (event.data?.type === 'sdk:getState') {
        // A host that loaded after the widget can ask where things stand.
        try {
          window.parent?.postMessage(
            {
              type: 'widget:state',
              data: {
                lang: viewRef.current.lang ?? 'default',
                theme: viewRef.current.theme ?? 'design',
                metadataKeys: Object.keys(dynamicMetadataRef.current),
              },
            },
            '*',
          )
        } catch {
          // Cross-origin host without a listener: nothing to answer to.
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

  return <WidgetConfigContext.Provider value={{ widgetConfig, view, setView }}>{children}</WidgetConfigContext.Provider>
}

export function useWidgetConfigContext() {
  const context = useContext(WidgetConfigContext)
  if (context === undefined) {
    throw new Error('useWidgetConfigContext must be used within a WidgetConfigProvider')
  }
  return context
}
