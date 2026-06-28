import type { Message, ProductCardSet, SuggestionsMessage } from '@/features/conversation/types/message'
import { isPendingMessage } from '@/features/conversation/utils/message-utils'
import { AiAssistantMessageBody } from './ai-assistant-message-body'
import { AiAssistantMessageHeader } from './ai-assistant-message-header'
import { AiAssistantMessageShimmer } from './ai-assistant-message-shimmer'
import { FeedbackSection } from './feedback-section'
import { ProductSection } from './product-section'
import { SuggestionsSection } from './suggestions-section'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

interface AiAssistantMessageProps {
  message: Message
  isLastMessage?: boolean
}

export function AiAssistantMessage({ message, isLastMessage }: AiAssistantMessageProps) {
  const isPending = isPendingMessage(message)
  console.log('isPending:', isPending)

  const { widgetConfig } = useWidgetConfigContext()
  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const cardStyles = aiConfig?.CardStyles

  // Find suggestions option in next_messages / next_msg
  const suggestionsItem = message.next_messages?.find((item) => item.type === 'suggestions') as
    | SuggestionsMessage
    | undefined
  const suggestionsMsg = (message.next_msg?.type === 'suggestions' ? message.next_msg : undefined) as
    | SuggestionsMessage
    | undefined
  const suggestions = suggestionsItem || suggestionsMsg

  // Find product_card_set option in next_messages / next_msg
  const productSetItem = message.next_messages?.find((item) => item.type === 'product_card_set') as
    | ProductCardSet
    | undefined
  const productSetMsg = (message.next_msg?.type === 'product_card_set' ? message.next_msg : undefined) as
    | ProductCardSet
    | undefined
  const productSet = productSetItem || productSetMsg

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

      {productSet && <ProductSection productSet={productSet} sourceMessageUlid={message.ulid} />}

      {suggestions && isLastMessage && (
        <SuggestionsSection suggestions={suggestions} sourceMessageUlid={message.ulid} />
      )}
      <FeedbackSection messageId={message.ulid} initialFeedback={message.ai_feedback as 'liked' | 'disliked' | null} />
    </div>
  )
}
