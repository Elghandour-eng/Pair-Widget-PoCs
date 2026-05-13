import { EmojiPicker } from '@/components/emoji-picker'
import { AttachIcon } from '@/components/icons/attach-icon'
import { EmojiIcon } from '@/components/icons/emoji-icon'
import { MicIcon } from '@/components/icons/mic-icon'
import { SendIcon } from '@/components/icons/send-icon'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { WIDGET_ALLOWED_MIME_TYPES } from '@/constants/file-upload'
import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useMediaMessageSender } from '@/features/conversation/hooks/use-media-message-sender'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { useVoiceMessageSender } from '@/features/conversation/hooks/use-voice-message-sender'
import { VoiceRecorder } from '@/features/conversation/components/voice-recorder'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { useLayoutEffect } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CONVERSATION_QUERY_KEYS } from '../constants/conversation-keys'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface ConversationTextboxProps {
  conversationId: string | null
}

function ConversationTextbox({ conversationId }: ConversationTextboxProps) {
  const [message, setMessage] = useState('')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const textEditorRef = useRef<HTMLTextAreaElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    mutateAsync: sendMessageMutation,
    isSuccess: isSendMessageSuccess,
    isPending: isSendMessagePending,
  } = useSendMessage()
  const { navigateToConversation } = useWidgetNavigation()
  const { widgetConfig } = useWidgetConfigContext()
  const { subscribeToConversation } = useUnreadMessages()
  const { handleFileSelect, isProcessing } = useMediaMessageSender({ conversationId })
  const {
    sendVoiceMessage,
    isProcessing: isVoiceProcessing,
    progress: voiceProgress,
  } = useVoiceMessageSender({ conversationId })

  // Check if emoji picker feature is enabled
  const isEmojiPickerEnabled = widgetConfig.selectedFeatureFlags?.includes('emoji_picker') ?? false

  useLayoutEffect(() => {
    // Use requestAnimationFrame to ensure the element is fully laid out
    // This is especially important when the component is inside animated containers
    // or after state updates that might cause re-renders
    requestAnimationFrame(() => {
      textEditorRef.current?.focus()
    })
  }, [isSendMessageSuccess])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (isSendMessagePending || isProcessing) {
      toast.warning('Please wait for the previous message to be sent.', {
        position: 'top-center',
        richColors: true,
      })
      return
    }

    if (!message.trim()) {
      return
    }

    const messageContent = message.trim()
    logger.debug('ConversationTextbox', 'Sending message', {
      conversationId,
      message: messageContent,
    })

    try {
      const response = await sendMessageMutation({
        ...(conversationId ? { conversation_id: conversationId } : {}),
        content: messageContent,
        message_type: 'text',
      })

      // If we didn't have a conversation ID before, update navigation and add message to cache
      if (!conversationId && response.conversation_id) {
        logger.debug('ConversationTextbox', 'Received conversation ID from first message', {
          conversationId: response.conversation_id,
        })

        logger.debug('ConversationTextbox', 'Navigating to conversation with ID', {
          conversationId: response.conversation_id,
        })
        // Update navigation with the new conversation ID
        navigateToConversation(response.conversation_id)

        // Subscribe to the new conversation for real-time updates
        logger.debug('ConversationTextbox', 'Subscribing to new conversation', {
          conversationId: response.conversation_id,
        })
        subscribeToConversation(response.conversation_id)

        // Invalidate conversations query
        queryClient.invalidateQueries({ queryKey: CONVERSATION_QUERY_KEYS.CONVERSATIONS(), exact: false })
      }

      setMessage('')
    } catch (error) {
      logger.debug('ConversationTextbox', 'Failed to send message', error)
      toast.error('Failed to send message. Please try again.', {
        position: 'top-center',
        richColors: true,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter is pressed without Shift, submit the form
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Trigger form submission
      const form = e.currentTarget.form
      if (form) {
        form.requestSubmit()
      }
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textEditorRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newMessage = message.substring(0, start) + emoji + message.substring(end)
      setMessage(newMessage)
      // Set cursor position after the inserted emoji
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + emoji.length, start + emoji.length)
      }, 0)
    } else {
      setMessage((prev) => prev + emoji)
    }
  }

  const hasMessage = message.trim().length > 0
  const canRecordVoice = !hasMessage && !isSendMessagePending && !isProcessing

  // ─── Voice mode ────────────────────────────────────────────────────────────

  if (isVoiceMode) {
    return (
      <div className="px-4 pt-4 pb-2">
        <VoiceRecorder
          primaryColor={widgetConfig.primaryColor}
          isUploading={isVoiceProcessing}
          uploadProgress={voiceProgress}
          onSend={async (payload) => {
            await sendVoiceMessage(payload.segments, payload.totalDurationMs)
            setIsVoiceMode(false)
          }}
          onCancel={() => setIsVoiceMode(false)}
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={WIDGET_ALLOWED_MIME_TYPES.join(',')}
        onChange={handleFileSelect}
      />
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <InputGroup className="border-0 bg-[#FAFAFA]">
          <InputGroupTextarea
            ref={textEditorRef}
            placeholder="Type your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isSendMessagePending || isProcessing}
          />
          <InputGroupAddon align="inline-end">
            {isEmojiPickerEnabled && (
              <div className="relative">
                <InputGroupButton
                  ref={emojiButtonRef}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                >
                  <EmojiIcon className="size-4" />
                </InputGroupButton>
                <EmojiPicker
                  isOpen={isEmojiPickerOpen}
                  onClose={() => setIsEmojiPickerOpen(false)}
                  onSelect={handleEmojiSelect}
                  buttonRef={emojiButtonRef}
                />
              </div>
            )}
            <InputGroupButton
              type="submit"
              variant="ghost"
              size="icon-xs"
              disabled={!hasMessage || isSendMessagePending}
              className="rounded-full"
            >
              {isSendMessagePending ? (
                <Spinner style={{ color: widgetConfig.primaryColor }} />
              ) : (
                <SendIcon className="size-4" style={{ color: widgetConfig.primaryColor }} />
              )}
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {widgetConfig.selectedFeatureFlags?.includes('attachments') && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-muted-foreground hover:text-foreground bg-[#FAFAFA] p-6"
            onClick={() => fileInputRef.current?.click()}
            disabled={hasMessage || isProcessing}
          >
            {isProcessing ? <Spinner className="size-4" /> : <AttachIcon className="size-4" />}
          </Button>
        )}

        {/* Mic button — WhatsApp-style: shown when input is empty */}
        {canRecordVoice && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-muted-foreground hover:text-foreground bg-[#FAFAFA] p-6"
            onClick={() => setIsVoiceMode(true)}
            aria-label="Record voice message"
          >
            <MicIcon className="size-4" />
          </Button>
        )}
      </form>
    </div>
  )
}

export { ConversationTextbox }
