import { type ReactNode } from 'react'

import { MessageAvatar } from '@/features/conversation/components/conversation-message/message-avatar'
import { MessageFooter } from '@/features/conversation/components/conversation-message/message-footer'
import type { Message } from '@/features/conversation/types/message'
import {
  isFailedMessage,
  isOutgoingMessage,
  isPendingMessage,
  isUserMessage,
} from '@/features/conversation/utils/message-utils'
import { cn } from '@/lib/utils'

interface MessageLayoutProps {
  message: Message
  isUnread?: boolean
  primaryColor?: string
  websiteName?: string
  children: ReactNode
}

function MessageLayout({
  message,
  isUnread = false,
  primaryColor = '#3b82f6',
  websiteName,
  children,
}: MessageLayoutProps) {
  const isUser = isUserMessage(message)
  const isOutgoing = isOutgoingMessage(message)
  const isPending = isPendingMessage(message)
  const isFailed = isFailedMessage(message)

  return (
    <div
      className={cn('flex w-full items-start gap-2', {
        'justify-end': isUser,
        'justify-start': !isUser,
        'opacity-70': isPending, // Reduce opacity for pending messages
        'opacity-50': isFailed, // Further reduce opacity for failed messages
      })}
    >
      {/* Unread indicator - only show for non-user messages */}
      {!isUser && (
        <div className="relative mt-2 flex shrink-0 items-center">
          <div
            className={cn('size-3 shrink-0 rounded-full transition-opacity duration-500', {
              'opacity-100': isUnread,
              'opacity-0': !isUnread,
              'pointer-events-none': !isUnread,
            })}
            style={{
              backgroundColor: isUnread ? primaryColor : 'transparent',
              boxShadow: isUnread ? `0 0 0 3px ${primaryColor}15, 0 0 8px ${primaryColor}30` : 'none',
              minWidth: '12px',
              minHeight: '12px',
            }}
            aria-label={isUnread ? 'New message' : undefined}
          />
        </div>
      )}

      <MessageAvatar show={isOutgoing} />

      <div
        className={cn('flex max-w-[70%] flex-col gap-1', {
          'items-end': isUser,
          'items-start': !isUser,
        })}
      >
        {children}
        <MessageFooter message={message} websiteName={websiteName} />
      </div>

      {/* Spacer for user messages to maintain alignment */}
      {isUser && <div className="size-2" />}
    </div>
  )
}

export { MessageLayout }
