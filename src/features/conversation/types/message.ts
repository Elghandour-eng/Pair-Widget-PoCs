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
  ai_feedback?: 'liked' | 'disliked' | null
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
  action_ulid: string
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
  ai_feedback?: 'liked' | 'disliked' | null
  widget_template?: WidgetTemplate
}

export interface ProductComparisonTemplate {
  type: 'product_comparison'
  content: {
    intro_text?: string
    title: string
    icon?: { url: string }
    products: Array<{
      id: string
      name: string
      image?: { url: string }
      subtitle?: string
      prompt?: string
    }>
    rows: Array<{
      key: string
      label: string
      value_type?: 'text' | 'price' | 'number' | 'percentage' | 'boolean' | 'rating' | 'availability' | 'badge' | 'list'
      values: Record<string, unknown>
    }>
    usage_guidance?: {
      title: string
      items: Array<{ title: string; usage: string }>
    }
    recommendation?: {
      icon?: string
      title?: string
      text: string
      recommended_product_id?: string
    }
    actions?: Array<{
      type: 'add_product'
      label?: string
      payload?: Record<string, unknown>
    }>
  }
  config: {
    comparison?: {
      max_visible_rows?: number
      enable_expand_collapse?: boolean
      see_more_label?: string
      see_less_label?: string
      missing_value_fallback?: string
    }
    actions?: { enabled?: boolean; allowed_actions?: string[] }
  }
}

export interface ProductCollectionSuggestionsTemplate {
  type: 'product_collection_suggestions'
  content: {
    collection: {
      id?: string
      title: string
      icon?: string
      subtitle?: string
      items_count?: number
      description?: string
      savings_banner?: {
        show?: boolean
        icon?: string
        title: string
        description?: string
        coupon_code?: string
      }
      products: Array<{
        id: string
        image: { url: string }
        name: string
        price: { value?: number; currency?: string; formatted?: string }
        brand?: string
        specs?: string
        note?: string
        availability?: string
        quantity?: number
        old_price?: { value?: number; currency?: string; formatted?: string }
        price_display?: { type?: string; label?: string; old_label?: string }
      }>
      summary_rows?: Array<{
        id?: string
        label: string
        value: { formatted: string; value?: number; currency?: string }
        type?: string
      }>
      collection_total?: {
        label?: string
        value: number
        currency?: string
        formatted?: string
      }
      actions?: Array<{
        type: 'add_collection_to_cart'
        label?: string
        icon?: string
        payload?: {
          products?: Array<{ product_id: string; quantity?: number }>
          source_template_type?: string
        }
      }>
    }
  }
  config: {
    layout?: { variant?: 'default' | 'order_summary'; card_layout?: string }
    savings_banner?: Record<string, unknown>
    summary_rows?: Record<string, unknown>
    item_actions?: { enabled?: boolean; allowed_actions?: string[]; display?: string }
    [key: string]: unknown
  }
}

export interface ErrorCardTemplate {
  type: 'error_card'
  content: {
    title: string
    message: string
    icon?: { url: string }
    missing?: Array<{ ref: string; reason?: string }>
    actions?: Array<{
      type: string
      label?: string
      payload?: Record<string, unknown>
    }>
  }
  config: {
    copy?: { default_title?: string; default_message?: string }
    style?: { icon?: string; variant?: 'error' | 'warning' }
    actions?: { enabled?: boolean; allowed_actions?: string[] }
  }
}

export interface InformativeTemplateData {
  type: 'informative'
  content: {
    intro_text?: string
    header: {
      id?: string
      title: string
      action?: { type: string; label?: string; payload?: Record<string, unknown> }
      items: Array<{
        id?: string
        icon?: string | null
        title: string
        description?: string
        description_type?: 'list'
        description_items?: string[]
      }>
    }
    closing_text?: string
  }
  config: {
    intro?: Record<string, unknown>
    informative_card?: Record<string, unknown>
    informative_header?: Record<string, unknown>
    informative_items?: Record<string, unknown>
    closing_text?: Record<string, unknown>
    actions?: Record<string, unknown>
    fallbacks?: Record<string, unknown>
  }
}

export interface OrderStatusTemplate {
  type: 'order_status'
  content: {
    intro_text?: string
    closing_text?: string
    order: {
      id?: string
      order_number?: string
      status: { label: string; value?: string }
      refund_status?: { label: string; value?: string }
      summary?: {
        placed_on?: string
        items_count?: number
        total_amount?: { value?: number; currency?: string; formatted?: string }
      }
      timeline?: {
        current_step_id?: string
        items: Array<{
          id: string
          label: string
          status: 'completed' | 'active' | 'pending'
          date?: string | null
          description?: string
        }>
      }
      items?: {
        visible_count?: number
        total_count?: number
        products: Array<{
          id: string
          name: string
          image?: string
          brand?: string
          price?: { value?: number; currency?: string; formatted?: string }
          attributes?: Array<{ label: string; value: string }>
        }>
      }
      actions?: Array<{
        type: string
        label?: string
        payload?: Record<string, unknown>
      }>
    }
  }
  config: {
    visibility?: Record<string, boolean>
    layout?: Record<string, unknown>
    labels?: Record<string, string>
    style?: Record<string, unknown>
    behavior?: Record<string, unknown>
    states?: Record<string, unknown>
  }
}

export interface WishlistProductsTemplate {
  type: 'wishlist_products'
  content: {
    intro_text?: string
    closing_text?: string
    wishlist: {
      id?: string
      title?: string
      items_count?: number
      visible_count?: number
      products: Array<{
        id: string
        name: string
        image?: string
        brand?: string
        subtitle?: string
        price?: { value?: number; currency?: string; formatted?: string }
        status_badge?: { label: string; value: string } | null
        availability?: string
        payload?: Record<string, unknown>
      }>
      actions?: Array<{
        type: 'view_all_wishlist'
        label?: string
        payload?: Record<string, unknown>
      }>
    }
  }
  config: {
    layout?: Record<string, unknown>
    labels?: Record<string, string>
    style?: Record<string, unknown>
    behavior?: Record<string, unknown>
    states?: Record<string, unknown>
  }
}

export interface CarouselTemplate {
  type: 'carousel'
  carousel_type: 'offers'
  content: {
    title?: string
    intro_text?: string
    closing_text?: string
    items: Array<{
      id?: string
      code: string
      title: string
      description?: string
      actions?: Array<{
        type: 'copy_code' | 'view_details' | 'view_eligible_products'
        label?: string
        payload?: Record<string, unknown>
      }>
    }>
  }
  config: {
    layout?: { visible_items?: number; scroll_type?: string; show_pagination_dots?: boolean }
    visibility?: Record<string, boolean>
    style?: Record<string, unknown>
  }
}

export type WidgetTemplate =
  | ProductComparisonTemplate
  | ProductCollectionSuggestionsTemplate
  | ErrorCardTemplate
  | InformativeTemplateData
  | OrderStatusTemplate
  | WishlistProductsTemplate
  | CarouselTemplate

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
