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
  const hasCardStyles = cardStyles && Object.keys(cardStyles).length > 0

  return (
    <div
      className={cn(
        'w-full text-left text-sm leading-relaxed font-normal text-[#1A1A1A]',
        hasCardStyles && 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
      )}
      style={{
        ...(hasCardStyles ? cardStyles : {}),
        ...textStyles,
      }}
    >
      {parseMarkdown(content)}
    </div>
  )
}
