import { createFileRoute } from '@tanstack/react-router'

import { FeedbackFormPage } from '@/features/feedback-form/pages/feedback-form-page'
import type { FeedbackFormStyles } from '@/features/feedback-form/types/feedback-form'

interface FormSearchParams {
  formId?: string
  backgroundColor?: string
  primaryColor?: string
  fontFamily?: string
  borderRadius?: string
  inputBackgroundColor?: string
  inputBorderColor?: string
  inputTextColor?: string
  labelColor?: string
  submitButtonText?: string
  submitButtonColor?: string
  submitButtonTextColor?: string
}

export const Route = createFileRoute('/form')({
  validateSearch: (search: Record<string, unknown>): FormSearchParams => {
    return {
      formId: search.formId as string | undefined,
      backgroundColor: search.backgroundColor as string | undefined,
      primaryColor: search.primaryColor as string | undefined,
      fontFamily: search.fontFamily as string | undefined,
      borderRadius: search.borderRadius as string | undefined,
      inputBackgroundColor: search.inputBackgroundColor as string | undefined,
      inputBorderColor: search.inputBorderColor as string | undefined,
      inputTextColor: search.inputTextColor as string | undefined,
      labelColor: search.labelColor as string | undefined,
      submitButtonText: search.submitButtonText as string | undefined,
      submitButtonColor: search.submitButtonColor as string | undefined,
      submitButtonTextColor: search.submitButtonTextColor as string | undefined,
    }
  },
  component: FormRoute,
})

function FormRoute() {
  const {
    formId,
    backgroundColor,
    primaryColor,
    fontFamily,
    borderRadius,
    inputBackgroundColor,
    inputBorderColor,
    inputTextColor,
    labelColor,
    submitButtonText,
    submitButtonColor,
    submitButtonTextColor,
  } = Route.useSearch()

  if (!formId) {
    return (
      <div className="flex min-h-50 items-center justify-center p-6">
        <p className="text-sm text-red-600">Form ID is required.</p>
      </div>
    )
  }

  const styles: FeedbackFormStyles = {
    backgroundColor,
    primaryColor,
    fontFamily,
    borderRadius,
    inputBackgroundColor,
    inputBorderColor,
    inputTextColor,
    labelColor,
    submitButtonText,
    submitButtonColor,
    submitButtonTextColor,
  }

  return <FeedbackFormPage formId={formId} styles={styles} />
}
