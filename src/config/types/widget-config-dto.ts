import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Pre-chat form
// ─────────────────────────────────────────────────────────────────────────────

export type PreChatFieldType = 'standard'
export type PreChatInputType = 'email' | 'text'

export interface PreChatField {
  name: string
  type: PreChatInputType
  label: string
  order: number
  enabled: boolean
  required: boolean
  field_type: PreChatFieldType
}

export interface PreChatFormOptions {
  pre_chat_fields: PreChatField[]
  pre_chat_message: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Working hours
// ─────────────────────────────────────────────────────────────────────────────

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface WorkingHoursScheduleEntry {
  day: DayOfWeek
  enabled: boolean
  startTime: string // e.g. "12:00 AM"
  endTime: string // e.g. "11:59 PM"
}

export interface WorkingHours {
  enabled: boolean
  schedule: WorkingHoursScheduleEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config — header
// ─────────────────────────────────────────────────────────────────────────────

export interface HeaderBackground {
  enabled: boolean
  color: string
}

export interface HeaderContent {
  title: string
  subtitle: string
}

export interface HeaderActions {
  cart: boolean
  favorites: boolean
}

export interface HeaderDto {
  enabled: boolean
  iconId?: string
  icon?: string | null
  iconStyle?: CSSProperties & {
    shape?: 'circle' | 'square' | string
    borderRadius?: string
    backgroundColor?: string
  }
  background: HeaderBackground
  content: HeaderContent
  titleStyle: CSSProperties
  subtitleStyle: CSSProperties
  actions: HeaderActions
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config — intro_screen
// ─────────────────────────────────────────────────────────────────────────────

export type HeroImagePosition = 'top' | 'bottom'
export type LoadingStateType = 'shimmer' | 'spinner'

export interface HeroImage {
  url?: string | null
  styles?: CSSProperties
  position?: HeroImagePosition
  media_ulid?: string
}

export interface HeroSection {
  enabled: {
    value: boolean
    styles: CSSProperties
  }
  heroImage: HeroImage
}

export interface LoadingState {
  type: LoadingStateType
  styles: CSSProperties
}

export interface WelcomeTitle {
  text: string
  styles: CSSProperties
}

export interface WelcomeSubtitle {
  text: string
  styles: CSSProperties
}

export interface WidgetBackground {
  type: 'color' | 'gradient'
  background: string
}

export interface ShowIntroScreen {
  value: boolean
  styles?: CSSProperties
}

export interface IntroScreen {
  heroSection: HeroSection
  loadingState: LoadingState
  welcomeTitle: WelcomeTitle
  welcomeSubtitle: WelcomeSubtitle
  showIntroScreen: ShowIntroScreen
  widgetBackground?: WidgetBackground
  introTitle?: {
    text: string
    styles?: CSSProperties
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config — quick_links
// ─────────────────────────────────────────────────────────────────────────────

export type QuickLinkPosition = 'under_welcome' | 'above_welcome'

export interface QuickLinkDisplaySettings {
  position: QuickLinkPosition
  carouselLoop: boolean
}

export interface QuickLinkCard {
  id: string
  url?: string
  title: string
  active: boolean
  subtitle: string
  media_ulid: string
  order?: number
}

export interface QuickLinks {
  cardStyle: CSSProperties
  textStyle: CSSProperties
  quickLinkCards: QuickLinkCard[]
  showQuickLinks: { value: boolean }
  displaySettings: QuickLinkDisplaySettings
  showTitle?: boolean
  showSubtitle?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config — trending_prompts
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptChip {
  text: string
  iconId?: string
  iconUrl?: string
}

export interface TrendingPromptDisplaySettings {
  styles?: CSSProperties
  showIcons: boolean
  sectionTitle: string
  layout?: 'card' | 'chip'
  // TODO: update this when BE supports it
  showTitle?: boolean
  carouselLoop?: boolean
}

export interface TrendingPrompts {
  chipStyle: CSSProperties
  textStyle: CSSProperties
  promptChips: PromptChip[]
  displaySettings: TrendingPromptDisplaySettings
  showTrendingPrompts: { value: boolean }
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config — chat_input
// ─────────────────────────────────────────────────────────────────────────────

export type InputLayoutType = 'floating_pill' | 'full_width_bar'

export interface InputActions {
  stickers: boolean
  fileUpload: boolean
  voiceMessages: boolean
  attachmentMenu: boolean
}

export interface PlaceholderText {
  text: string
  styles: CSSProperties
}

export interface SendButtonIconDto {
  variant: 'arrow-up' | 'send'
  styles?: CSSProperties & {
    iconColor?: string
  }
}

export interface ChatInput {
  styles: CSSProperties
  inputLayout: { type: InputLayoutType }
  inputActions: InputActions
  placeholderText: PlaceholderText
  // TODO: update this when BE supports it
  sendButtonIcon?: SendButtonIconDto
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config — messages
// ─────────────────────────────────────────────────────────────────────────────

export type IconColorType = 'widget' | string
export type MessageStyle = 'plain' | 'card'
export type BubbleType = 'filled' | 'outline'

// TODO: check it with the BE and FE Builder
export interface FeedbackStyle {
  iconSize: string
  iconColor: string | null
}

export interface Feedback {
  style: FeedbackStyle
  toastMessage: string
  iconColorType: IconColorType
  showFeedbackButtons: boolean
}

export interface AiMessages {
  iconId: string
  CardStyles: CSSProperties
  TextStyles: CSSProperties
  showAiIcon: boolean
  messageStyle: MessageStyle
  // TODO: update this when BE supports it
  iconUrl?: string
}

export interface CustomerMessages {
  TextStyles: CSSProperties
  bubbleType: BubbleType
  bubbleStyle: CSSProperties
  useBrandColor: boolean
}

export interface Messages {
  feedback: Feedback
  aiMessages: AiMessages
  customerMessages: CustomerMessages
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config (root)
// ─────────────────────────────────────────────────────────────────────────────

export interface WidgetV2Config {
  header?: HeaderDto
  intro_screen: IntroScreen
  introTitle?: {
    text: string
    styles?: CSSProperties
  }
  quick_links: QuickLinks
  trending_prompts: TrendingPrompts
  chat_input: ChatInput
  messages: Messages
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level widget DTO
// ─────────────────────────────────────────────────────────────────────────────

export type FeatureFlag = 'attachments' | 'emoji_picker' | 'end_conversation' | 'use_inbox_avatar_for_bot'

export type ReplyTime = 'in_a_few_minutes' | 'in_a_few_hours' | 'in_a_day'

export type SenderNameType = 'friendly' | string

export interface WidgetConfigDto {
  widget_id: string
  name: string
  widget_color: string
  welcome_title: string
  welcome_tagline: string
  reply_time: ReplyTime
  avatar_url: string

  pre_chat_form_enabled: boolean
  pre_chat_form_options: PreChatFormOptions

  selected_feature_flags: FeatureFlag[]

  enable_greeting: boolean
  greeting_message_en: string | null
  greeting_message_ar: string | null

  locale: string
  website_url: string
  business_name: string | null
  sender_name_type: SenderNameType

  allow_messages_after_resolved: boolean
  lock_to_single_conversation: boolean
  enable_email_collect: boolean
  continuity_via_email: boolean
  csat_survey_enabled: boolean

  /** Optional — only present when working hours are configured */
  working_hours?: WorkingHours

  widget_v2_config: WidgetV2Config

  visitor_credentials: unknown[]
  widget_header?: boolean
  opening_method?: 'automatically_open' | 'chat_icon'
  launcher_style?: 'expanded_bubble' | 'chat_icon' | 'standard' | 'icon_only'
  launcher_position?: 'left' | 'right'
  styles?: CSSProperties
  launcher_styles?: CSSProperties
  powered_by_pair_ai?: boolean
  launcher_title?: string
}
