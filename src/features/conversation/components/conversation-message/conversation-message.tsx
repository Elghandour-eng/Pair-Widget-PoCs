import { AiAssistantMessage } from '@/features/conversation/components/conversation-message/ai-assistant-message/ai-assistant-message'
import { TextMessage } from '@/features/conversation/components/conversation-message/text-message'
import type { Message } from '@/features/conversation/types/message'

interface ConversationMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
  isLastMessage?: boolean
}

import { ImageMessage } from '@/features/conversation/components/conversation-message/image-message'

import { VideoMessage } from '@/features/conversation/components/conversation-message/video-message'

import { AudioMessage } from '@/features/conversation/components/conversation-message/audio-message'

import { CsatMessage } from '@/features/conversation/components/conversation-message/csat-message'

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac', '.opus']
const AUDIO_MIME_PREFIXES = ['audio/']

/**
 * Detects audio messages that arrive as message_type "text" but actually
 * carry an audio media_url or file_type in metadata.
 * The backend currently returns voice messages with message_type: "text".
 * Remove this after the backend starts sending audio messages with message_type "audio".
 */
function isAudioMessage(message: Message): boolean {
  // Explicit audio type
  if (message.message_type === 'audio') return true

  // Check metadata file_type
  const fileType = (message.metadata?.file_type as string | undefined) ?? ''
  if (AUDIO_MIME_PREFIXES.some((p) => fileType.startsWith(p))) return true

  // Check media_url extension
  const url = message.media_url || (message.metadata?.media_url as string | undefined) || ''
  if (url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase()
      if (AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true
    } catch {
      // Malformed URL — skip
    }
  }

  return false
}

function ConversationMessage({
  message,
  isUnread,
  primaryColor,
  websiteName,
  isLastMessage,
}: ConversationMessageProps) {
  // Determine message type and render appropriate component
  // Audio detection runs first — the API currently returns voice messages as message_type "text"
  if (isAudioMessage(message)) {
    return <AudioMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
  }

  switch (message.message_type) {
    case 'text':
      if (message.is_csat_survey) {
        return (
          <CsatMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
        )
      }
      return <TextMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
    case 'image':
      return (
        <ImageMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
      )
    // case 'file':
    //   return <FileMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
    case 'video':
      return (
        <VideoMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
      )
    case 'interactive':
      if (message.is_csat_survey) {
        return (
          <CsatMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
        )
      }
      // Fallback for other interactive types or unknown
      return <TextMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
    case 'widget_message':
      return <AiAssistantMessage message={message} isLastMessage={isLastMessage} />
    default:
      // Fallback to text message for unknown types
      return <TextMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
  }
}

export { ConversationMessage }
