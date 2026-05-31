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

  return (
    <MessageLayout
      message={message}
      isUnread={isUnread}
      primaryColor={primaryColor}
      websiteName={websiteName}
      hideTime={true}
    >
      <div
        className={cn('relative flex min-w-25 flex-col', {
          'max-w-73 rounded-2xl bg-[#EEECE1] p-3 text-[#1A1A1A]': isUser,
          'rounded-2xl rounded-bl-none pt-3 pr-4 pb-3 pl-4': !isUser,
          'text-foreground bg-[#F0F1F1]': !isUser && !isPending && !isFailed,
          'text-foreground/90 bg-[#F0F1F1]/90': !isUser && isPending,
          'text-foreground/70 bg-[#F0F1F1]/70': !isUser && isFailed,
        })}
      >
        <div
          className={cn({
            'text-sm leading-relaxed': !isUser,
            "font-(family-name:--Font-primary,'DM_Sans') text-[14px] leading-[130%] font-normal text-(--Text-Dark-Primary,#1A1A1A)":
              isUser,
          })}
        >
          {parseMarkdown(message.content)}
        </div>
        {!widgetConfig.hideMessageTime && (
          <div
            className={cn('text-right text-[12px] leading-4.5 font-normal tracking-[-0.01em]', {
              'text-[#1A1A1A]/70': isUser,
              'text-[#60676E]': !isUser,
            })}
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
