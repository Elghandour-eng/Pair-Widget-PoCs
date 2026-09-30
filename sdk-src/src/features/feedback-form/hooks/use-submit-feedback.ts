import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { submitFeedbackForm } from '../apis/feedback-form-api'
import type { FeedbackFormSubmitPayload, FeedbackFormSubmitResponse } from '../types/feedback-form'

interface UseSubmitFeedbackOptions {
  formId: string
  onSuccess?: (data: FeedbackFormSubmitResponse) => void
  onError?: (error: string) => void
}

export function useSubmitFeedback({ formId, onSuccess, onError }: UseSubmitFeedbackOptions) {
  return useMutation({
    mutationFn: (payload: FeedbackFormSubmitPayload) => submitFeedbackForm(formId, payload),
    onSuccess: (data) => {
      onSuccess?.(data)
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const apiMessage = error.response?.data?.message
        if (error.response?.status === 429) {
          onError?.('Too many submissions. Please wait a moment and try again.')
          return
        }
        if (apiMessage) {
          onError?.(apiMessage)
          return
        }
      }
      onError?.('Something went wrong. Please try again.')
    },
  })
}
