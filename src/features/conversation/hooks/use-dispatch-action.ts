import { useMutation } from '@tanstack/react-query'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { dispatchAction, type DispatchActionRequest } from '@/features/conversation/apis/dispatch-action'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const useDispatchAction = () => {
  const { widgetConfig } = useWidgetConfigContext()

  return useMutation({
    mutationFn: (data: Omit<DispatchActionRequest, 'widgetConfig'>) => {
      logger.debug('useDispatchAction', 'Mutation triggered', data)
      return dispatchAction({
        ...data,
        widgetConfig,
      })
    },
    onSuccess: (data, variables) => {
      logger.debug('useDispatchAction', 'Mutation success', { data, variables })
    },
    onError: (error, variables) => {
      logger.debug('useDispatchAction', 'Mutation error', { error, variables })
    },
  })
}
