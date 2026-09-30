import { useMutation } from '@tanstack/react-query'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { sendMessage } from '@/features/conversation/apis/send-message'
import type { Message } from '@/features/conversation/types/message'
import type { SendMessageRequest } from '@/features/conversation/types/send-message-request'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

type MessagesCache = {
  pages: Array<{ data: Message[]; has_more: boolean; next_cursor?: string }>
  pageParams: unknown[]
}

/** Inserts the visitor's message instantly (dimmed, pending) — the server echo replaces it by content match. */
function insertOptimistic(conversationId: string, content: string): string {
  const widgetId = getWidgetId()
  const ulid = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const msg: Message = {
    ulid,
    type: 'message',
    content,
    message_type: 'text',
    sender_type: 'contact',
    sent_at: new Date().toISOString(),
    status: 'pending',
    is_csat_survey: false,
  }
  queryClient.setQueriesData<MessagesCache>(
    { queryKey: ['conversations', widgetId, conversationId, 'messages'], exact: false },
    (old) => {
      if (!old || !old.pages || old.pages.length === 0)
        return { pages: [{ data: [msg], has_more: false }], pageParams: [undefined] }
      const pages = [...old.pages]
      const last = pages[pages.length - 1]
      pages[pages.length - 1] = { ...last, data: [...last.data, msg] }
      return { ...old, pages }
    },
  )
  return ulid
}

function removeOptimistic(conversationId: string, ulid: string): void {
  const widgetId = getWidgetId()
  queryClient.setQueriesData<MessagesCache>(
    { queryKey: ['conversations', widgetId, conversationId, 'messages'], exact: false },
    (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.filter((m) => m.ulid !== ulid) })) } : old,
  )
}

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function useSendMessage() {
  logger.debug('useSendMessage', 'Initializing send message mutation hook')
  const { widgetConfig } = useWidgetConfigContext()

  return useMutation({
    onMutate: (variables: SendMessageRequest) => {
      if (variables.conversation_id && variables.message_type === 'text') {
        return {
          optimisticUlid: insertOptimistic(variables.conversation_id, variables.content),
          conversationId: variables.conversation_id,
        }
      }
      return {}
    },
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
    onError: (error, _variables, context) => {
      const ctx = context as { optimisticUlid?: string; conversationId?: string } | undefined
      if (ctx?.optimisticUlid && ctx.conversationId) removeOptimistic(ctx.conversationId, ctx.optimisticUlid)
      logger.debug('🔴 MESSAGE:RENDER', 'Failed to send message via XHR', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      // The UI won't show a failed message since it was never added
    },
  })
}
