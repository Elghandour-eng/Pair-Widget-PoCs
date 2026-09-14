import type { Message, ProductCardSet, NextMessageItem } from '@/features/conversation/types/message'
import { isPendingMessage } from '@/features/conversation/utils/message-utils'
import { AiAssistantMessageBody } from './ai-assistant-message-body'
import { AiAssistantMessageHeader } from './ai-assistant-message-header'
import { AiAssistantMessageShimmer } from './ai-assistant-message-shimmer'
import { FeedbackSection } from './feedback-section'
import { ProductSection } from './product-section'
import { NextMessagesSection } from './next-messages-section'
import { TemplateRenderer } from './widget-template/template-renderer'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

interface AiAssistantMessageProps {
  message: Message
  isLastMessage?: boolean
}

export function AiAssistantMessage({ message, isLastMessage }: AiAssistantMessageProps) {
  const isPending = isPendingMessage(message)

  const { widgetConfig } = useWidgetConfigContext()
  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const isCard = aiConfig?.messageStyle === 'card'
  const cardStyles = isCard ? aiConfig?.CardStyles : undefined

  // Extract next_messages list from all possible sources while preserving order
  const nextMessagesList: NextMessageItem[] =
    message.next_messages && message.next_messages.length > 0
      ? message.next_messages
      : message.interactive_metadata?.next_messages && message.interactive_metadata.next_messages.length > 0
        ? message.interactive_metadata.next_messages
        : message.suggestions
          ? [
              Array.isArray(message.suggestions)
                ? { type: 'suggestions', options: message.suggestions }
                : message.suggestions,
            ]
          : message.next_msg
            ? [message.next_msg]
            : []

  // Check if product_card_set exists outside of lastMessage constraint (for historical card display)
  const productSetOutside = !isLastMessage
    ? (nextMessagesList.find((item) => item?.type === 'product_card_set') as ProductCardSet | undefined)
    : undefined

  if (isPending) {
    return (
      <div className="flex w-full flex-col items-start gap-4 bg-transparent px-4 py-2">
        <AiAssistantMessageHeader isPending={true} />
        <AiAssistantMessageShimmer cardStyles={cardStyles} />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-start gap-6 bg-transparent px-4 py-2">
      <AiAssistantMessageHeader isPending={false} />
      <AiAssistantMessageBody content={message.content} />

      {message.widget_template && (
        <TemplateRenderer widgetTemplate={message.widget_template} sourceMessageUlid={message.ulid} />
      )}

      {productSetOutside && <ProductSection productSet={productSetOutside} sourceMessageUlid={message.ulid} />}

      {isLastMessage && (
        <NextMessagesSection
          nextMessages={nextMessagesList}
          sourceMessageUlid={message.ulid}
          messageContent={message.content}
        />
      )}

      <FeedbackSection messageId={message.ulid} initialFeedback={message.ai_feedback as 'liked' | 'disliked' | null} />
    </div>
  )
}
