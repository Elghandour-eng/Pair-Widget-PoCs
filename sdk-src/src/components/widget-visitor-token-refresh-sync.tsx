import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useVisitorTokenRefresh } from '@/hooks/use-visitor-token-refresh'

/**
 * Sync component that monitors visitor token expiration and calls refreshFn
 * 30 seconds before accessTokenExpiresIn expires.
 * Must be rendered inside WidgetConfigProvider.
 */
export function WidgetVisitorTokenRefreshSync() {
  const { widgetConfig } = useWidgetConfigContext()
  useVisitorTokenRefresh({ widgetConfig })
  return null
}
