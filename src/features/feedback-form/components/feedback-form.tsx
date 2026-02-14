import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import { useSubmitFeedback } from '../hooks/use-submit-feedback'
import { useFeedbackFormConfig } from '../queries/use-feedback-form-queries'
import { createFeedbackFormSchema, type FeedbackFormValues } from '../schemas/feedback-form-schema'
import type { FeedbackFormField, FeedbackFormStyles, FeedbackFormSubmitFieldValue } from '../types/feedback-form'

interface FeedbackFormProps {
  formId: string
  styles?: FeedbackFormStyles
}

export function FeedbackForm({ formId, styles }: FeedbackFormProps) {
  const { data: formConfig } = useFeedbackFormConfig(formId)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Separate visible vs hidden fields
  const visibleFields = useMemo(() => formConfig.fields.filter((f) => f.isVisible), [formConfig.fields])
  const hiddenFields = useMemo(() => formConfig.fields.filter((f) => !f.isVisible), [formConfig.fields])

  // Build dynamic schema
  const formSchema = useMemo(() => createFeedbackFormSchema(visibleFields), [visibleFields])

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      ...visibleFields.reduce(
        (acc, field) => {
          acc[`field_${field.id}`] = field.defaultValue || ''
          return acc
        },
        {} as Record<string, string>,
      ),
    },
  })

  const submitMutation = useSubmitFeedback({
    formId,
    onSuccess: () => {
      setSuccessMessage('Ticket submitted, feel free to submit another one')
      setErrorMessage(null)
      form.reset()
      // Clear success after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error) => {
      setErrorMessage(error)
      setSuccessMessage(null)
    },
  })

  const handleSubmit = (values: FeedbackFormValues) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    // Build the fields array: visible fields with user values + hidden fields with defaultValues
    const fieldValues: FeedbackFormSubmitFieldValue[] = []

    // Visible fields — user-entered values
    for (const field of visibleFields) {
      const value = values[`field_${field.id}`] as string
      if (value) {
        fieldValues.push({ fieldUlid: field.id, value })
      }
    }

    // Hidden fields — auto-submit defaultValues
    for (const field of hiddenFields) {
      if (field.defaultValue) {
        fieldValues.push({ fieldUlid: field.id, value: field.defaultValue })
      }
    }

    submitMutation.mutate({
      email: values.email as string,
      name: values.name as string,
      phone: values.phone as string,
      phoneCode: '+965', // KW default
      fields: fieldValues,
    })
  }

  // Notify parent iframe about size changes for auto-height
  const notifyResize = useCallback(() => {
    if (window.parent !== window && formRef.current) {
      const height = formRef.current.scrollHeight
      console.log('[PairAI Form] notifyResize:', {
        scrollHeight: height,
        offsetHeight: formRef.current.offsetHeight,
        clientHeight: formRef.current.clientHeight,
        bodyScrollHeight: document.body.scrollHeight,
        bodyOffsetHeight: document.body.offsetHeight,
        windowInnerHeight: window.innerHeight,
        isInIframe: window.parent !== window,
      })
      window.parent.postMessage(
        {
          type: 'form:resize',
          height,
        },
        '*',
      )
    }
  }, [])

  useEffect(() => {
    notifyResize()
    const observer = new ResizeObserver(() => notifyResize())
    if (formRef.current) {
      observer.observe(formRef.current)
    }
    return () => observer.disconnect()
  }, [notifyResize])

  // Resolve input type: prefer backend inputType, else infer from systemField/label
  const resolveInputType = (
    field: FeedbackFormField,
  ): 'text' | 'email' | 'number' | 'textarea' | 'select' | 'phone' => {
    if (field.inputType === 'select' || (field.options && field.options.length > 0)) return 'select'
    if (field.inputType === 'textarea') return 'textarea'
    if (field.inputType === 'email') return 'email'
    if (field.inputType === 'number') return 'number'
    if (field.systemField === 'description') return 'textarea'
    const labelLower = field.label.toLowerCase()
    if (labelLower.includes('email')) return 'email'
    if (labelLower.includes('phone')) return 'phone'
    if (labelLower.includes('description') || labelLower.includes('message')) return 'textarea'
    return (field.inputType as 'text') || 'text'
  }

  const getPlaceholder = (field: FeedbackFormField, fallback: string) => field.placeholder?.trim() || fallback

  // Determine what input to render for a dynamic field
  const renderDynamicField = (field: FeedbackFormField) => {
    const fieldKey = `field_${field.id}`
    const inputType = resolveInputType(field)

    if (inputType === 'select') {
      const options = field.options ?? []
      return (
        <FormField
          key={fieldKey}
          control={form.control}
          name={fieldKey}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className="gap-1">
                {field.label}
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <select
                  className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 md:text-sm"
                  style={getInputStyles(styles)}
                  {...formField}
                  value={(formField.value as string) ?? ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                >
                  <option value="">{getPlaceholder(field, `Select ${field.label.toLowerCase()}`)}</option>
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )
    }

    if (inputType === 'textarea') {
      return (
        <FormField
          key={fieldKey}
          control={form.control}
          name={fieldKey}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className="gap-1">
                {field.label}
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder={getPlaceholder(field, `Enter ${field.label.toLowerCase()}`)}
                  className="min-h-20"
                  style={getInputStyles(styles)}
                  {...formField}
                  value={formField.value as string}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )
    }

    if (inputType === 'phone') {
      return (
        <FormField
          key={fieldKey}
          control={form.control}
          name={fieldKey}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className="gap-1">
                {field.label}
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <PhoneInput
                  placeholder={getPlaceholder(field, `Enter ${field.label.toLowerCase()}`)}
                  defaultCountry="KW"
                  {...formField}
                  value={formField.value as string}
                  onChange={(value) => formField.onChange(value || '')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )
    }

    return (
      <FormField
        key={fieldKey}
        control={form.control}
        name={fieldKey}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel className="gap-1">
              {field.label}
              <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                type={inputType === 'number' ? 'number' : inputType === 'email' ? 'email' : 'text'}
                placeholder={getPlaceholder(field, `Enter ${field.label.toLowerCase()}`)}
                style={getInputStyles(styles)}
                {...formField}
                value={formField.value as string}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <div
      ref={formRef}
      className="w-full p-6"
      style={{
        backgroundColor: styles?.backgroundColor || undefined,
        fontFamily: styles?.fontFamily || undefined,
      }}
    >
      {/* Success Banner */}
      {successMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Contact Fields — Always shown */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="gap-1" style={getLabelStyles(styles)}>
                  Name
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    style={getInputStyles(styles)}
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="gap-1" style={getLabelStyles(styles)}>
                  Email
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    style={getInputStyles(styles)}
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="gap-1" style={getLabelStyles(styles)}>
                  Phone
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <PhoneInput
                    placeholder="Enter your phone number"
                    defaultCountry="KW"
                    {...field}
                    value={field.value as string}
                    onChange={(value) => field.onChange(value || '')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dynamic Visible Fields */}
          {visibleFields.map((field) => renderDynamicField(field))}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full text-white!"
            style={{
              backgroundColor: styles?.submitButtonColor || styles?.primaryColor || undefined,
              color: styles?.submitButtonTextColor || undefined,
              borderRadius: styles?.borderRadius || undefined,
            }}
          >
            {submitMutation.isPending && <Spinner />}
            {submitMutation.isPending ? 'Submitting...' : styles?.submitButtonText || 'Submit'}
          </Button>
        </form>
      </Form>
    </div>
  )
}

// Style helpers
function getInputStyles(styles?: FeedbackFormStyles): React.CSSProperties | undefined {
  if (!styles) return undefined
  const s: React.CSSProperties = {}
  if (styles.inputBackgroundColor) s.backgroundColor = styles.inputBackgroundColor
  if (styles.inputBorderColor) s.borderColor = styles.inputBorderColor
  if (styles.inputTextColor) s.color = styles.inputTextColor
  if (styles.borderRadius) s.borderRadius = styles.borderRadius
  return Object.keys(s).length > 0 ? s : undefined
}

function getLabelStyles(styles?: FeedbackFormStyles): React.CSSProperties | undefined {
  if (!styles?.labelColor) return undefined
  return { color: styles.labelColor }
}
