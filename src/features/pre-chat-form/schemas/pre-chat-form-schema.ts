import type { PreChatField } from '@/config/types/widget-config'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js/max'
import { z } from 'zod'

/**
 * Validates that a phone number is a mobile phone (not landline or VOIP).
 * Uses libphonenumber-js/max for extended metadata including type detection.
 */
function isMobilePhone(value: string): boolean {
  if (!value || value.trim() === '') return false

  try {
    if (!isValidPhoneNumber(value)) return false

    const phoneNumber = parsePhoneNumber(value)
    if (!phoneNumber) return false

    const type = phoneNumber.getType()
    // Accept MOBILE and FIXED_LINE_OR_MOBILE (some countries don't distinguish)
    return type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE'
  } catch {
    return false
  }
}

export function createPreChatFormSchema(preChatFields: PreChatField[]) {
  const schemaObject: Record<string, z.ZodTypeAny> = {}

  preChatFields.forEach((field) => {
    // Check if this is a phone number field by type or name
    const isPhoneField = field.type === 'phone_number' || field.name === 'phoneNumber'

    if (isPhoneField) {
      // Phone validation - mobile only
      if (field.required) {
        schemaObject[field.name] = z
          .string()
          .min(1, { message: `${field.label} is required` })
          .refine(isMobilePhone, {
            message: 'Please enter a valid mobile phone number',
          })
      } else {
        schemaObject[field.name] = z
          .string()
          .optional()
          .refine((val) => !val || val.trim() === '' || isMobilePhone(val), {
            message: 'Please enter a valid mobile phone number',
          })
      }
      return
    }

    switch (field.type) {
      case 'email':
        if (field.required) {
          // Required email: must be present and valid
          schemaObject[field.name] = z
            .string()
            .min(1, { message: `${field.label} is required` })
            .email({ message: 'Please enter a valid email address' })
        } else {
          // Optional email: if provided, must be valid; empty string is allowed
          schemaObject[field.name] = z
            .string()
            .optional()
            .refine(
              (val) => {
                // Allow empty/undefined values
                if (!val || val.trim() === '') {
                  return true
                }
                // If value is provided, validate email format
                return z.string().email().safeParse(val).success
              },
              {
                message: 'Please enter a valid email address',
              },
            )
        }
        break
      case 'text':
      default:
        if (field.required) {
          schemaObject[field.name] = z.string().min(1, { message: `${field.label} is required` })
        } else {
          // Optional text: allow empty string
          schemaObject[field.name] = z.string().optional().or(z.literal(''))
        }
        break
    }
  })

  // Message is always required by default
  schemaObject.message = z.string().min(1, { message: 'Message is required' })

  return z.object(schemaObject)
}

export type PreChatFormValues = z.infer<ReturnType<typeof createPreChatFormSchema>>
