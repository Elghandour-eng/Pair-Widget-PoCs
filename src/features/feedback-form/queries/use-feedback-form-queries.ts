import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

import { getFeedbackFormConfig } from '../apis/feedback-form-api'
import type { FeedbackFormConfig } from '../types/feedback-form'

const feedbackFormKeys = {
  all: ['feedback-form'] as const,
  config: (formId: string) => [...feedbackFormKeys.all, 'config', formId] as const,
}

export const FeedbackFormConfigQueryOptions = (formId: string) => {
  return queryOptions<FeedbackFormConfig>({
    queryKey: feedbackFormKeys.config(formId),
    queryFn: () => getFeedbackFormConfig(formId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!formId,
  })
}

export function useFeedbackFormConfig(formId: string) {
  return useSuspenseQuery(FeedbackFormConfigQueryOptions(formId))
}
