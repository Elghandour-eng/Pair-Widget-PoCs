import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { newMessagesText } from '@/lib/ui-strings'

interface UnreadIndicatorProps {
  unreadCount: number
  onScrollToBottom: () => void
  onScrollToFirstUnread?: () => void
}

function UnreadIndicator({ unreadCount, onScrollToBottom, onScrollToFirstUnread }: UnreadIndicatorProps) {
  const { widgetConfig } = useWidgetConfigContext()

  const handleClick = () => {
    // If a custom scroll-to-first-unread handler is provided, use it
    // Otherwise, default to scrolling to bottom
    if (onScrollToFirstUnread) {
      onScrollToFirstUnread()
    } else {
      onScrollToBottom()
    }
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Button
        onClick={handleClick}
        size="sm"
        style={{
          backgroundColor: widgetConfig.primaryColor,
          color: '#ffffff',
        }}
        className="shadow-lg hover:opacity-90"
      >
        <ChevronDown className="me-1 size-4" />
        {newMessagesText(widgetConfig.locale, unreadCount)}
      </Button>
    </div>
  )
}

export { UnreadIndicator }
