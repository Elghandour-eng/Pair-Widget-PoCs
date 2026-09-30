import { Suspense } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/queryClient'
import { FeedbackForm } from '../components/feedback-form'
import type { FeedbackFormStyles } from '../types/feedback-form'

interface FeedbackFormPageProps {
  formId: string
  styles?: FeedbackFormStyles
}

function FeedbackFormLoading() {
  return (
    <div className="flex min-h-50 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        <p className="text-sm text-gray-500">Loading form...</p>
      </div>
    </div>
  )
}

function FeedbackFormError() {
  return (
    <div className="flex min-h-50 items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm text-red-600">Unable to load the form. Please try again later.</p>
      </div>
    </div>
  )
}

export function FeedbackFormPage({ formId, styles }: FeedbackFormPageProps) {
  if (!formId) {
    return (
      <div className="flex min-h-50 items-center justify-center p-6">
        <p className="text-sm text-red-600">Form ID is required.</p>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<FeedbackFormLoading />}>
        <FeedbackFormErrorBoundary>
          <FeedbackForm formId={formId} styles={styles} />
        </FeedbackFormErrorBoundary>
      </Suspense>
    </QueryClientProvider>
  )
}

// Simple error boundary for the form
import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class FeedbackFormErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <FeedbackFormError />
    }
    return this.props.children
  }
}
