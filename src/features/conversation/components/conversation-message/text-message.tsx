import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { MessageLayout } from '@/features/conversation/components/conversation-message/message-layout'
import type { Message } from '@/features/conversation/types/message'
import {
  formatMessageTime,
  isFailedMessage,
  isPendingMessage,
  isUserMessage,
} from '@/features/conversation/utils/message-utils'
import { parseMarkdown } from '@/lib/parseMarkdown'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface TextMessageProps {
  message: Message
  isUnread?: boolean
  primaryColor?: string
  websiteName?: string
}

function TextMessage({ message, isUnread = false, primaryColor = '#3b82f6', websiteName }: TextMessageProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const isUser = isUserMessage(message)
  const isPending = isPendingMessage(message)
  const isFailed = isFailedMessage(message)

  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const customerConfig = widgetConfig.messagesConfig?.customerMessages

  let customBubbleStyle: React.CSSProperties = {}
  let customTextStyles: React.CSSProperties = {}
  let timeStyle: React.CSSProperties = {}
  let isCard = false

  if (isUser) {
    const bubbleType = customerConfig?.bubbleType ?? 'filled'
    const useBrandColor = customerConfig?.useBrandColor ?? false

    if (customerConfig) {
      customBubbleStyle = { ...customerConfig.bubbleStyle }
      customTextStyles = { ...customerConfig.TextStyles }

      if (useBrandColor) {
        customBubbleStyle.backgroundColor = primaryColor
      }

      if (bubbleType === 'outline') {
        customBubbleStyle.backgroundColor = 'transparent'
        const borderW = customBubbleStyle.borderWidth || '1px'
        const borderC = customBubbleStyle.borderColor || primaryColor || '#000000'
        customBubbleStyle.border = `${borderW} solid ${borderC}`

        if (!customTextStyles.color) {
          customTextStyles.color = borderC
        }
      } else {
        // filled mode
        if (useBrandColor && !customTextStyles.color) {
          customTextStyles.color = '#FFFFFF'
        }
        if (customBubbleStyle.borderWidth || customBubbleStyle.borderColor) {
          customBubbleStyle.borderStyle = customBubbleStyle.borderStyle || 'solid'
        }
      }
    }
  } else {
    // Incoming message
    if (aiConfig) {
      customTextStyles = { ...aiConfig.TextStyles }
      const hasCardStyles = aiConfig.CardStyles && Object.keys(aiConfig.CardStyles).length > 0
      if (hasCardStyles) {
        isCard = true
        customBubbleStyle = { ...aiConfig.CardStyles }
      }
    }
  }

  if (customTextStyles.color) {
    timeStyle.color = customTextStyles.color
    timeStyle.opacity = 0.7
  }

  return (
    <MessageLayout
      message={message}
      isUnread={isUnread}
      primaryColor={primaryColor}
      websiteName={websiteName}
      hideTime={true}
    >
      <div
        className={cn('relative flex min-w-25 flex-col wrap-break-word text-ellipsis', {
          'max-w-73 rounded-2xl bg-[#EEECE1] p-3 text-[#1A1A1A]': isUser,
          'w-full rounded-2xl rounded-bl-none pt-3 pr-4 pb-3 pl-4': !isUser && !isCard,
          'text-foreground bg-[#F0F1F1]': !isUser && !isCard && !isPending && !isFailed,
          'text-foreground/90 bg-[#F0F1F1]/90': !isUser && !isCard && isPending,
          'text-foreground/70 bg-[#F0F1F1]/70': !isUser && !isCard && isFailed,

          // Card style classes for incoming messages
          'w-full rounded-lg border border-gray-200 bg-white p-4 text-[#1A1A1A] shadow-sm': !isUser && isCard,
        })}
        style={customBubbleStyle}
      >
        <div
          className={cn('wrap-break-word', {
            'text-sm leading-relaxed': !isUser,
            "font-(family-name:--Font-primary,'DM_Sans') text-[14px] leading-[130%] font-normal text-(--Text-Dark-Primary,#1A1A1A)":
              isUser,
          })}
          style={customTextStyles}
        >
          {parseMarkdown(message.content)}
        </div>
        {!widgetConfig.hideMessageTime && (
          <div
            className={cn('text-right text-[12px] leading-4.5 font-normal tracking-[-0.01em]', {
              'text-[#1A1A1A]/70': isUser,
              'text-[#60676E]': !isUser,
            })}
            style={timeStyle}
          >
            {formatMessageTime(message.sent_at)}
          </div>
        )}

        {/* Pending indicator - show spinner for pending messages */}
        {isPending && (
          <div
            className={cn('absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full', {
              'bg-muted-foreground': !isUser,
            })}
            style={isUser ? { backgroundColor: primaryColor } : undefined}
          >
            <Loader2 className="size-2.5 animate-spin text-white" />
          </div>
        )}

        {/* Failed indicator - show X icon for failed messages */}
        {isFailed && (
          <div
            className={cn('absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full', {
              'bg-destructive': !isUser,
            })}
            style={isUser ? { backgroundColor: primaryColor } : undefined}
            title="Failed to send"
          >
            <span className="text-[10px] text-white">!</span>
          </div>
        )}
      </div>
    </MessageLayout>
  )
}

export { TextMessage }
