import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, X } from 'lucide-react'

import { WidgetAvatar } from '@/components/widget-avatar'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'

export function IncomingMessagePreview() {
  const { isOpen, setIsOpen } = useWidgetUIContext()
  const { lastIncomingMessage, isPreviewDismissed, dismissPreview, getVisibleUnreadCount } = useUnreadMessages()
  const { widgetConfig } = useWidgetConfigContext()

  const totalUnreadCount = getVisibleUnreadCount()

  const handleClose = () => {
    dismissPreview()
  }

  const handleSeeMessages = () => {
    dismissPreview()
    setIsOpen(true)
  }

  if (isOpen || !lastIncomingMessage || isPreviewDismissed) {
    return null
  }

  const isRight = widgetConfig.position === 'right'
  const positionClass = isRight ? 'right-4' : 'left-4'
  // right position → sharp bottom-right corner; left → sharp bottom-left
  const cornerClass = isRight
    ? 'rounded-bl-[12px] rounded-tl-[12px] rounded-tr-[12px] rounded-br-none'
    : 'rounded-br-[12px] rounded-tr-[12px] rounded-tl-[12px] rounded-bl-none'

  return (
    <div className={`fixed bottom-[104px] z-50 w-[368px] max-w-[calc(100vw-40px)] ${positionClass}`}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="flex flex-col items-end gap-4"
        >
          {/* Close button pill — 16px gap from message card */}
          <button
            onClick={handleClose}
            className="flex h-[30px] flex-row items-center gap-2 rounded-[38px] bg-[#F9FAFB] px-4 py-1 font-['Outfit'] text-[16px] leading-[140%] font-medium text-[#475467] transition-colors hover:text-[#1E1E1E]"
          >
            <X size={16} className="text-[#475467]" />
            Close
          </button>

          {/* Main message card */}
          <div className={`relative flex w-full flex-col bg-[#EDF5FC] ${cornerClass} overflow-hidden`}>
            {/* Unread badge */}
            {totalUnreadCount > 1 && (
              <div className="absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow-sm">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </div>
            )}

            {/* Header row: icon + "From WidgetName" */}
            <div className="flex items-center gap-2 border-b border-[rgba(133,136,142,0.2)] px-4 pt-3 pb-2">
              <div className="h-6 w-6 flex-shrink-0">
                <WidgetAvatar showIconFallback={true} useURL={false} />
              </div>
              <span className="font-['Outfit'] text-[16px] leading-[150%] font-normal text-[#85888E]">
                From {widgetConfig.name || 'Agent'}
              </span>
            </div>

            {/* Body */}
            <div className="line-clamp-3 px-4 py-3 font-['Outfit'] text-[14px] leading-[140%] font-normal text-[#1E1E1E]">
              {lastIncomingMessage.content}
            </div>
          </div>

          {/* "See new messages" — 16px below the card (gap-4 on parent) */}
          <button
            onClick={handleSeeMessages}
            className="flex flex-row items-center gap-2 self-start font-['Outfit'] text-[16px] leading-[140%] font-medium text-[#4D98E2] transition-colors hover:opacity-80"
          >
            <ArrowRight size={20} className="text-[#4D98E2]" />
            See new messages
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
