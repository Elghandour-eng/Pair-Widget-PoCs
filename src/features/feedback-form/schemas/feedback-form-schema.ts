import { z } from 'zod'

import type { FeedbackFormField } from '../types/feedback-form'

/**
 * Build a dynamic Zod schema for the feedback form.
 *
 * Contact fields (email, name, phone) are always required.
 * Each visible form field is required (string, min 1 char).
 */
export function createFeedbackFormSchema(visibleFields: FeedbackFormField[]) {
  const fieldSchemas: Record<string, z.ZodType> = {}

  // Contact fields — always required
  fieldSchemas.name = z.string().min(1, 'Name is required')
  fieldSchemas.email = z.string().min(1, 'Email is required').email('Please enter a valid email')
  fieldSchemas.phone = z.string().min(1, 'Phone number is required')

  // Dynamic visible fields — all required for now
  for (const field of visibleFields) {
    fieldSchemas[`field_${field.id}`] = z.string().min(1, `${field.label} is required`)
  }

  return z.object(fieldSchemas)
}

export type FeedbackFormValues = z.infer<ReturnType<typeof createFeedbackFormSchema>>
