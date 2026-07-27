import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import type { ApiMessage, Message, InteractiveMetadata, NextMessageItem } from '../types/message'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Maps message_type number to sender_type
 */
function mapSenderType(messageType: number, sender?: { type?: string }): 'contact' | 'agent' | 'bot' | string {
  // message_type: 0 = outgoing (contact), 1 = incoming (agent)
  if (messageType === 0) {
    return 'contact'
  }
  if (messageType === 1) {
    return sender?.type || 'agent'
  }
  if (messageType === 3) {
    return 'bot' // Template messages are typically from bot
  }
  return sender?.type || 'agent'
}

/**
 * Converts API message to internal Message format
 */
export function mapApiMessageToMessage(apiMessage: ApiMessage): Message {
  const senderType = mapSenderType(apiMessage.message_type, apiMessage.sender)

  // Convert created_at timestamp to ISO string
  const sentAt = new Date(apiMessage.created_at * 1000).toISOString()

  // Get sender info
  const senderName = apiMessage.sender?.name
  // Construct avatar URL from thumbnail or avatar_url_hash
  let senderAvatar: string | undefined
  if (apiMessage.sender?.thumbnail) {
    senderAvatar = apiMessage.sender.thumbnail
  } else if (apiMessage.sender?.additional_attributes?.avatar_url_hash) {
    senderAvatar = `https://pair-storage.fra1.cdn.digitaloceanspaces.com/pair-storage/${apiMessage.sender.additional_attributes.avatar_url_hash}`
  }

  // Convert id to ulid (using string conversion for now, assuming API might provide ulid later)
  const ulid = apiMessage.id.toString()

  // Map content_type to message_type
  const messageType =
    apiMessage.content_type === 'widget_message'
      ? 'widget_message'
      : apiMessage.content_type === 'text'
        ? 'text'
        : apiMessage.content_type === 'image'
          ? 'image'
          : apiMessage.content_type === 'file'
            ? 'file'
            : apiMessage.content_type === 'audio'
              ? 'audio'
              : apiMessage.content_type === 'video'
                ? 'video'
                : apiMessage.content_type === 'input_csat'
                  ? 'interactive'
                  : 'text'

  const interactiveMetadata = apiMessage.content_attributes?.interactive_metadata as InteractiveMetadata | undefined

  const nextMessages =
    apiMessage.next_messages ||
    (apiMessage.content_attributes?.next_messages as NextMessageItem[] | undefined) ||
    interactiveMetadata?.next_messages

  const nextMsgType = apiMessage.next_msg_type || (apiMessage.content_attributes?.next_msg_type as string | undefined)

  const nextMsg = apiMessage.next_msg || (apiMessage.content_attributes?.next_msg as NextMessageItem | undefined)

  const message: Message = {
    ulid,
    type: 'message',
    content: apiMessage.content,
    message_type: messageType,
    sender_type: senderType,
    sent_at: sentAt,
    status: 'sent', // API messages are always sent
    sender_name: senderName,
    sender_avatar: senderAvatar,
    metadata: apiMessage.content_attributes,
    interactive_metadata: interactiveMetadata,
    is_csat_survey: !!apiMessage.content_attributes?.csat_survey_data,
    next_messages: nextMessages,
    next_msg_type: nextMsgType,
    next_msg: nextMsg,
    ai_feedback: apiMessage.ai_feedback,
  }

  logger.debug('mapApiMessageToMessage', 'Mapped API message to internal format', {
    apiId: apiMessage.id,
    ulid,
    senderType,
    messageType,
  })

  return message
}

/**
 * Converts API messages list response to internal format
 */
export function mapApiMessagesResponse(apiResponse: {
  payload: ApiMessage[]
  meta?: {
    contact_last_seen_at?: number
    [key: string]: unknown
  }
}): { data: Message[]; has_more: boolean; next_cursor?: string; meta?: typeof apiResponse.meta } {
  const messages = apiResponse.payload.map(mapApiMessageToMessage)

  return {
    data: messages,
    has_more: false, // API doesn't provide this, would need to check if payload length equals limit
    meta: apiResponse.meta,
  }
}
