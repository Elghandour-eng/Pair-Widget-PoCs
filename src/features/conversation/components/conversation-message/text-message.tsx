import { MessageLayout } from '@/features/conversation/components/conversation-message/message-layout'
import type { Message } from '@/features/conversation/types/message'
import {
  hexToRgba,
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
  const isUser = isUserMessage(message)
  const isPending = isPendingMessage(message)
  const isFailed = isFailedMessage(message)

  return (
    <MessageLayout message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName}>
      <div
        className={cn('relative rounded-2xl px-4 py-2', {
          'text-white': isUser && !isPending && !isFailed,
          'text-white/90': isUser && isPending,
          'text-white/70': isUser && isFailed,
          'bg-muted text-foreground': !isUser && !isPending && !isFailed,
          'bg-muted/70 text-foreground/90': !isUser && isPending,
          'bg-muted/50 text-foreground/70': !isUser && isFailed,
        })}
        style={
          isUser
            ? {
                backgroundColor: isPending
                  ? hexToRgba(primaryColor, 0.7) // 70% opacity
                  : isFailed
                    ? hexToRgba(primaryColor, 0.5) // 50% opacity
                    : primaryColor,
              }
            : undefined
        }
      >
        <div className="text-sm leading-relaxed">{parseMarkdown(message.content)}</div>

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
