import { useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { WIDGET_ALLOWED_MIME_TYPES, WIDGET_MAX_FILE_SIZE } from '@/constants/file-upload'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { tokenStorage } from '@/core/token-storage'
import { CONVERSATION_QUERY_KEYS } from '@/features/conversation/constants/conversation-keys'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { useUploadMedia } from '@/features/conversation/hooks/use-upload-media'
import { usePreChat } from '@/features/pre-chat-form/hooks/use-pre-chat'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface UseMediaMessageSenderProps {
  conversationId: string | null
}

export function useMediaMessageSender({ conversationId }: UseMediaMessageSenderProps) {
  const queryClient = useQueryClient()
  const { navigateToConversation, currentScreen, conversationId: navConversationId } = useWidgetNavigation()
  const { subscribeToConversation } = useUnreadMessages()
  const { mutateAsync: preChatMutation } = usePreChat()
  const { widgetConfig } = useWidgetConfigContext()

  const { mutateAsync: sendMessageMutation, isPending: isSendMessagePending } = useSendMessage()

  const { mutateAsync: uploadMediaMutation, isPending: isUploadMediaPending } = useUploadMedia()

  const validateAndGetFile = (e: ChangeEvent<HTMLInputElement>): File | null => {
    const file = e.target.files?.[0]
    if (!file) return null

    // Reset input value right after selecting so the same file can be chosen again
    e.target.value = ''

    // Validate file type
    if (!WIDGET_ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error('File type not supported. Please upload an image or video.', {
        position: 'top-center',
        richColors: true,
      })
      return null
    }

    // Validate file size
    if (file.size > WIDGET_MAX_FILE_SIZE) {
      toast.error(`File size exceeds the limit of ${WIDGET_MAX_FILE_SIZE / (1024 * 1024)}MB.`, {
        position: 'top-center',
        richColors: true,
      })
      return null
    }

    return file
  }

  const sendMediaMessage = async (file: File, caption: string = '') => {
    const widgetId = getWidgetId()
    if (!widgetId) {
      throw new Error('Widget ID is required')
    }

    // Auto-register if not registered yet and pre-chat form is not required
    if (!tokenStorage.get(widgetId)) {
      try {
        await preChatMutation({
          pre_chat_data: {},
          ...(widgetConfig.userId ? { user_id: widgetConfig.userId } : {}),
        })
      } catch (err) {
        logger.debug('useMediaMessageSender', 'Failed to auto-register user', err)
        toast.error('Failed to start chat. Please try again.', {
          position: 'top-center',
          richColors: true,
        })
        throw err
      }
    }

    try {
      // 1. Upload file
      const uploadResponse = await uploadMediaMutation(file)

      // 2. Determine message type
      // Use the media type returned from the server as the source of truth
      const messageType = uploadResponse.media_type as 'image' | 'video'

      // 3. Send message with media payload
      const response = await sendMessageMutation({
        ...(conversationId ? { conversation_id: conversationId } : {}),
        content: caption,
        message_type: messageType,
        media_url: uploadResponse.media_url,
        metadata: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        },
      })

      // Handle navigation if needed (same as text message)
      if (!conversationId && response.conversation_id) {
        navigateToConversation(response.conversation_id)
        subscribeToConversation(response.conversation_id)
        queryClient.invalidateQueries({ queryKey: CONVERSATION_QUERY_KEYS.CONVERSATIONS(), exact: false })
      } else if (conversationId) {
        if (currentScreen !== 'conversation' || navConversationId !== conversationId) {
          navigateToConversation(conversationId)
        }
      }

      return response
    } catch (error) {
      logger.debug('useMediaMessageSender', 'Failed to upload/send media', error)
      toast.error('Failed to upload file. Please try again.', {
        position: 'top-center',
        richColors: true,
      })
      throw error
    }
  }

  return {
    validateAndGetFile,
    sendMediaMessage,
    isUploading: isUploadMediaPending,
    isSending: isSendMessagePending,
    isProcessing: isUploadMediaPending || isSendMessagePending,
  }
}
