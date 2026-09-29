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

export interface CsatOption {
  text: string
  weight: number
}

export interface CsatConfig {
  message: string
  button_text: string
  display_type: 'emoji' | 'star' | 'text_options' | string
  closing_message: string
  options?: CsatOption[]
  multi_select?: boolean
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
  id?: string
  action_ulid?: string
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
  label?: string
  text?: string
  title?: string
  action_title?: string
  action_name?: string
  id?: string
  action_ulid?: string
  imageUrl?: string
  image_url?: string
  iconUrl?: string
  icon_url?: string
  parameters?: Record<string, unknown>
  payload?: Record<string, unknown>
}

export type SuggestionOption = string | SuggestionAction

export interface SuggestionsMessage {
  type: 'suggestions'
  text?: string
  options: SuggestionOption[]
}

export type NextMessageItem =
  | ProductCardSet
  | QuestionMessage
  | SuggestionsMessage
  | SuggestionAction
  | Record<string, unknown>

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
  suggestions?: SuggestionOption[] | SuggestionsMessage
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
      note?: string
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
      id?: string
      action_ulid?: string
      type: 'add_product' | string
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
      icon?: string | { url: string }
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
        id?: string
        action_ulid?: string
        type: 'add_collection_to_cart' | string
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
      id?: string
      action_ulid?: string
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
      action?: { id?: string; action_ulid?: string; type: string; label?: string; payload?: Record<string, unknown> }
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
        id?: string
        action_ulid?: string
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
        id?: string
        action_ulid?: string
        type: 'view_all_wishlist' | string
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

export interface OffersCarouselTemplate {
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
        id?: string
        action_ulid?: string
        type: 'copy_code' | 'view_details' | 'view_eligible_products' | string
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

export interface ProductCarouselItemAction {
  id?: string
  action_ulid?: string
  type: 'add_to_cart' | string
  label?: string
  payload?: {
    product_id?: string
    [key: string]: unknown
  }
}

export interface ProductCarouselItem {
  id: string
  name: string
  brand?: string
  image?: string
  price: {
    old?: number
    current: number
    currency: string
  }
  actions?: ProductCarouselItemAction[]
  discount?: {
    label: string
    percentage: number
  }
  availability?: 'in_stock' | 'out_of_stock' | string
}

export interface ProductsCarouselTemplate {
  type: 'carousel'
  carousel_type: 'products'
  content: {
    header?: {
      icon?: string
      title?: string
      view_all?: {
        label?: string
        visible?: boolean
      }
    }
    products: ProductCarouselItem[]
    intro_text?: string
    description_text?: string
    closing_text?: string
  }
  config?: {
    style?: {
      text_styles?: Record<
        string,
        {
          color?: string
          font_size?: number
          font_family?: string
          font_weight?: number | string
          line_height?: number | string
          text_transform?: string
        }
      >
      [key: string]: unknown
    }
    layout?: {
      scroll_type?: string
      visible_items?: number
      show_pagination_dots?: boolean
    }
    carousel?: {
      scrollable?: boolean
      visible_items?: number
    }
    visibility?: {
      show_code?: boolean
      show_title?: boolean
      show_actions?: boolean
      show_copy_code?: boolean
      show_description?: boolean
      [key: string]: boolean | undefined
    }
    product_card?: {
      show_image?: boolean
      show_action?: boolean
      [key: string]: boolean | undefined
    }
    [key: string]: unknown
  }
}

export type CarouselTemplate = OffersCarouselTemplate | ProductsCarouselTemplate

export interface ProductSlotAction {
  id?: string
  action_ulid?: string
  type: 'add_product' | string
  label?: string
  payload?: {
    slot_id?: string
    product_id?: string
    source_template_type?: string
    [key: string]: unknown
  }
}

export interface ProductSlotRecommendedProduct {
  id: string
  name: string
  brand?: string
  image?: string
  price: {
    old?: number
    current: number
    currency: string
  }
  discount?: {
    label: string
    percentage: number
  }
  actions?: ProductSlotAction[]
}

export interface ProductSlotItem {
  id: string
  order?: number
  title: string
  category?: string
  goal?: string
  description?: string
  how_to_use?: string
  when_to_use?: string[]
  recommended_product?: ProductSlotRecommendedProduct
}

export interface ProductSlotsTemplate {
  type: 'product_slots'
  content: {
    slots: ProductSlotItem[]
    intro_text?: string
    description_text?: string
    closing_text?: string
  }
  config?: {
    slot?: {
      show_goal?: boolean
      show_order?: boolean
      show_action?: boolean
      show_category?: boolean
      timing_badges?: {
        enabled?: boolean
        supported_values?: string[]
      }
      show_how_to_use?: boolean
      show_description?: boolean
      show_when_to_use?: boolean
      recommended_product?: {
        label?: string
        show_name?: boolean
        show_brand?: boolean
        show_image?: boolean
        show_label?: boolean
        show_action?: boolean
        show_discount?: boolean
        show_old_price?: boolean
      }
    }
    [key: string]: unknown
  }
}

export interface LocationCardData {
  id?: string
  name?: string
  name_ar?: string
  address?: string
  address_ar?: string
  hours?: string
  distance_km?: number | string
  image?: string
  maps_url?: string
}

export interface LocationCardsTemplate {
  type: 'location_cards'
  content: { cards: LocationCardData[] }
}

export interface PriceListTemplate {
  type: 'price_list'
  content: { title?: string; currency?: string; items: Array<{ label: string; price: string }> }
}

export type WidgetTemplate =
  | ProductComparisonTemplate
  | ProductCollectionSuggestionsTemplate
  | ErrorCardTemplate
  | InformativeTemplateData
  | OrderStatusTemplate
  | WishlistProductsTemplate
  | CarouselTemplate
  | ProductSlotsTemplate
  | LocationCardsTemplate
  | PriceListTemplate

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
