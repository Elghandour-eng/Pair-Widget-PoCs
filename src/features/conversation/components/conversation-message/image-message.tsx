import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import type { Message } from '@/features/conversation/types/message'
import { isUserMessage } from '@/features/conversation/utils/message-utils'
import { cn } from '@/lib/utils'
import { Download, Expand, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageLayout } from './message-layout'
import { TextMessage } from './text-message'

interface ImageMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
}

export function ImageMessage({ message, isUnread, primaryColor, websiteName }: ImageMessageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { widgetConfig } = useWidgetConfigContext()
  const isUser = isUserMessage(message)

  const customerConfig = widgetConfig.messagesConfig?.customerMessages
  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const customTextStyles = isUser ? customerConfig?.TextStyles : aiConfig?.TextStyles

  // Extract content from message
  const metadata = message.metadata
  const imageUrl = message.media_url || metadata?.media_url || metadata?.url
  const content = message.content

  // Decide what to show as caption (Vue implementation ignores content if it is "[Image]" or "[Image Message]")
  const showContent = content && !['[Image]', '[Image Message]'].includes(content)

  if (!imageUrl) {
    return <TextMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
  }

  return (
    <MessageLayout message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName}>
      <div className="flex max-w-full flex-col items-start gap-1">
        <div
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-100 transition-all hover:opacity-95 dark:border-gray-800"
          onClick={() => setIsOpen(true)}
        >
          <img
            src={imageUrl}
            alt="Shared image"
            className="h-auto w-full max-w-70 rounded-xl object-cover"
            // loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/10 group-hover:opacity-100">
            <Expand className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>

        {showContent && (
          <div
            className={cn('px-1 text-sm leading-relaxed wrap-break-word', {
              "font-(family-name:--Font-primary,'DM_Sans') text-[14px] leading-[130%] font-normal text-(--Text-Dark-Primary,#1A1A1A)":
                isUser,
            })}
            style={customTextStyles}
          >
            {content}
          </div>
        )}

        {isOpen &&
          createPortal(
            <div
              className="animate-in fade-in fixed inset-0 z-9999 flex items-center justify-center bg-black/80 duration-200"
              onClick={() => setIsOpen(false)}
            >
              <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                  title="Download original"
                >
                  <Download className="h-5 w-5" />
                </a>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <img
                src={imageUrl}
                alt="Full size"
                className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body,
          )}
      </div>
    </MessageLayout>
  )
}
