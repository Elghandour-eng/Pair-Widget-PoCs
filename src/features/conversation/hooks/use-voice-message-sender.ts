import { VOICE_MAX_FILE_SIZE } from '@/constants/file-upload'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { CONVERSATION_QUERY_KEYS } from '@/features/conversation/constants/conversation-keys'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { useUploadMedia } from '@/features/conversation/hooks/use-upload-media'
import { tokenStorage } from '@/core/token-storage'
import { usePreChat } from '@/features/pre-chat-form/hooks/use-pre-chat'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface UseVoiceMessageSenderProps {
  conversationId: string | null
}

export interface SendProgress {
  current: number
  total: number
}

export function useVoiceMessageSender({ conversationId }: UseVoiceMessageSenderProps) {
  const queryClient = useQueryClient()
  const { navigateToConversation } = useWidgetNavigation()
  const { subscribeToConversation } = useUnreadMessages()
  const { mutateAsync: preChatMutation } = usePreChat()
  const { widgetConfig } = useWidgetConfigContext()

  const { mutateAsync: uploadMediaMutation } = useUploadMedia()
  const { mutateAsync: sendMessageMutation } = useSendMessage()

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<SendProgress>({ current: 0, total: 0 })

  // Track resolved conversationId across segments (first response may return one)
  const resolvedConversationIdRef = useRef<string | null>(conversationId)

  const sendVoiceMessage = useCallback(
    async (segments: Blob[], totalDurationMs: number): Promise<void> => {
      if (segments.length === 0) return

      const widgetId = getWidgetId()
      if (!widgetId) {
        throw new Error('Widget ID is required')
      }

      setIsProcessing(true)
      setProgress({ current: 0, total: segments.length })
      resolvedConversationIdRef.current = conversationId

      // Auto-register if not registered yet and pre-chat form is not required
      if (!tokenStorage.get(widgetId)) {
        try {
          await preChatMutation({
            pre_chat_data: {},
            ...(widgetConfig.userId ? { user_id: widgetConfig.userId } : {}),
          })
        } catch (err) {
          logger.debug('useVoiceMessageSender', 'Failed to auto-register user', err)
          toast.error('Failed to start chat. Please try again.', {
            position: 'top-center',
            richColors: true,
          })
          setIsProcessing(false)
          setProgress({ current: 0, total: 0 })
          throw err
        }
      }

      logger.debug('useVoiceMessageSender', 'Starting voice message send', {
        segmentCount: segments.length,
        totalDurationMs,
        conversationId,
      })

      for (let i = 0; i < segments.length; i++) {
        const blob = segments[i]
        setProgress({ current: i + 1, total: segments.length })

        // Safety net — should never exceed 5 MB due to auto-chunking
        if (blob.size > VOICE_MAX_FILE_SIZE) {
          logger.debug('useVoiceMessageSender', `Segment ${i} exceeds 5 MB limit, skipping`, {
            size: blob.size,
          })
          toast.error(`Voice message part ${i + 1} is too large to send (max 5 MB).`, {
            position: 'top-center',
            richColors: true,
          })
          continue
        }

        const file = new File([blob], `voice-message-${i}.mp3`, { type: 'audio/mpeg' })

        try {
          // 1. Upload segment
          logger.debug('useVoiceMessageSender', `Uploading segment ${i + 1}/${segments.length}`)
          const uploadResponse = await uploadMediaMutation(file)

          // 2. Send message
          const response = await sendMessageMutation({
            ...(resolvedConversationIdRef.current ? { conversation_id: resolvedConversationIdRef.current } : {}),
            content: '',
            message_type: 'audio',
            media_url: uploadResponse.media_url,
            metadata: {
              file_name: file.name,
              file_size: blob.size,
              file_type: 'audio/mpeg',
              duration_ms: i === segments.length - 1 ? totalDurationMs : undefined,
              segment_index: segments.length > 1 ? i : undefined,
              total_segments: segments.length > 1 ? segments.length : undefined,
            },
          })

          // 3. Handle new-conversation flow on first segment only
          if (!resolvedConversationIdRef.current && response.conversation_id) {
            resolvedConversationIdRef.current = response.conversation_id
            navigateToConversation(response.conversation_id)
            subscribeToConversation(response.conversation_id)
            queryClient.invalidateQueries({
              queryKey: CONVERSATION_QUERY_KEYS.CONVERSATIONS(),
              exact: false,
            })
          }

          logger.debug('useVoiceMessageSender', `Segment ${i + 1} sent successfully`)
        } catch (error) {
          logger.debug('useVoiceMessageSender', `Failed to send segment ${i + 1}`, error)
          toast.error(
            segments.length > 1
              ? `Failed to send voice part ${i + 1} of ${segments.length}. Please try again.`
              : 'Failed to send voice message. Please try again.',
            { position: 'top-center', richColors: true },
          )
          // Continue sending remaining segments even if one fails
        }
      }

      setIsProcessing(false)
      setProgress({ current: 0, total: 0 })
    },
    [
      conversationId,
      preChatMutation,
      widgetConfig,
      uploadMediaMutation,
      sendMessageMutation,
      navigateToConversation,
      subscribeToConversation,
      queryClient,
    ],
  )

  return {
    sendVoiceMessage,
    isProcessing,
    progress,
  }
}
