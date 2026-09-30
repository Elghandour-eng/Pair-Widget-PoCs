import type { Conversation } from '@/features/conversation/types/conversation'

/**
 * Generates a private channel name for a conversation
 * @param conversationId - The conversation ULID
 * @returns The private channel name (e.g., "private-conversation-01ARZ3NDEKTSV4RRFFQ69G5FAV")
 */
export function getPrivateConversationChannelName(conversationId: Conversation['ulid']): string {
  return `private-conversation-${conversationId}`
}

/**
 * Extracts conversation ID from a private channel name
 * @param channelName - The channel name (e.g., "private-conversation-01ARZ3NDEKTSV4RRFFQ69G5FAV")
 * @returns The conversation ID or null if invalid format
 */
export function extractConversationIdFromChannelName(channelName: string): Conversation['ulid'] | null {
  const prefix = 'private-conversation-'
  if (!channelName.startsWith(prefix)) {
    return null
  }
  return channelName.slice(prefix.length)
}
