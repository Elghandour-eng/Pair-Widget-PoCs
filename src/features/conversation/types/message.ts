/**
 * Sender information from API
 */
export interface ApiMessageSender {
  id: number
  name: string
  email: string
  phone_number: string | null
  thumbnail: string
  type: 'contact' | 'agent' | 'bot' | string
  blocked: boolean
  identifier: string | null
  additional_attributes?: {
    city?: string
    country?: string
    country_code?: string
    created_at_ip?: string
    avatar_url_hash?: string
    last_avatar_sync_at?: string
    [key: string]: unknown
  }
  custom_attributes?: Record<string, unknown>
}

/**
 * Raw message structure from API
 */
export interface ApiMessage {
  id: number
  content: string
  message_type: number // 0 = outgoing, 1 = incoming, 2 = activity, 3 = template
  content_type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'input_csat' | string
  content_attributes: {
    in_reply_to?: number | null
    csat_survey_data?: CSATSurveyData
    [key: string]: unknown
  }
  created_at: number // Unix timestamp
  conversation_id: number
  sender?: ApiMessageSender
}

/**
 * API response structure (raw format with numeric IDs)
 * This is used when API returns raw format that needs conversion
 */
export interface ApiMessagesListResponse {
  payload: ApiMessage[]
  meta: {
    contact_last_seen_at?: number
    [key: string]: unknown
  }
}

export interface CSATSurveyData {
  sent_at: string
  language: string
  response_data: unknown
  trigger_event: string
  closing_message: string
  is_ai_generated: boolean
}

export interface CsatConfig {
  message: string
  button_text: string
  display_type: 'emoji' | 'star'
  closing_message: string
}

export interface ListSectionRow {
  id: string
  title: string
  description: string
}

export interface ListSection {
  rows: ListSectionRow[]
  title: string
}

export interface ListConfig {
  sections: ListSection[]
  button_text: string
}

export interface InteractiveMetadata {
  body_text?: string
  header_text?: string
  footer_text?: string
  csat_config?: CsatConfig
  list_config?: ListConfig
  interactive_type?: 'list' | string
  [key: string]: unknown
}

/**
 * Internal message structure (normalized for UI)
 * This matches the actual API response format
 */
export interface Message {
  ulid: string
  type: 'message' | string
  content: string
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'interactive'
  sender_type: 'contact' | 'agent' | 'bot' | 'human_agent' | 'ai_agent' | string
  media_url?: string
  sent_at: string // ISO string
  status: 'sent' | 'pending' | 'failed' | 'delivered' | string
  sender_name?: string
  sender_avatar?: string
  metadata?: {
    csat_survey_data?: CSATSurveyData
    _internal_ticket_id?: string
    source?: string
    file_name?: string
    file_size?: number
    file_type?: string
    media_url?: string
    widget_id?: string
    url?: string
    [key: string]: unknown
  }
  interactive_metadata?: InteractiveMetadata
  is_csat_survey: boolean
}

/**
 * Messages list response (matches actual API response)
 */
export interface MessagesListResponse {
  data: Message[]
  has_more: boolean
  next_cursor?: string
  meta?: {
    contact_last_seen_at?: number
    [key: string]: unknown
  }
}
