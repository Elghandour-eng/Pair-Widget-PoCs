export interface PreChatFormPayload {
  pre_chat_data: {
    [key: string]: string | undefined
  }
  user_id?: string
  user_token?: string
}
