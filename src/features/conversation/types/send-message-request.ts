export interface SendMessageRequest {
  conversation_id?: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video'
  media_url?: string
  metadata?: Record<string, unknown>
  visitor_credential?: string
  headers?: Record<string, string>
  query_params?: Record<string, unknown>
}
