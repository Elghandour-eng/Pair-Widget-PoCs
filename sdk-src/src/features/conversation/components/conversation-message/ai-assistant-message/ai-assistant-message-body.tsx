import { parseMarkdown } from '@/lib/parseMarkdown'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { cn } from '@/lib/utils'

interface AiAssistantMessageBodyProps {
  content: string
}

export function AiAssistantMessageBody({ content }: AiAssistantMessageBodyProps) {
  if (!content || !content.trim()) return null

  const { widgetConfig } = useWidgetConfigContext()
  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const cardStyles = aiConfig?.CardStyles
  const textStyles = aiConfig?.TextStyles
  // `card` and `bubble` are the studio's two boxed styles; anything else is plain text.
  const isCard = aiConfig?.messageStyle === 'card'
  const isBubble = aiConfig?.messageStyle === 'bubble'

  return (
    <div
      dir="auto"
      className={cn(
        'ai-md-body w-full text-start text-sm leading-relaxed font-normal text-[#1A1A1A]',
        isCard && 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
        isBubble && 'rounded-2xl rounded-es-none bg-[#F0F1F1] px-4 py-3',
      )}
      style={{
        ...(isCard ? cardStyles : {}),
        ...textStyles,
      }}
    >
      {parseMarkdown(content)}
    </div>
  )
}
