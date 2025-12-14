export interface SendMessageRequest {
  conversation_id?: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video'
  media_url?: string
  metadata?: Record<string, unknown>
}
