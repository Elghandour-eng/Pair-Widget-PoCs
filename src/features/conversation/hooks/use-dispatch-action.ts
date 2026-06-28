import { useMutation } from '@tanstack/react-query'

import { dispatchAction, type DispatchActionRequest } from '@/features/conversation/apis/dispatch-action'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const useDispatchAction = () => {
  return useMutation({
    mutationFn: (data: DispatchActionRequest) => {
      logger.debug('useDispatchAction', 'Mutation triggered', data)
      return dispatchAction(data)
    },
    onSuccess: (data, variables) => {
      logger.debug('useDispatchAction', 'Mutation success', { data, variables })
    },
    onError: (error, variables) => {
      logger.debug('useDispatchAction', 'Mutation error', { error, variables })
    },
  })
}
