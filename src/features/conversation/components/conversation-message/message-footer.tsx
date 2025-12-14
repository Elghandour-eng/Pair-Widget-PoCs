import type { Message } from '@/features/conversation/types/message'
import {
  formatMessageTime,
  isFailedMessage,
  isOutgoingMessage,
  isPendingMessage,
} from '@/features/conversation/utils/message-utils'

interface MessageFooterProps {
  message: Message
  websiteName?: string
}

function MessageFooter({ message, websiteName }: MessageFooterProps) {
  const isOutgoing = isOutgoingMessage(message)
  const isPending = isPendingMessage(message)
  const isFailed = isFailedMessage(message)
  const timeString = formatMessageTime(message.sent_at)

  return (
    <div className="flex items-center gap-1 px-2">
      {isOutgoing && websiteName && <span className="text-muted-foreground text-xs">{websiteName} •</span>}
      <span className="text-muted-foreground text-xs">{timeString}</span>
      {isPending && <span className="text-muted-foreground text-[10px] italic">Sending...</span>}
      {isFailed && <span className="text-destructive text-[10px] italic">Failed</span>}
    </div>
  )
}

export { MessageFooter }
