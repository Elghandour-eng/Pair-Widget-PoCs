import { useMutation } from '@tanstack/react-query'

import { submitCsat, type SubmitCsatRequest } from '@/features/conversation/apis/submit-csat'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const useSubmitCsat = () => {
  return useMutation({
    mutationFn: (data: SubmitCsatRequest) => {
      logger.debug('useSubmitCsat', 'Mutation triggered', data)
      return submitCsat(data)
    },
    onSuccess: (_, variables) => {
      logger.debug('useSubmitCsat', 'Mutation success', variables)
    },
    onError: (error, variables) => {
      logger.debug('useSubmitCsat', 'Mutation error', { error, variables })
    },
  })
}
