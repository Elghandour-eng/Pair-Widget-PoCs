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

/** Validation copy in both widget languages. */
const MSG = {
  en: {
    required: (label: string) => `${label} is required`,
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid mobile phone number',
    name: 'Please enter your real name (letters only, at least 2 characters)',
    message: 'Message is required',
  },
  ar: {
    required: (label: string) => `${label} مطلوب`,
    email: 'من فضلك أدخل بريدًا إلكترونيًا صحيحًا',
    phone: 'من فضلك أدخل رقم هاتف محمول صحيحًا',
    name: 'من فضلك أدخل اسمًا صحيحًا (حروف فقط، حرفان على الأقل)',
    message: 'الرسالة مطلوبة',
  },
}

/** Letters (any script), spaces and common name punctuation — no digits. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]{1,79}$/u
const isName = (v: string) => NAME_RE.test(v.trim())

export function createPreChatFormSchema(preChatFields: PreChatField[], requireMessage = true, locale?: string) {
  const t = /^ar/i.test(locale ?? 'en') ? MSG.ar : MSG.en
  const schemaObject: Record<string, z.ZodTypeAny> = {}

  preChatFields.forEach((field) => {
    // Check if this is a phone number field by type or name
    const isPhoneField = field.type === 'phone_number' || field.name === 'phoneNumber'

    if (isPhoneField) {
      // Phone validation - mobile only
      if (field.required) {
        schemaObject[field.name] = z
          .string()
          .min(1, { message: t.required(field.label) })
          .refine(isMobilePhone, { message: t.phone })
      } else {
        schemaObject[field.name] = z
          .string()
          .optional()
          .refine((val) => !val || val.trim() === '' || isMobilePhone(val), { message: t.phone })
      }
      return
    }

    // A name field takes real names: letters in any script, no digits.
    const isNameField = /name/i.test(field.name) && field.type !== 'email'
    if (isNameField) {
      if (field.required) {
        schemaObject[field.name] = z
          .string()
          .min(1, { message: t.required(field.label) })
          .refine(isName, { message: t.name })
      } else {
        schemaObject[field.name] = z
          .string()
          .optional()
          .refine((val) => !val || val.trim() === '' || isName(val), { message: t.name })
      }
      return
    }

    switch (field.type) {
      case 'email':
        if (field.required) {
          // Required email: must be present and valid
          schemaObject[field.name] = z
            .string()
            .min(1, { message: t.required(field.label) })
            .email({ message: t.email })
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
                message: t.email,
              },
            )
        }
        break
      case 'text':
      default:
        if (field.required) {
          schemaObject[field.name] = z.string().min(1, { message: t.required(field.label) })
        } else {
          // Optional text: allow empty string
          schemaObject[field.name] = z.string().optional().or(z.literal(''))
        }
        break
    }
  })

  // The message box is required while it is shown; a form the studio set to
  // fields-only registers the contact without one.
  schemaObject.message = requireMessage
    ? z.string().min(1, { message: t.message })
    : z.string().optional().or(z.literal(''))

  return z.object(schemaObject)
}

export type PreChatFormValues = z.infer<ReturnType<typeof createPreChatFormSchema>>
