import { EmojiPicker } from '@/components/emoji-picker'
import { AttachIcon } from '@/components/icons/attach-icon'
import { EmojiIcon } from '@/components/icons/emoji-icon'
import { MicIcon } from '@/components/icons/mic-icon'
import { SendIcon } from '@/components/icons/send-icon'
import { StopIcon } from '@/components/icons/stop-icon'
import { Spinner } from '@/components/ui/spinner'
import { WIDGET_ALLOWED_MIME_TYPES } from '@/constants/file-upload'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { VoiceRecorder } from '@/features/conversation/components/voice-recorder'
import { useMediaMessageSender } from '@/features/conversation/hooks/use-media-message-sender'
import { useSendChatMessageFlow } from '@/features/conversation/hooks/use-send-chat-message-flow'
import { useVoiceMessageSender } from '@/features/conversation/hooks/use-voice-message-sender'
import { isPendingMessage } from '@/features/conversation/utils/message-utils'
import { cn } from '@/lib/utils'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { useLayoutEffect } from '@tanstack/react-router'
import { MicOff } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Message } from '../types/message'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

const cssPropertiesToString = (styles?: React.CSSProperties) => {
  if (!styles) return ''
  return Object.entries(styles)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `${cssKey}: ${value};`
    })
    .join('\n')
}

interface ConversationTextboxProps {
  conversationId: string | null
  messages?: Message[]
}

function ConversationTextbox({ conversationId, messages = [] }: ConversationTextboxProps) {
  const [message, setMessage] = useState('')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const textEditorRef = useRef<HTMLTextAreaElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { widgetConfig } = useWidgetConfigContext()
  const { sendMessageFlow, isPending: isSendMessagePending, isSuccess: isSendMessageSuccess } = useSendChatMessageFlow()
  const { handleFileSelect, isProcessing } = useMediaMessageSender({ conversationId })
  const {
    sendVoiceMessage,
    isProcessing: isVoiceProcessing,
    progress: voiceProgress,
  } = useVoiceMessageSender({ conversationId })

  const visibleMessages = messages.filter((msg) => msg.sender_type !== 'system')
  const lastMessage = visibleMessages[visibleMessages.length - 1]
  const isGenerating = lastMessage && lastMessage.sender_type === 'bot' && isPendingMessage(lastMessage)

  const handleStop = () => {
    if (!conversationId) return

    logger.debug('ConversationTextbox', 'Stopping generation - deleting pending bot message', {
      conversationId,
    })

    const widgetId = getWidgetId()
    if (!widgetId) return

    const queryKeyFilter = ['conversations', widgetId, conversationId, 'messages']

    // TODO: Send API request to stop/cancel generation if endpoint is added in the future

    queryClient.setQueriesData<{
      pages: Array<{ data: Message[]; has_more: boolean; next_cursor?: string }>
      pageParams: unknown[]
    }>(
      {
        queryKey: queryKeyFilter,
        exact: false,
      },
      (oldData) => {
        if (!oldData || !oldData.pages) return oldData

        const updatedPages = oldData.pages.map((page) => {
          const filteredData = page.data.filter((msg) => !(msg.sender_type === 'bot' && isPendingMessage(msg)))
          return {
            ...page,
            data: filteredData,
          }
        })

        return {
          ...oldData,
          pages: updatedPages,
        }
      },
    )
  }

  // Check if emoji picker and voice features are enabled from chatInput actions
  const isEmojiPickerEnabled = widgetConfig.chatInput.actions.showEmojiPicker
  const isVoiceEnabled = widgetConfig.chatInput.actions.showVoiceMessages

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

    const messageContent = message.trim()
    if (!messageContent) {
      return
    }

    try {
      await sendMessageFlow(messageContent, conversationId)
      setMessage('')
    } catch (error) {
      // The hook handles logging and toasts, so we just catch the error to avoid crashing
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
  const canRecordVoice = isVoiceEnabled && !hasMessage && !isSendMessagePending && !isProcessing && !isGenerating

  const isFullWidth = widgetConfig.chatInput.layout === 'full_width_bar'

  // ─── Voice mode ────────────────────────────────────────────────────────────

  if (isVoiceMode) {
    return (
      <div className={isFullWidth ? 'w-full pt-4' : 'w-full px-4 pt-4 pb-6'}>
        <VoiceRecorder
          primaryColor="#3D8EDD"
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
    <div className={isFullWidth ? 'w-full pt-4' : 'w-full px-4 pt-4 pb-6'}>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={WIDGET_ALLOWED_MIME_TYPES.join(',')}
        onChange={handleFileSelect}
      />
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex min-h-11.5 w-full items-center gap-2 rounded-full border bg-white p-1.25 transition-colors duration-200',
          isGenerating ? 'border-[#B8AB80]' : 'border-[#ECECED]',
        )}
        style={{
          boxShadow: '0 8px 16px 0 rgba(3, 7, 18, 0.08)',
          ...widgetConfig.chatInput.styles,
        }}
      >
        {/* Left attach button inside pill */}
        {widgetConfig.chatInput.actions.showFileUpload && !isGenerating ? (
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F3] text-[#626A6A] transition-colors hover:bg-[#E4E4E6] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || hasMessage}
            aria-label="Attach file"
          >
            {isProcessing ? <Spinner className="size-4" /> : <AttachIcon className="size-3 fill-[#474747]" />}
          </button>
        ) : null}

        {/* Center Textarea */}
        <div className="flex min-h-9 min-w-0 flex-1 items-center pl-1">
          <style>{`
            .custom-chat-textarea::placeholder {
              ${cssPropertiesToString(widgetConfig.chatInput.placeholder.styles)}
            }
          `}</style>
          <textarea
            ref={textEditorRef}
            placeholder={isGenerating ? 'Generating...' : widgetConfig.chatInput.placeholder.text}
            value={isGenerating ? '' : message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isGenerating || isSendMessagePending || isProcessing}
            className={cn(
              'custom-chat-textarea block w-full resize-none border-0 bg-transparent p-0 focus:ring-0 focus:outline-none',
              isGenerating
                ? "animate-pulse font-['DM_Sans'] text-[14px] leading-[150%] font-normal text-(--Text-Dark-Tertiary,#757575) placeholder:text-(--Text-Dark-Tertiary,#757575)"
                : "font-['DM_Sans'] text-[0.875rem] leading-[150%] font-normal text-[#1A1A1A]",
            )}
          />
        </div>

        {/* Right actions (Emoji picker, mic, send) */}
        <div className="mr-px flex shrink-0 items-center gap-2">
          {isEmojiPickerEnabled && (
            <div className="relative flex items-center">
              <button
                ref={emojiButtonRef}
                type="button"
                className="hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-[#626A6A] transition-colors hover:bg-[#F2F2F3] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                disabled={isGenerating}
                aria-label="Insert emoji"
              >
                <EmojiIcon className="size-4" />
              </button>
              <EmojiPicker
                isOpen={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onSelect={handleEmojiSelect}
                buttonRef={emojiButtonRef}
              />
            </div>
          )}

          {canRecordVoice && (
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full fill-white transition-colors hover:bg-[#E4E4E6]"
              onClick={() => setIsVoiceMode(true)}
              aria-label="Record voice message"
            >
              <MicIcon className="size-4 text-white" />
            </button>
          )}

          {!hasMessage && !isVoiceEnabled && (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F3] text-[#626A6A]"
              title="Voice messaging is disabled"
            >
              <MicOff className="size-4" />
            </div>
          )}

          <button
            type={isGenerating ? 'button' : 'submit'}
            disabled={isGenerating ? false : !hasMessage || isSendMessagePending}
            onClick={isGenerating ? handleStop : undefined}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E1E1E] text-white transition-colors hover:bg-[#333333]',
              !isGenerating &&
                (!hasMessage || isSendMessagePending) &&
                'cursor-not-allowed opacity-40 hover:bg-[#1E1E1E]',
            )}
            aria-label={isGenerating ? 'Stop generating' : 'Send message'}
          >
            {isGenerating ? (
              <StopIcon className="size-3 text-white" />
            ) : isSendMessagePending ? (
              <Spinner className="size-4 text-white" />
            ) : (
              <SendIcon className="size-3 text-white" variant={widgetConfig.chatInput.sendButtonIcon} />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export { ConversationTextbox }
