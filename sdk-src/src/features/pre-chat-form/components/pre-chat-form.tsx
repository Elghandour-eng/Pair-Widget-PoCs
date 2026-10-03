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
import { hexToRgba } from '@/lib/utils'
import { uiText } from '@/lib/ui-strings'

export function PreChatForm({ onSuccess }: { onSuccess?: () => void }) {
  const { navigateToConversation, navigateToIntro, initialMessage, setInitialMessage } = useWidgetNavigation()
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

  // The studio's design for the whole form. `#brand` follows the widget colour.
  const design = preChatFormOptions?.design
  const brand = widgetConfig.primaryColor
  const rs = (c?: string) => (c === '#brand' ? brand : c)
  const showMessageBox = design?.showMessage !== false
  const f = design?.field
  const btn = design?.button
  const card = design?.card
  // One scoped stylesheet reaches every input the same way — the plain ones,
  // the phone input's inner field and the textarea — where inline styles cannot.
  const designCss = f
    ? `
    .pair-prechat input, .pair-prechat textarea {
      background: ${rs(f.background) ?? '#fff'} !important;
      border-color: ${rs(f.borderColor) ?? '#D0D5DD'} !important;
      border-width: ${f.borderWidth ?? 1}px; border-style: ${f.borderStyle ?? 'solid'};
      border-radius: ${f.radius ?? 10}px;
      color: ${rs(f.textColor) ?? '#1A1A1A'}; font-size: ${f.textSize ?? 14}px;
    }
    /* A real height, not a floor: the input's own fixed height would hold
       anything under it. */
    .pair-prechat input { height: ${f.height ?? 40}px }
    .pair-prechat input::placeholder, .pair-prechat textarea::placeholder { color: ${rs(f.placeholderColor) ?? '#98A2B3'} }
    .pair-prechat input:focus, .pair-prechat input:focus-visible,
    .pair-prechat textarea:focus, .pair-prechat textarea:focus-visible {
      border-color: ${rs(f.focusBorderColor) ?? brand} !important;
      outline: none;
      box-shadow: 0 0 0 ${f.focusRingWidth ?? 3}px ${hexToRgba(rs(f.focusRingColor) ?? brand, f.focusRingOpacity ?? 0.18)} !important;
    }
    /* The phone picker is ONE control: the wrapper wears the field's surface,
       border, radius and focus ring; the trigger and input sit inside it flat,
       split by a hairline. */
    .pair-prechat .pair-phone {
      background: ${rs(f.background) ?? '#fff'};
      border: ${f.borderWidth ?? 1}px ${f.borderStyle ?? 'solid'} ${rs(f.borderColor) ?? '#D0D5DD'};
      border-radius: ${f.radius ?? 10}px;
      height: ${f.height ?? 40}px;
      align-items: stretch;
      overflow: clip;
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    .pair-prechat .pair-phone:focus-within {
      border-color: ${rs(f.focusBorderColor) ?? brand};
      box-shadow: 0 0 0 ${f.focusRingWidth ?? 3}px ${hexToRgba(rs(f.focusRingColor) ?? brand, f.focusRingOpacity ?? 0.18)};
    }
    .pair-prechat .pair-phone input,
    .pair-prechat .pair-phone input:focus,
    .pair-prechat .pair-phone input:focus-visible {
      border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
      background: transparent !important; height: auto; min-height: 0;
      direction: ltr; /* a phone number reads left-to-right in any language */
    }
    .pair-prechat .pair-phone .pair-phone-trigger {
      border: 0; border-radius: 0; height: auto; min-height: 0;
      background: transparent;
      color: ${rs(f.textColor) ?? '#1A1A1A'};
      border-inline-end: 1px solid color-mix(in srgb, ${rs(f.borderColor) ?? '#D0D5DD'} 70%, transparent);
      padding-inline: 12px 9px;
      transition: background-color .15s ease;
    }
    .pair-prechat .pair-phone .pair-phone-trigger:hover {
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .pair-prechat .pair-phone .pair-phone-trigger svg:last-child { transition: transform .2s ease }
    .pair-prechat .pair-phone .pair-phone-trigger[data-state='open'] svg:last-child { transform: rotate(180deg) }
    /* The country list portal-renders outside .pair-prechat, so it is themed
       by these global rules: the field's own surface, text and border. */
    .pair-phone-pop {
      border-color: ${rs(f.borderColor) ?? '#D0D5DD'} !important;
      border-radius: ${Math.min(f.radius ?? 10, 16)}px;
      overflow: hidden;
    }
    /* Every inner layer: cmdk's own root paints bg-popover over the content,
       so theming only the outer box left white panes behind the rows. */
    .pair-phone-pop, .pair-phone-pop [cmdk-root], .pair-phone-pop [cmdk-list], .pair-phone-pop [cmdk-input-wrapper] {
      background: ${rs(f.background) ?? '#fff'} !important;
      color: ${rs(f.textColor) ?? '#1A1A1A'} !important;
    }
    .pair-phone-pop input {
      background: transparent !important;
      color: ${rs(f.textColor) ?? '#1A1A1A'} !important;
      border: 0 !important; box-shadow: none !important;
    }
    .pair-phone-pop input::placeholder { color: ${rs(f.placeholderColor) ?? '#98A2B3'} }
    .pair-phone-pop [cmdk-item] { color: ${rs(f.textColor) ?? '#1A1A1A'} }
    .pair-phone-pop [cmdk-item] .pair-dial { color: inherit !important; opacity: 0.55 }
    .pair-phone-pop [cmdk-item][data-selected='true'] {
      background: color-mix(in srgb, currentColor 10%, transparent);
      color: ${rs(f.textColor) ?? '#1A1A1A'};
    }
    ${btn?.hoverBackground ? `.pair-prechat button[type='submit']:hover { background-color: ${rs(btn.hoverBackground)} !important }` : ''}
  `
    : ''
  const labelStyle: React.CSSProperties | undefined = design?.labels
    ? {
        color: rs(design.labels.color),
        fontSize: design.labels.size,
        fontWeight: design.labels.weight as React.CSSProperties['fontWeight'],
      }
    : undefined
  const requiredStyle: React.CSSProperties | undefined = design?.labels?.requiredColor
    ? { color: rs(design.labels.requiredColor) }
    : undefined
  const showLabels = design?.labels?.show !== false

  // Build dynamic zod schema based on fields
  const formSchema = useMemo(
    () => createPreChatFormSchema(preChatFields, showMessageBox, widgetConfig.locale),
    [preChatFields, showMessageBox, widgetConfig.locale],
  )

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

      // Step 2: Send the message. A fields-only form has none: the contact is
      // registered and the visitor lands in an empty conversation.
      if (!messageValue) {
        // Placed before the intro, the form is the door to it rather than to a
        // conversation: the visitor is registered and now sees the intro.
        if (widgetConfig.requiresPreChat && widgetConfig.preChatPlacement === 'before_intro') navigateToIntro()
        else navigateToConversation(null)
        onSuccess?.()
        return
      }
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

  /**
   * The backend often ships the raw field name as its placeholder
   * ("emailAddress"). That is never shown: a stock or empty placeholder is
   * replaced with a proper one in the widget's language.
   */
  const nicePlaceholder = (field: (typeof preChatFields)[0]): string => {
    const raw = (field.placeholder ?? '').trim()
    const stock = !raw || raw.replace(/[\s_-]/g, '').toLowerCase() === field.name.replace(/[\s_-]/g, '').toLowerCase()
    if (!stock) return raw
    if (field.type === 'email') return uiText(widgetConfig.locale, 'phEmail')
    if (field.type === 'phone_number' || /phone/i.test(field.name)) return uiText(widgetConfig.locale, 'phPhone')
    if (/name/i.test(field.name)) return uiText(widgetConfig.locale, 'phName')
    return uiText(widgetConfig.locale, 'phText')
  }

  const renderField = (field: (typeof preChatFields)[0]) => {
    // Check if this is a phone number field — by type, or any phone-ish name,
    // so a backend that stores it as plain `text` still gets the picker.
    const isPhoneField = field.type === 'phone_number' || /phone/i.test(field.name)

    if (isPhoneField) {
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name}
          render={({ field: formField }) => (
            <FormItem>
              {showLabels && (
                <FormLabel className="gap-1" style={labelStyle}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive" style={requiredStyle}>
                      *
                    </span>
                  )}
                </FormLabel>
              )}
              <FormControl>
                <PhoneInput
                  className="pair-phone"
                  placeholder={nicePlaceholder(field)}
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
                {showLabels && (
                  <FormLabel className="gap-1" style={labelStyle}>
                    {field.label}
                    {field.required && (
                      <span className="text-destructive" style={requiredStyle}>
                        *
                      </span>
                    )}
                  </FormLabel>
                )}
                <FormControl>
                  <Input
                    type={field.type}
                    placeholder={nicePlaceholder(field)}
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

  // The studio's card, message and button styling; sensible without a design.
  const cardStyle: React.CSSProperties | undefined = card?.enabled
    ? {
        background: rs(card.background),
        borderWidth: card.borderWidth ?? 1,
        borderStyle: 'solid',
        borderColor: rs(card.borderColor),
        borderRadius: card.radius ?? 16,
        padding: card.padding ?? 16,
        boxShadow: card.shadow
          ? `0 ${card.shadow.y ?? 0}px ${card.shadow.blur ?? 0}px ${hexToRgba(rs(card.shadow.color) ?? '#000000', card.shadow.opacity ?? 0)}`
          : undefined,
      }
    : undefined
  const messageStyle: React.CSSProperties | undefined = design?.message
    ? {
        color: rs(design.message.color),
        fontSize: design.message.size,
        fontWeight: design.message.weight as React.CSSProperties['fontWeight'],
        textAlign: design.message.align as React.CSSProperties['textAlign'],
      }
    : undefined
  const buttonStyle: React.CSSProperties = {
    backgroundColor: rs(btn?.background) ?? widgetConfig.primaryColor,
    color: rs(btn?.textColor) ?? '#FFFFFF',
    borderRadius: btn?.radius ?? 10,
    height: btn?.height ?? 40,
    fontSize: btn?.textSize ?? 14,
    fontWeight: (btn?.weight as React.CSSProperties['fontWeight']) ?? 600,
    width: btn?.fullWidth === false ? undefined : '100%',
    // The form is a flex column, which stretches its children: "off" has to
    // opt the button out to get a content-width one.
    alignSelf: btn?.fullWidth === false ? 'flex-start' : undefined,
    boxShadow: btn?.shadow
      ? `0 ${btn.shadow.y ?? 0}px ${btn.shadow.blur ?? 0}px ${hexToRgba(rs(btn.shadow.color) ?? '#000000', btn.shadow.opacity ?? 0)}`
      : undefined,
  }
  const isSubmitting = preChatMutation.isPending || sendMessageMutation.isPending
  const banner = design?.banner
  const backdrop = design?.backdrop

  return (
    <WidgetContent className="relative overflow-y-auto">
      {/* An optional repeating brand pattern behind the whole form. */}
      {backdrop?.url && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${backdrop.url})`,
            backgroundSize: `${backdrop.size ?? 220}px auto`,
            backgroundRepeat: 'repeat',
            opacity: backdrop.opacity ?? 0.06,
          }}
        />
      )}
      {designCss && <style>{designCss}</style>}
      <div className="pair-prechat relative" style={cardStyle}>
        {/* An optional brand banner over the form. */}
        {banner?.show && banner.url && (
          <img
            src={banner.url}
            alt=""
            className="mb-5 w-full"
            style={{
              height: banner.height ?? 96,
              objectFit: (banner.fit as React.CSSProperties['objectFit']) ?? 'cover',
              borderRadius: banner.radius ?? 14,
            }}
          />
        )}
        {preChatMessage && (
          <div className="mb-6" style={messageStyle}>
            {parseMarkdown(preChatMessage)}
          </div>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: f?.gap ?? 16 }}
          >
            {preChatFields.map((field) => renderField(field))}

            {showMessageBox && (
              <FormField
                control={form.control}
                name="message"
                render={({ field: formField }) => (
                  <FormItem>
                    {showLabels && (
                      <FormLabel className="gap-1" style={labelStyle}>
                        {design?.messageLabel || 'Message'}
                        <span className="text-destructive" style={requiredStyle}>
                          *
                        </span>
                      </FormLabel>
                    )}
                    <FormControl>
                      <Textarea
                        placeholder={design?.messagePlaceholder || 'Type your message here...'}
                        className="min-h-24"
                        {...formField}
                        value={formField.value as string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={isSubmitting} style={buttonStyle}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? uiText(widgetConfig.locale, 'submitting') : design?.buttonText || 'Start Chat'}
            </Button>
          </form>
        </Form>
      </div>
    </WidgetContent>
  )
}
