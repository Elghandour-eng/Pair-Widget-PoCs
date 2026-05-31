import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { tokenStorage } from '@/core/token-storage'
import { CONVERSATION_QUERY_KEYS } from '@/features/conversation/constants/conversation-keys'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { usePreChat } from '@/features/pre-chat-form/hooks/use-pre-chat'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { toast } from 'sonner'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function useSendChatMessageFlow() {
  const {
    navigateToPreChat,
    navigateToConversation,
    setInitialMessage,
    currentScreen,
    conversationId: currentConversationId,
  } = useWidgetNavigation()
  const { mutateAsync: preChatMutation, isPending: isPreChatPending } = usePreChat()
  const sendMessageMutation = useSendMessage()
  const { subscribeToConversation } = useUnreadMessages()
  const { widgetConfig } = useWidgetConfigContext()

  const isPending = isPreChatPending || sendMessageMutation.isPending
  const isSuccess = sendMessageMutation.isSuccess

  const sendMessageFlow = async (content: string, conversationId?: string | null) => {
    const messageContent = content.trim()
    if (!messageContent) return

    // If pre-chat form is required and conversation has not started yet
    if (!conversationId && widgetConfig.requiresPreChat) {
      setInitialMessage(messageContent)
      navigateToPreChat()
      return
    }

    const widgetId = getWidgetId()
    if (!widgetId) {
      throw new Error('Widget ID is required')
    }

    // Auto-register if not registered yet and pre-chat form is not required
    if (!tokenStorage.get(widgetId)) {
      try {
        await preChatMutation({ pre_chat_data: {} })
      } catch (err) {
        logger.debug('useSendChatMessageFlow', 'Failed to auto-register user', err)
        toast.error('Failed to start chat. Please try again.', {
          position: 'top-center',
          richColors: true,
        })
        throw err
      }
    }

    logger.debug('useSendChatMessageFlow', 'Sending message in flow', {
      conversationId,
      message: messageContent,
    })

    try {
      const response = await sendMessageMutation.mutateAsync({
        ...(conversationId ? { conversation_id: conversationId } : {}),
        content: messageContent,
        message_type: 'text',
      })

      // If we didn't have a conversation ID before, update navigation and subscribe
      if (!conversationId && response.conversation_id) {
        logger.debug('useSendChatMessageFlow', 'Received conversation ID from first message', {
          conversationId: response.conversation_id,
        })

        logger.debug('useSendChatMessageFlow', 'Navigating to conversation with ID', {
          conversationId: response.conversation_id,
        })
        navigateToConversation(response.conversation_id)

        logger.debug('useSendChatMessageFlow', 'Subscribing to new conversation', {
          conversationId: response.conversation_id,
        })
        subscribeToConversation(response.conversation_id)

        // Invalidate conversations query
        queryClient.invalidateQueries({ queryKey: CONVERSATION_QUERY_KEYS.CONVERSATIONS(), exact: false })
      } else if (conversationId) {
        if (currentScreen !== 'conversation' || currentConversationId !== conversationId) {
          logger.debug('useSendChatMessageFlow', 'Navigating to existing conversation', {
            conversationId,
            currentScreen,
            currentConversationId,
          })
          navigateToConversation(conversationId)
        }
      }

      return response
    } catch (error) {
      logger.debug('useSendChatMessageFlow', 'Failed to send message', error)
      toast.error('Failed to send message. Please try again.', {
        position: 'top-center',
        richColors: true,
      })
      throw error
    }
  }

  return {
    sendMessageFlow,
    isPending,
    isSuccess,
  }
}
