import { WidgetFooter } from '@/components/widget-footer'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { tokenStorage } from '@/core/token-storage'
import { ConversationTextbox } from '@/features/conversation/components/conversation-textbox'
import { useConversations } from '@/features/conversation/queries/use-conversations-queries'
import { IntroContent } from '@/features/intro/components/intro-content'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function IntroPage() {
  logger.debug('IntroPage', 'Component rendered')

  const { data: conversations } = useConversations()
  const widgetId = getWidgetId()
  const conversationId = (!!tokenStorage.get(widgetId) && conversations?.data[0]?.ulid) || null

  const { widgetConfig } = useWidgetConfigContext()

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        background: widgetConfig.widgetBgColor,
      }}
    >
      <IntroContent />

      <ConversationTextbox conversationId={conversationId} />
      {widgetConfig.showFooter && <WidgetFooter />}
    </div>
  )
}
