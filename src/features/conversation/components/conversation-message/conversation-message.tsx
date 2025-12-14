import { TextMessage } from '@/features/conversation/components/conversation-message/text-message'
import type { Message } from '@/features/conversation/types/message'

interface ConversationMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
}

import { ImageMessage } from '@/features/conversation/components/conversation-message/image-message'

import { VideoMessage } from '@/features/conversation/components/conversation-message/video-message'

import { CsatMessage } from '@/features/conversation/components/conversation-message/csat-message'

function ConversationMessage({ message, isUnread, primaryColor, websiteName }: ConversationMessageProps) {
  // Determine message type and render appropriate component
  // Currently only text messages are supported, but this structure allows for easy extension
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
    // case 'audio':
    //   return <AudioMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
    default:
      // Fallback to text message for unknown types
      return <TextMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
  }
}

export { ConversationMessage }
