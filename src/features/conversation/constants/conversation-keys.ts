// Query keys for conversations
export const CONVERSATION_QUERY_KEYS = {
  ALL: ['conversations'] as const,
  CONVERSATIONS: () => [...CONVERSATION_QUERY_KEYS.ALL, 'list'] as const,
  CONVERSATION: (widgetId: string, params?: { status?: string; page?: number; limit?: number }) =>
    [...CONVERSATION_QUERY_KEYS.CONVERSATIONS(), widgetId, params] as const,
  MESSAGES: (widgetId: string, conversationId: string, params?: { before?: string; limit?: number }) =>
    ['conversations', widgetId, conversationId, 'messages', params] as const,
} as const

// Export alias for consistency with naming
export const conversationKeys = CONVERSATION_QUERY_KEYS
