import { useMutation } from '@tanstack/react-query'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { sendMessage } from '@/features/conversation/apis/send-message'
import type { SendMessageRequest } from '@/features/conversation/types/send-message-request'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function useSendMessage() {
  logger.debug('useSendMessage', 'Initializing send message mutation hook')
  const { widgetConfig } = useWidgetConfigContext()

  return useMutation({
    mutationFn: (variables: SendMessageRequest) => {
      logger.debug('🔵 MESSAGE:RENDER', 'Sending message via XHR', {
        conversationId: variables.conversation_id,
        contentLength: variables.content.length,
        messageType: variables.message_type,
      })
      return sendMessage(variables, widgetConfig)
    },
    onSuccess: (data) => {
      logger.debug('✅ MESSAGE:RENDER', 'Message sent successfully via XHR', {
        messageId: data.message_id,
        conversationId: data.conversation_id,
      })

      logger.debug('🔵 MESSAGE:RENDER', 'Waiting for Pusher event to render outgoing message...', {
        messageId: data.message_id,
      })
      // All messages (both outgoing and incoming) are now rendered via WebSocket/Pusher
      // No optimistic updates needed - wait for Pusher event
    },
    onError: (error) => {
      logger.debug('🔴 MESSAGE:RENDER', 'Failed to send message via XHR', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      // Since we're not doing optimistic updates, just log the error
      // The UI won't show a failed message since it was never added
    },
  })
}
