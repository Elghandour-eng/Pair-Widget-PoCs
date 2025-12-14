export interface PreChatResponse {
  token: string
  contact_id: string
  requires_pre_chat: boolean
  pre_chat_form?: {
    message: string
    fields: string[]
  }
}
