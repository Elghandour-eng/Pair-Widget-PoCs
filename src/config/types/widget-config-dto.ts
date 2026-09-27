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

/** A carousel slide: an uploaded image, or a design the studio draws itself. */
export interface HeroSlide {
  type?: 'image' | 'design'
  url?: string | null
  /** Opaque here: a design is rendered upstream and reaches the widget as `url`. */
  design?: unknown
}

export interface HeroDotsConfig {
  show?: boolean
  shape?: 'pill' | 'dot' | 'bar'
  size?: number
  activeWidth?: number
  gap?: number
  /** A hex value, or `#brand` to follow the widget colour. */
  activeColor?: string
  inactiveColor?: string
  inactiveOpacity?: number
  position?: 'below' | 'overlay'
}

export interface HeroCarouselConfig {
  autoplay?: boolean
  intervalMs?: number
  transition?: 'fade' | 'slide'
  dots?: HeroDotsConfig
}

export interface HeroSection {
  enabled: {
    value: boolean
    styles: CSSProperties
  }
  heroImage: HeroImage
  /** The full slide list. `heroImage` stays as the single-image fallback. */
  heroImages?: HeroSlide[]
  carousel?: HeroCarouselConfig
}

export interface LoadingState {
  design?: LoadingDesignDto
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
  showTitle?: boolean
  showSubtitle?: boolean
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
  design?: QuickLinksDesignDto
  subtitleStyle?: CSSProperties
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
  icon?: string
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

/** The studio's compiled quick-link design; the card surface arrives in `cardStyle`. */
export interface QuickLinksDesignDto {
  layout?: 'carousel' | 'grid' | 'stack'
  autoScroll?: boolean
  intervalMs?: number
  loop?: boolean
  gap?: number
  cardWidth?: number
  showImage?: boolean
  imageHeight?: number
  imageFit?: 'cover' | 'contain'
  imageRadius?: number
}

/** The studio's compiled prompt-chip design; the surface arrives in `chipStyle`. */
export interface PromptsDesignDto {
  iconSize?: number
  iconColor?: string
}

export interface TrendingPrompts {
  design?: PromptsDesignDto
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

/**
 * The studio's compiled chat-input design. Most of it also arrives as the CSS
 * blobs above; this block carries the parts that are not reachable by CSS on a
 * container — the typed text, the action buttons, and the padding around them.
 */
export interface ChatInputDesignDto {
  layout?: 'floating_pill' | 'full_width_bar' | 'inset_card'
  direction?: 'auto' | 'ltr' | 'rtl'
  field?: {
    gap?: number
    focusBorderColor?: string
    focusRingWidth?: number
    focusRingColor?: string
    focusRingOpacity?: number
  }
  text?: { fontFamily?: string; size?: number; weight?: string; color?: string; lineHeight?: number }
  send?: {
    size?: number
    iconSize?: number
    disabledOpacity?: number
    hoverBackground?: string
    position?: 'inside' | 'outside'
  }
  actions?: {
    voice?: boolean
    attach?: boolean
    emoji?: boolean
    voiceIcon?: string
    voiceUrl?: string
    attachIcon?: string
    attachUrl?: string
    emojiIcon?: string
    emojiUrl?: string
    size?: number
    shape?: 'circle' | 'rounded' | 'square'
    radius?: number
    background?: string
    iconColor?: string
    iconSize?: number
    hoverBackground?: string
    gap?: number
  }
  container?: { background?: string; paddingX?: number; paddingTop?: number; paddingBottom?: number }
}

/** The studio's compiled loading placeholder; colours and speed arrive as custom properties. */
export interface LoadingDesignDto {
  type?: 'shimmer' | 'spinner' | 'dots' | 'pulse'
  lines?: number
  lineHeight?: number
  cards?: number
  cardHeight?: number
  spinnerColor?: string
  spinnerSize?: number
  spinnerThickness?: number
  labelShow?: boolean
  labelText?: string
  labelColor?: string
  labelSize?: number
}

/** The studio's compiled toast, including the style to put on each toast. */
export interface ToastDesignDto {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  offset?: number
  durationMs?: number
  showIcon?: boolean
  iconColor?: string
  fullWidth?: boolean
  styles?: CSSProperties
}

/** The studio's compiled launcher design; the rest arrives in `launcher_styles`. */
export interface LauncherDesignDto {
  size?: number
  radius?: number
  offsetX?: number
  offsetY?: number
  icon?: string
  iconUrl?: string
  iconSize?: number
  iconColor?: string
  label?: { show?: boolean; text?: string; color?: string; fontFamily?: string; size?: number; weight?: string }
  entrance?: 'pop' | 'slide' | 'fade' | 'none'
  attention?: 'none' | 'pulse' | 'bounce' | 'wiggle'
  hoverScale?: number
}

export interface ChatInput {
  styles: CSSProperties
  inputLayout: { type: InputLayoutType }
  inputActions: InputActions
  placeholderText: PlaceholderText
  // TODO: update this when BE supports it
  sendButtonIcon?: SendButtonIconDto
  design?: ChatInputDesignDto
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
  headers?: Record<string, string>
  params?: Record<string, string>
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
  launcher_design?: LauncherDesignDto
  toast_design?: ToastDesignDto
}
