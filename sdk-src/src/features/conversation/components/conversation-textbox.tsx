import type { ComponentType, CSSProperties } from 'react'
// Lazy: the emoji data and the mp3 encoder are only fetched on first use.
const EmojiPicker = lazy(() => import('@/components/emoji-picker').then((m) => ({ default: m.EmojiPicker })))
const VoiceRecorder = lazy(() =>
  import('@/features/conversation/components/voice-recorder').then((m) => ({ default: m.VoiceRecorder })),
)
import { AttachIcon } from '@/components/icons/attach-icon'
import { EmojiIcon } from '@/components/icons/emoji-icon'
import { MicIcon } from '@/components/icons/mic-icon'
import { SendIcon } from '@/components/icons/send-icon'
import { StopIcon } from '@/components/icons/stop-icon'
import { Spinner } from '@/components/ui/spinner'
import { WIDGET_ALLOWED_MIME_TYPES } from '@/constants/file-upload'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useMediaMessageSender } from '@/features/conversation/hooks/use-media-message-sender'
import { useSendChatMessageFlow } from '@/features/conversation/hooks/use-send-chat-message-flow'
import { useVoiceMessageSender } from '@/features/conversation/hooks/use-voice-message-sender'
import { isPendingMessage } from '@/features/conversation/utils/message-utils'
import { cn, hexToRgba } from '@/lib/utils'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { uiText } from '@/lib/ui-strings'
import { useLayoutEffect } from '@tanstack/react-router'
import { Image as ImageIcon, Paperclip, Sparkles, Volume2 } from 'lucide-react'
import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from 'react'
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

type Glyph = ComponentType<{ className?: string; style?: CSSProperties }>

/**
 * The studio's named action glyphs. `plus`, `mic` and `smile` are the icons the
 * widget has always drawn, so those names (and anything unknown) keep the
 * built-in one; the rest are drawn from here.
 */
const ACTION_GLYPHS = new Map<string, Glyph>([
  ['paperclip', Paperclip],
  ['image', ImageIcon],
  ['volume', Volume2],
  ['spark', Sparkles],
])

/** One action button's icon: the channel's upload, a named glyph, or the widget's own. */
function ActionGlyph({
  name,
  url,
  builtIn,
  className,
  style,
}: {
  name?: string
  url?: string
  builtIn: Glyph
  className?: string
  style: CSSProperties
}) {
  if (name === 'custom' && url) return <img src={url} alt="" style={style} />
  const Icon = (name && ACTION_GLYPHS.get(name)) || builtIn
  return <Icon className={className} style={style} />
}

interface ConversationTextboxProps {
  conversationId: string | null
  messages?: Message[]
}

function ConversationTextbox({ conversationId, messages = [] }: ConversationTextboxProps) {
  const [message, setMessage] = useState('')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const textEditorRef = useRef<HTMLTextAreaElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { widgetConfig } = useWidgetConfigContext()
  const { iconColor, ...sendButtonStyles } = widgetConfig.chatInput.sendButtonIcon.styles || {}
  const { navigateToPreChat, setInitialMessage } = useWidgetNavigation()
  const { sendMessageFlow, isPending: isSendMessagePending, isSuccess: isSendMessageSuccess } = useSendChatMessageFlow()
  const { validateAndGetFile, sendMediaMessage, isProcessing } = useMediaMessageSender({ conversationId })
  const {
    sendVoiceMessage,
    isProcessing: isVoiceProcessing,
    progress: voiceProgress,
  } = useVoiceMessageSender({ conversationId })

  useEffect(() => {
    if (!attachedFile) {
      setPreviewUrl(null)
      return
    }

    if (attachedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(attachedFile)
      setPreviewUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [attachedFile])

  const visibleMessages = messages.filter((msg) => msg.sender_type !== 'system')
  const lastMessage = visibleMessages[visibleMessages.length - 1]
  const isGenerating = lastMessage && lastMessage.sender_type === 'bot' && isPendingMessage(lastMessage)

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textEditorRef.current
    if (textarea) {
      if (!message.trim()) {
        textarea.style.height = ''
      } else {
        textarea.style.height = '0px'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 80)}px`
      }
    }
  }, [message, isGenerating])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = validateAndGetFile(e)
    if (file) {
      setAttachedFile(file)
    }
  }

  const handleRemoveAttachment = () => {
    setAttachedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
        richColors: true,
      })
      return
    }

    if (attachedFile) {
      if (!conversationId && widgetConfig.requiresPreChat) {
        toast.warning('Please fill out the pre-chat form to start the conversation and send files.', {
          richColors: true,
        })
        setInitialMessage(message.trim() || 'I would like to start a chat')
        navigateToPreChat()
        return
      }

      try {
        await sendMediaMessage(attachedFile, message.trim())
        setAttachedFile(null)
        setMessage('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error) {
        // useMediaMessageSender handles logging and toast
      }
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
  const canSend = hasMessage || !!attachedFile
  const canRecordVoice = isVoiceEnabled && !canSend && !isSendMessagePending && !isProcessing && !isGenerating

  const isFullWidth = widgetConfig.chatInput.layout === 'full_width_bar'

  // The studio's design for the parts CSS on the container cannot reach: the
  // typed text, the action buttons, and the padding around the whole composer.
  const design = widgetConfig.chatInput.design
  const px = (v: number | undefined, fallback: number) => `${typeof v === 'number' ? v : fallback}px`
  // `#brand` follows the widget colour; it is not a CSS colour by itself.
  const brand = widgetConfig.primaryColor || '#E30613'
  const rs = (c?: string) => (c === '#brand' ? brand : c || undefined)
  // No colour set keeps each glyph in the grey it has always been drawn in.
  const actionColor = rs(design?.actions?.iconColor)
  const actionStyle: CSSProperties = {
    width: px(design?.actions?.size, 36),
    height: px(design?.actions?.size, 36),
    borderRadius:
      design?.actions?.shape === 'square'
        ? '0'
        : design?.actions?.shape === 'rounded'
          ? px(design?.actions?.radius, 12)
          : '999px',
    backgroundColor: rs(design?.actions?.background),
    color: actionColor,
  }
  const actionIcon: CSSProperties = {
    width: px(design?.actions?.iconSize, 16),
    height: px(design?.actions?.iconSize, 16),
  }
  // A full-width bar reaches the panel's sides and bottom; a pill floats inside the padding.
  const containerStyle: CSSProperties = {
    backgroundColor: rs(design?.container?.background),
    paddingInline: design?.container ? (isFullWidth ? 0 : px(design.container.paddingX, 16)) : undefined,
    paddingTop: design?.container ? px(design.container.paddingTop, 16) : undefined,
    paddingBottom: design?.container ? (isFullWidth ? 0 : px(design.container.paddingBottom, 24)) : undefined,
  }
  const textStyle: CSSProperties = {
    fontFamily: design?.text?.fontFamily || undefined,
    fontSize: design?.text?.size ? `${design.text.size}px` : undefined,
    fontWeight: design?.text?.weight,
    color: rs(design?.text?.color),
    lineHeight: design?.text?.lineHeight ? String(design.text.lineHeight) : undefined,
  }
  const fieldStyle: CSSProperties = {
    boxShadow: '0 8px 16px 0 rgba(3, 7, 18, 0.08)',
    ...widgetConfig.chatInput.styles,
  }

  // Focus and hover are states, so they need real rules — and `!important`,
  // because the border, shadow and backgrounds they change are set inline.
  const field = design?.field
  const focusRule: string[] = []
  const focusBorder = rs(field?.focusBorderColor)
  if (focusBorder) focusRule.push(`border-color: ${focusBorder} !important;`)
  if (field?.focusRingWidth) {
    const ringColor = hexToRgba(rs(field.focusRingColor) ?? brand, field.focusRingOpacity ?? 0.18)
    const ring = `0 0 0 ${field.focusRingWidth}px ${ringColor}`
    // The ring is drawn over the field's own shadow, not instead of it.
    const drop = fieldStyle.boxShadow
    focusRule.push(`box-shadow: ${drop && drop !== 'none' ? `${ring}, ${drop}` : ring} !important;`)
  }
  const sendHover = rs(design?.send?.hoverBackground)
  const actionHover = rs(design?.actions?.hoverBackground)
  const stateRules = [
    focusRule.length ? `.pair-composer:focus-within { ${focusRule.join(' ')} }` : '',
    sendHover ? `.pair-send:hover:not(:disabled) { background-color: ${sendHover} !important; }` : '',
    actionHover && actionHover !== 'transparent'
      ? `.pair-action:hover:not(:disabled) { background-color: ${actionHover} !important; }`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  // The send button sits inside the field, or beside it when the studio says so.
  const sendOutside = design?.send?.position === 'outside'
  const sendDisabled = !isGenerating && (!canSend || isSendMessagePending || isProcessing)
  // Beside the field, the button lines up with the field's own row of controls.
  const sendLift = Math.max(
    0,
    (isFullWidth ? 0 : (field?.borderWidth ?? 1)) +
      (field?.paddingY ?? 5) +
      (Math.max(36, design?.actions?.size ?? 36) - (design?.send?.size ?? 36)) / 2,
  )
  const sendButton = (
    <button
      type={isGenerating ? 'button' : 'submit'}
      disabled={sendDisabled}
      onClick={isGenerating ? handleStop : undefined}
      className={cn(
        'pair-send flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E1E1E] text-white transition-colors hover:bg-[#333333]',
        sendDisabled && 'cursor-not-allowed hover:bg-[#1E1E1E]',
        sendDisabled && !design?.send && 'opacity-40',
      )}
      style={{
        ...sendButtonStyles,
        ...(sendDisabled && design?.send ? { opacity: design.send.disabledOpacity ?? 0.4 } : {}),
        ...(sendOutside ? { marginBottom: `${sendLift}px` } : {}),
      }}
      aria-label={isGenerating ? 'Stop generating' : 'Send message'}
    >
      {isGenerating ? (
        <StopIcon className="size-3 text-white" />
      ) : isSendMessagePending || isProcessing ? (
        <Spinner className="size-4 text-white" />
      ) : (
        <SendIcon
          className={cn('size-3', !iconColor && 'text-white')}
          style={{
            ...(iconColor ? { color: iconColor } : {}),
            // The studio's icon size; with no design the glyph keeps its 12px.
            ...(design?.send?.iconSize
              ? { width: px(design.send.iconSize, 12), height: px(design.send.iconSize, 12) }
              : {}),
          }}
          variant={widgetConfig.chatInput.sendButtonIcon.variant}
        />
      )}
    </button>
  )

  // ─── Voice mode ────────────────────────────────────────────────────────────

  if (isVoiceMode) {
    return (
      <div className={isFullWidth ? 'w-full pt-4' : 'w-full px-4 pt-4 pb-6'}>
        <Suspense fallback={<div className="min-h-11.5" />}>
          <VoiceRecorder
            isUploading={isVoiceProcessing}
            uploadProgress={voiceProgress}
            onSend={async (payload) => {
              await sendVoiceMessage(payload.segments, payload.totalDurationMs)
              setIsVoiceMode(false)
            }}
            onCancel={() => setIsVoiceMode(false)}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className={isFullWidth ? 'w-full pt-4' : 'w-full px-4 pt-4 pb-6'} style={containerStyle}>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={WIDGET_ALLOWED_MIME_TYPES.join(',')}
        onChange={handleFileSelect}
      />

      {/* Attached file preview */}
      {attachedFile && (
        <div className="animate-in fade-in slide-in-from-bottom-1 mb-2 flex items-center justify-between rounded-xl border border-[#ECECED] bg-[#F8F9FA] p-2 duration-200 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 overflow-hidden font-['DM_Sans']">
            {attachedFile.type.startsWith('image/') && previewUrl ? (
              <div className="dark:border-gray-850 relative size-10 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                <img src={previewUrl} alt="Attachment preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="text-red-650 flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20 dark:text-red-400">
                {/* SVG/Icon for Video or generic file */}
                <svg className="size-5 text-[#626A6A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="text-gray-750 dark:text-gray-250 truncate text-xs font-medium">{attachedFile.name}</span>
              <span className="text-[10px] text-gray-500">{(attachedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveAttachment}
            className="flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-[#E4E4E6] hover:text-[#1A1A1A]"
            aria-label="Remove attachment"
            disabled={isProcessing}
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex w-full items-end"
        style={{ direction: fieldStyle.direction, gap: sendOutside ? px(field?.gap, 8) : undefined }}
      >
        <div
          className={cn(
            'pair-composer flex min-h-11.5 min-w-0 flex-1 items-end gap-2 rounded-full border bg-white p-1.25 transition-colors duration-200',
            isGenerating ? 'border-[#B8AB80]' : 'border-[#ECECED]',
          )}
          style={fieldStyle}
        >
          {/* Left attach button inside pill */}
          {widgetConfig.chatInput.actions.showFileUpload && !isGenerating ? (
            <button
              type="button"
              className="pair-action flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F3] text-[#626A6A] transition-colors hover:bg-[#E4E4E6] disabled:cursor-not-allowed disabled:opacity-40"
              style={actionStyle}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || canSend}
              aria-label="Attach file"
            >
              {isProcessing ? (
                <Spinner className="size-4" />
              ) : (
                <ActionGlyph
                  name={design?.actions?.attachIcon}
                  url={design?.actions?.attachUrl}
                  builtIn={AttachIcon}
                  className={actionColor ? undefined : 'text-[#474747]'}
                  style={actionIcon}
                />
              )}
            </button>
          ) : null}

          {/* Center Textarea */}
          <div className="flex min-h-9 min-w-0 flex-1 items-center pl-1">
            <style>{`
              .custom-chat-textarea::placeholder {
                ${cssPropertiesToString(widgetConfig.chatInput.placeholder.styles)}
              }
              ${stateRules}
            `}</style>
            <textarea
              ref={textEditorRef}
              placeholder={
                isGenerating ? uiText(widgetConfig.locale, 'generating') : widgetConfig.chatInput.placeholder.text
              }
              value={isGenerating ? '' : message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isGenerating || isSendMessagePending || isProcessing}
              style={textStyle}
              className={cn(
                'custom-chat-textarea block w-full resize-none border-0 bg-transparent p-0 focus:ring-0 focus:outline-none',
                isGenerating
                  ? "animate-pulse font-['DM_Sans'] text-[14px] leading-[150%] font-normal text-(--Text-Dark-Tertiary,#757575) placeholder:text-(--Text-Dark-Tertiary,#757575)"
                  : "font-['DM_Sans'] text-[0.875rem] leading-[150%] font-normal text-[#1A1A1A]",
              )}
            />
          </div>

          {/* Right actions (Emoji picker, mic, send) */}
          <div
            className={cn(
              'mr-px shrink-0 items-center gap-0.5',
              sendOutside && !isEmojiPickerEnabled && !canRecordVoice ? 'hidden' : 'flex',
            )}
            style={{ gap: px(design?.actions?.gap, 2) }}
          >
            {isEmojiPickerEnabled && (
              <div className="relative flex items-center">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  className="pair-action hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-[#626A6A] transition-colors hover:bg-[#F2F2F3] disabled:cursor-not-allowed disabled:opacity-40"
                  style={actionStyle}
                  onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                  disabled={isGenerating}
                  aria-label="Insert emoji"
                >
                  <ActionGlyph
                    name={design?.actions?.emojiIcon}
                    url={design?.actions?.emojiUrl}
                    builtIn={EmojiIcon}
                    style={actionIcon}
                  />
                </button>
                {isEmojiPickerOpen && (
                  <Suspense fallback={null}>
                    <EmojiPicker
                      isOpen={isEmojiPickerOpen}
                      onClose={() => setIsEmojiPickerOpen(false)}
                      onSelect={handleEmojiSelect}
                      buttonRef={emojiButtonRef}
                    />
                  </Suspense>
                )}
              </div>
            )}

            {canRecordVoice && (
              <button
                type="button"
                className="pair-action flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#E4E4E6]"
                style={actionStyle}
                onClick={() => setIsVoiceMode(true)}
                aria-label="Record voice message"
              >
                <ActionGlyph
                  name={design?.actions?.voiceIcon}
                  url={design?.actions?.voiceUrl}
                  builtIn={MicIcon}
                  className={actionColor ? undefined : 'text-[#757575]'}
                  style={actionIcon}
                />
              </button>
            )}

            {!sendOutside && sendButton}
          </div>
        </div>
        {sendOutside && sendButton}
      </form>
    </div>
  )
}

export { ConversationTextbox }
