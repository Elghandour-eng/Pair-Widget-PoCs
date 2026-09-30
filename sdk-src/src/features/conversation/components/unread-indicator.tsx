import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

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
        <ChevronDown className="mr-1 size-4" />
        {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
      </Button>
    </div>
  )
}

export { UnreadIndicator }
