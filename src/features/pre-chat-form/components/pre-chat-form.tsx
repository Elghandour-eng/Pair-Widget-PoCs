import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { WidgetContent } from '@/components/widget-content'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { usePreChat } from '@/features/pre-chat-form/hooks/use-pre-chat'
import { createPreChatFormSchema, type PreChatFormValues } from '@/features/pre-chat-form/schemas/pre-chat-form-schema'
import type { PreChatFormPayload } from '@/features/pre-chat-form/types/pre-chat-form-payload'
import { parseMarkdown } from '@/lib/parseMarkdown'

export function PreChatForm({ onSuccess }: { onSuccess?: () => void }) {
  const { navigateToConversation, initialMessage, setInitialMessage } = useWidgetNavigation()
  const { widgetConfig } = useWidgetConfigContext()
  const { subscribeToConversation } = useUnreadMessages()
  const preChatMutation = usePreChat()
  const sendMessageMutation = useSendMessage()

  // Get pre-chat form options from widget config
  const preChatFormOptions = widgetConfig.preChatFormOptions
  const preChatFields = useMemo(() => {
    const fields = preChatFormOptions?.pre_chat_fields || []
    // Filter enabled fields and sort by order
    return fields.filter((field) => field.enabled).sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [preChatFormOptions?.pre_chat_fields])
  const preChatMessage = preChatFormOptions?.pre_chat_message

  // Build dynamic zod schema based on fields
  const formSchema = useMemo(() => createPreChatFormSchema(preChatFields), [preChatFields])

  const form = useForm<PreChatFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: preChatFields.reduce(
      (acc, field) => {
        acc[field.name] = ''
        return acc
      },
      { message: initialMessage || '' } as PreChatFormValues,
    ),
  })

  useEffect(() => {
    return () => {
      setInitialMessage(null)
    }
  }, [setInitialMessage])

  const handleSubmit = async (values: PreChatFormValues) => {
    try {
      // Build pre_chat_data object with field names as keys
      // Only include fields that have values (for optional fields) or are required
      const preChatData: Record<string, string> = {}
      preChatFields.forEach((field) => {
        const value = values[field.name] as string | undefined
        // Only include if value exists and is not empty, or if field is required
        if (value && typeof value === 'string' && value.trim()) {
          preChatData[field.name] = value.trim()
        } else if (field.required) {
          // Required field should have value, but include empty string if somehow missing
          preChatData[field.name] = (value && typeof value === 'string' ? value : '') || ''
        }
      })

      const messageValue =
        values.message && typeof values.message === 'string' && values.message.trim()
          ? values.message.trim()
          : undefined

      // Register payload - message is NOT included, only pre_chat_data
      const payload: PreChatFormPayload = {
        pre_chat_data: Object.keys(preChatData).length > 0 ? preChatData : {},
      }

      // Step 1: Register the user (this saves the token automatically)
      await preChatMutation.mutateAsync(payload)

      // Step 2: Send the message (message is required in form, so it should always exist)
      if (messageValue) {
        const sendMessageResponse = await sendMessageMutation.mutateAsync({
          content: messageValue,
          message_type: 'text',
        })

        // Step 3: Subscribe and navigate to conversation page with the conversation ID
        if (sendMessageResponse.conversation_id) {
          // Subscribe to the new conversation for real-time updates
          subscribeToConversation(sendMessageResponse.conversation_id)

          navigateToConversation(sendMessageResponse.conversation_id)
        }
      }

      onSuccess?.()
    } catch (error) {
      console.error('PreChat form submission failed:', error)
    }
  }

  const renderField = (field: (typeof preChatFields)[0]) => {
    // Check if this is a phone number field
    const isPhoneField = field.type === 'phone_number' || field.name === 'phoneNumber'

    if (isPhoneField) {
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel className="gap-1">
                {field.label}
                {field.required && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <PhoneInput
                  placeholder={field.placeholder || 'Enter phone number'}
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

    switch (field.type) {
      case 'email':
      case 'text':
      default:
        return (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="gap-1">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
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
  }

  return (
    <WidgetContent className="overflow-y-auto">
      {preChatMessage && <div className="mb-6">{parseMarkdown(preChatMessage)}</div>}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {preChatFields.map((field) => renderField(field))}

          <FormField
            control={form.control}
            name="message"
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="gap-1">
                  Message
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Type your message here..."
                    className="min-h-24"
                    {...formField}
                    value={formField.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={preChatMutation.isPending || sendMessageMutation.isPending}
            className="w-full text-white!"
            style={{ backgroundColor: widgetConfig.primaryColor }}
          >
            {(preChatMutation.isPending || sendMessageMutation.isPending) && <Spinner />}
            {preChatMutation.isPending || sendMessageMutation.isPending ? 'Submitting...' : 'Start Chat'}
          </Button>
        </form>
      </Form>
    </WidgetContent>
  )
}
