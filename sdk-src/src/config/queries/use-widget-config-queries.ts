import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

import { WidgetConfig } from '@/config/apis/widget-config'
import { widgetConfigKeys } from '@/config/constants/widget-config-keys'
import type { WidgetConfigDto } from '@/config/types/widget-config-dto'
import type { ViewOverride } from '@/core/view-override'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const WidgetConfigQueryOptions = (view: ViewOverride = {}) => {
  logger.debug('WidgetConfigQueryOptions', 'Creating widget config query options', { view })

  return queryOptions<WidgetConfigDto>({
    // The view is part of the key: switching language or theme is a different
    // config, fetched once and then held like the original.
    queryKey: [...widgetConfigKeys.CONFIG(), view.lang ?? '', view.theme ?? ''],
    queryFn: () => WidgetConfig(view),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useWidgetConfig(view: ViewOverride = {}) {
  logger.debug('useWidgetConfig', 'Initializing widget config query hook')

  return useSuspenseQuery(WidgetConfigQueryOptions(view))
}
