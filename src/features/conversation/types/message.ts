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
    next_messages?: NextMessageItem[]
    next_msg_type?: string
    next_msg?: NextMessageItem
    [key: string]: unknown
  }
  created_at: number // Unix timestamp
  conversation_id: number
  sender?: ApiMessageSender
  next_messages?: NextMessageItem[]
  next_msg_type?: string
  next_msg?: NextMessageItem
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

export interface ProductCardButton {
  type: 'button' | string
  label: string
  action_name: 'add_to_cart' | string
  action_ulid: string
  parameters: {
    product_id: string
    quantity: number
    [key: string]: unknown
  }
}

export interface ProductCard {
  image_url?: string
  title: string
  sub_text?: string
  old_price?: string
  current_price: string
  tag?: string
  buttons?: ProductCardButton[]
}

export interface ProductCardSetHeader {
  title: string
  action_text?: string
  action_underline?: boolean
  click_action_name?: string
}

export interface Pagination {
  page_size: number
  current_page: number
}

export interface SortOption {
  key: string
  label: string
}

export interface FilterOption {
  key: string
  type: 'enum' | string
  label: string
  values: string[]
}

export interface ProductCardSetViewAll {
  pagination?: Pagination
  sort_options?: SortOption[]
  filter_options?: FilterOption[]
  base_parameters?: Record<string, unknown>
  source_action_name?: string
}

export interface ProductCardSet {
  type: 'product_card_set'
  header?: ProductCardSetHeader
  cards: ProductCard[]
  view_all?: ProductCardSetViewAll
}

export interface QuestionMessage {
  type: 'question'
  question: string
  input_type: 'single' | 'multi' | string
  options: string[]
}

export interface SuggestionAction {
  type: 'action'
  label: string
  action_name: string
  parameters?: Record<string, unknown>
}

export type SuggestionOption = string | SuggestionAction

export interface SuggestionsMessage {
  type: 'suggestions'
  text?: string
  options: SuggestionOption[]
}

export type NextMessageItem = ProductCardSet | QuestionMessage | SuggestionsMessage | Record<string, unknown>

export interface InteractiveMetadata {
  body_text?: string
  header_text?: string
  footer_text?: string
  csat_config?: CsatConfig
  list_config?: ListConfig
  interactive_type?: 'list' | string
  next_messages?: NextMessageItem[]
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
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'interactive' | 'widget_message'
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
  next_messages?: NextMessageItem[]
  next_msg_type?: string
  next_msg?: NextMessageItem
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
