import { BackIcon as RightArrowIcon } from '@/components/icons/back-icon'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { WidgetAvatar } from '@/components/widget-avatar'
import { WidgetContent } from '@/components/widget-content'
import { REPLY_TIME_MAP } from '@/constants/reply-time'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { tokenStorage } from '@/core/token-storage'
import { useConversations } from '@/features/conversation/queries/use-conversations-queries'
import { usePreChat } from '@/features/pre-chat-form/hooks/use-pre-chat'
import { getWidgetId } from '@/utils/widget-id'

const WelcomeContent = () => {
  // TODO: implement online and offline status of the host
  const isHostOnline = true

  // Get navigation functions
  const { navigateToPreChat, navigateToConversation } = useWidgetNavigation()
  const { data: conversations, isFetching: isConversationsLoading } = useConversations()
  const { widgetConfig } = useWidgetConfigContext()
  const { mutateAsync: preChatMutation, isPending: isPreChatPending } = usePreChat()
  const widgetId = getWidgetId()

  // Check if user has a token (conversation started)
  const hasConversationStarted = !!tokenStorage.get(widgetId) && conversations?.data[0]?.ulid

  // Function to start/continue conversation
  const onStartConversation = async () => {
    if (isPreChatPending || isConversationsLoading) return

    if (hasConversationStarted) {
      // Navigate to existing conversation if available
      navigateToConversation(conversations.data[0].ulid)
    } else {
      // Check if pre-chat form is required
      if (widgetConfig.requiresPreChat) {
        // Start new conversation - go to pre-chat form
        navigateToPreChat()
      } else {
        // Pre-chat is disabled - register user with empty payload and navigate to empty conversation
        try {
          if (!tokenStorage.get(widgetId)) {
            await preChatMutation({ pre_chat_data: {} })
          }
          // Navigate to conversation page with null ID (empty conversation)
          navigateToConversation(null)
        } catch (error) {
          console.error('Failed to register user:', error)
        }
      }
    }
  }

  const primaryColor = widgetConfig.primaryColor
  const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time] || 'Typically replies in a few hours'
  return (
    <WidgetContent className="flex h-full flex-col justify-end">
      <div className="outline-n-container bg-n-background dark:bg-n-solid-2 flex w-full flex-col gap-3 rounded-xl px-5 py-4 shadow outline">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="text-foreground font-medium">
              {isHostOnline ? 'We are online' : 'We are away at the moment'}
            </div>

            <span className="text-[16px] leading-[150%] font-normal tracking-[0%] text-[#85888E]">
              {isHostOnline ? replyTimeText : 'We will be back as soon as possible'}
            </span>
          </div>

          <WidgetAvatar />
        </div>

        <Button
          variant="link"
          size="sm"
          className="flex h-6 items-center justify-start gap-1 p-0! text-base font-medium hover:no-underline"
          style={{ color: primaryColor }}
          disabled={isPreChatPending || isConversationsLoading}
          onClick={onStartConversation}
        >
          {(isPreChatPending || isConversationsLoading) && <Spinner style={{ color: primaryColor }} />}
          <span>
            {!isConversationsLoading &&
              (isPreChatPending
                ? 'Starting conversation...'
                : hasConversationStarted
                  ? 'Continue conversation'
                  : 'Start conversation')}
          </span>
          {!isPreChatPending && !isConversationsLoading && <RightArrowIcon className="size-3 rotate-180" />}
        </Button>
      </div>
    </WidgetContent>
  )
}
export { WelcomeContent }
