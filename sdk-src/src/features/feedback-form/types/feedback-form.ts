// ── API Response Types ──

export interface FeedbackFormFieldOption {
  label: string
  value: string
}

export interface FeedbackFormField {
  id: string
  fieldType: 'system' | 'custom'
  systemField?: string
  customFieldId?: string
  label: string
  isVisible: boolean
  isRequired: boolean
  defaultValue: string | boolean | null
  createdAt: string
  updatedAt: string
  /** From backend: text | email | number | textarea | select | etc. */
  inputType?: string
  placeholder?: string | null
  options?: FeedbackFormFieldOption[] | null
}

export interface FeedbackFormConfig {
  ulid: string
  name: string
  isActive: boolean
  isEnable: boolean
  createdAt: string
  updatedAt: string
  fields: FeedbackFormField[]
}

// ── Submit Types ──

export interface FeedbackFormSubmitFieldValue {
  fieldUlid: string
  value: string | number | boolean
}

export interface FeedbackFormSubmitPayload {
  email: string
  name: string
  phone: string
  phoneCode: string
  fields: FeedbackFormSubmitFieldValue[]
}

export interface FeedbackFormSubmitResponse {
  ticketUlid: string
  ticketNumber: number
  message: string
}

// ── Style Config (client-side, to be adopted by BE later) ──

export interface FeedbackFormStyles {
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
