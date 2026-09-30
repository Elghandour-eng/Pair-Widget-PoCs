export interface SendMessageResponse {
  message_id: string
  conversation_id: string
  status: 'sent' // 'pending' | 'failed' NOT SURE ABOUT THIS
  sent_at: string
}
