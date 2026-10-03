import { useWidgetConfigContext } from '@/contexts/widget-config-context'

function EmptyMessage() {
  const { widgetConfig } = useWidgetConfigContext()
  // The studio's empty state: its own line per language, size and colour.
  const empty = widgetConfig.messagesConfig?.emptyState
  const isArabic = /^ar/i.test(widgetConfig.locale ?? '')
  // With nothing typed the line still follows the widget's language.
  const text =
    (isArabic && empty?.text_ar?.trim()) ||
    empty?.text?.trim() ||
    (isArabic ? 'أرسل رسالة لبدء المحادثة!' : 'Send a message to start the conversation!')

  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <p
        dir="auto"
        className="text-muted-foreground text-sm"
        style={{
          fontSize: typeof empty?.fontSize === 'number' ? `${empty.fontSize}px` : undefined,
          color: empty?.color || undefined,
        }}
      >
        {text}
      </p>
    </div>
  )
}

export { EmptyMessage }
