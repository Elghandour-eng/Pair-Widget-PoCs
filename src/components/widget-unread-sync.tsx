import { useEffect } from 'react'

import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// Check if we're in SDK mode (embedded in iframe)
function isInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

// Send message to parent (SDK)
function sendToParent(type: string, data?: Record<string, unknown>) {
  if (isInIframe() && window.parent) {
    window.parent.postMessage({ type, ...data }, '*')
  }
}

/**
 * Component that syncs unread message count from widget to SDK bubble badge
 * Must be rendered inside UnreadMessagesProvider, WidgetUIProvider, and WidgetNavigationProvider
 */
export function WidgetUnreadSync() {
  const { getVisibleUnreadCount, setViewingConversation, lastIncomingMessage, isPreviewDismissed, dismissPreview } =
    useUnreadMessages()
  const { isOpen } = useWidgetUIContext()
  const { currentScreen, conversationId } = useWidgetNavigation()
  const visibleUnreadCount = getVisibleUnreadCount()

  // Update viewing state in UnreadMessagesProvider when navigation changes
  useEffect(() => {
    setViewingConversation(conversationId, isOpen, currentScreen)
  }, [conversationId, isOpen, currentScreen, setViewingConversation])

  // Send unread count to SDK whenever it changes
  useEffect(() => {
    logger.debug('WidgetUnreadSync', 'Sending unread count to SDK', {
      count: visibleUnreadCount,
      isOpen,
      currentScreen,
      conversationId,
    })
    sendToParent('widget:unreadCount', { count: visibleUnreadCount })
  }, [visibleUnreadCount, isOpen, currentScreen, conversationId])

  // Listen for sdk:dismissPreview from parent SDK (e.g. user clicked Close on the SDK-rendered preview)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return
      if (event.data.type === 'sdk:dismissPreview') {
        dismissPreview()
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
    }
  }, [dismissPreview])

  // Send preview data to parent SDK to render natively
  useEffect(() => {
    if (lastIncomingMessage && !isPreviewDismissed) {
      sendToParent('widget:previewMessage', {
        message: {
          content: lastIncomingMessage.content,
          senderName: lastIncomingMessage.senderName,
          senderAvatar: lastIncomingMessage.senderAvatar,
        },
        unreadCount: visibleUnreadCount,
      })
    } else if (isPreviewDismissed) {
      sendToParent('widget:dismissPreview')
    }
  }, [lastIncomingMessage, isPreviewDismissed, visibleUnreadCount])

  return null
}
