import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

import { WidgetConfig } from '@/config/apis/widget-config'
import { widgetConfigKeys } from '@/config/constants/widget-config-keys'
import type { WidgetConfigResponse } from '@/config/types/widget-config'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const WidgetConfigQueryOptions = () => {
  logger.debug('WidgetConfigQueryOptions', 'Creating widget config query options')

  return queryOptions<WidgetConfigResponse>({
    queryKey: widgetConfigKeys.CONFIG(),
    queryFn: () => WidgetConfig(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useWidgetConfig() {
  logger.debug('useWidgetConfig', 'Initializing widget config query hook')

  return useSuspenseQuery(WidgetConfigQueryOptions())
}
