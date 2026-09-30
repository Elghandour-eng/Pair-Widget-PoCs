import { publicApiClient } from '@/core/http'
import type { FeedbackFormConfig, FeedbackFormSubmitPayload, FeedbackFormSubmitResponse } from '../types/feedback-form'

export async function getFeedbackFormConfig(formId: string): Promise<FeedbackFormConfig> {
  const response = await publicApiClient.get<FeedbackFormConfig>(`/v1/public/feedback-forms/${formId}`)
  return response.data
}

export async function submitFeedbackForm(
  formId: string,
  payload: FeedbackFormSubmitPayload,
): Promise<FeedbackFormSubmitResponse> {
  const response = await publicApiClient.post<FeedbackFormSubmitResponse>(
    `/v1/public/feedback-forms/${formId}/submit`,
    payload,
  )
  return response.data
}
