import { useEffect } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { WidgetFooter } from '@/components/widget-footer'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { ConversationHeader } from '../components/conversation-header'
import { ConversationMessages } from '../components/conversation-messages'
import { ConversationTextbox } from '../components/conversation-textbox'
import { useMessages } from '../queries/use-messages-queries'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface ConversationPageProps {
  conversationId: string | null
}

function ConversationPage({ conversationId }: ConversationPageProps) {
  logger.debug('ConversationPage', 'Component rendered', { conversationId })

  const { widgetConfig } = useWidgetConfigContext()
  const { currentScreen } = useWidgetNavigation()
  const { isOpen } = useWidgetUIContext()
  const { setViewingConversation } = useUnreadMessages()

  // Only fetch messages if we have a conversation ID
  logger.debug('🟣 MESSAGE:RENDER', 'ConversationPage calling useMessages hook', {
    conversationId,
    hasConversationId: !!conversationId,
  })

  const {
    data: messagesData,
    isLoading,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
  } = useMessages(conversationId || '', {
    limit: 10,
  })

  logger.debug('🟣 MESSAGE:RENDER', 'useMessages hook returned data', {
    conversationId,
    hasData: !!messagesData,
    pagesCount: messagesData?.pages?.length || 0,
    totalMessages: messagesData?.pages?.reduce((sum, page) => sum + page.data.length, 0) || 0,
    isLoading,
  })

  // Flatten all pages into a single array
  // Pages are in order: newest page first, oldest page last
  // Each page's messages are already reversed (oldest first, newest last)
  const allMessages = messagesData?.pages.slice().flatMap((page) => page.data) || []

  // Update viewing state for badge visibility logic
  useEffect(() => {
    setViewingConversation(conversationId, isOpen, currentScreen)

    logger.debug('ConversationPage', 'Updated viewing state', {
      conversationId,
      isOpen,
      currentScreen,
    })
  }, [conversationId, isOpen, currentScreen, setViewingConversation])

  // Note: We don't auto-mark conversation as read here anymore
  // Instead, it's handled by:
  // 1. onReachBottom callback in ConversationMessages (when user scrolls to bottom)
  // 2. Progressive marking via Intersection Observer (when messages come into view)
  // This ensures unread indicator shows correctly when user is scrolled up

  return (
    <>
      <ConversationHeader />
      {!conversationId ? (
        <ConversationMessages
          messages={[]}
          conversationId={null}
          hasMore={false}
          onLoadMore={() => {}}
          isLoadingMore={false}
        />
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner className="size-4" style={{ color: widgetConfig.primaryColor }} />
            Loading messages...
          </p>
        </div>
      ) : (
        <ConversationMessages
          messages={allMessages}
          conversationId={conversationId}
          hasMore={hasPreviousPage || false}
          onLoadMore={fetchPreviousPage}
          isLoadingMore={isFetchingPreviousPage}
        />
      )}
      <ConversationTextbox conversationId={conversationId} />
      <WidgetFooter />
    </>
  )
}

export { ConversationPage }
