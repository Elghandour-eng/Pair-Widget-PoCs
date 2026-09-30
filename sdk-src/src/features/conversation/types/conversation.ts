export interface Conversation {
  ulid: string
  status: 'open' | 'closed' | 'pending'
  subject: string
  created_at: string
  last_message_at: string
  last_message_preview: string
  unread_count: number
}

export interface ConversationsListResponse {
  data: Conversation[]
  meta: {
    page: number
    limit: number
    total: number
  }
}
