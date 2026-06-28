import { useMutation, useQueryClient } from '@tanstack/react-query'

import { submitFeedback, type SendFeedbackRequest } from '@/features/conversation/apis/feedback'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import type { MessagesListResponse, Message } from '@/features/conversation/types/message'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export const useMessageFeedback = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SendFeedbackRequest) => {
      logger.debug('useMessageFeedback', 'Mutation triggered', data)
      return submitFeedback(data)
    },
    onSuccess: (data, variables) => {
      logger.debug('useMessageFeedback', 'Mutation success', { data, variables })

      // Optimistically update the message's feedback in the React Query cache
      const queryKey = ['messages', variables.conversationId]
      queryClient.setQueriesData<MessagesListResponse | { pages: MessagesListResponse[] }>({ queryKey }, (oldData) => {
        if (!oldData) return oldData

        // Handle paginated structure (infinite query)
        if ('pages' in oldData) {
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: page.data.map((msg: Message) => {
                if (msg.ulid === variables.messageId) {
                  return { ...msg, ai_feedback: variables.feedback }
                }
                return msg
              }),
            })),
          }
        }

        // Handle flat structure
        return {
          ...oldData,
          data: oldData.data.map((msg: Message) => {
            if (msg.ulid === variables.messageId) {
              return { ...msg, ai_feedback: variables.feedback }
            }
            return msg
          }),
        }
      })
    },
    onError: (error, variables) => {
      logger.debug('useMessageFeedback', 'Mutation error', { error, variables })
    },
  })
}
