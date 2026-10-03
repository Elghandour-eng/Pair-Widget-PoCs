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

/**
 * The studio's compiled pre-chat design: every part of the contact form — the
 * intro message, labels, inputs, message box and submit button — plus the
 * texts the form shows. Arrives normalized (all keys present).
 */
export interface PreChatDesignDto {
  buttonText?: string
  showMessage?: boolean
  messageLabel?: string
  messagePlaceholder?: string
  message?: { color?: string; size?: number; weight?: string; align?: string }
  labels?: { show?: boolean; color?: string; size?: number; weight?: string; requiredColor?: string }
  field?: {
    background?: string
    borderWidth?: number
    borderColor?: string
    borderStyle?: string
    radius?: number
    height?: number
    textColor?: string
    textSize?: number
    placeholderColor?: string
    gap?: number
    focusBorderColor?: string
    focusRingWidth?: number
    focusRingColor?: string
    focusRingOpacity?: number
  }
  button?: {
    background?: string
    textColor?: string
    radius?: number
    height?: number
    textSize?: number
    weight?: string
    fullWidth?: boolean
    shadow?: { size?: number; y?: number; blur?: number; color?: string; opacity?: number }
    hoverBackground?: string
  }
  card?: {
    enabled?: boolean
    background?: string
    borderWidth?: number
    borderColor?: string
    radius?: number
    padding?: number
    shadow?: { size?: number; y?: number; blur?: number; color?: string; opacity?: number }
  }
  /** A brand banner image at the top of the form. */
  banner?: { show?: boolean; url?: string; height?: number; fit?: string; radius?: number }
  /** A repeating brand pattern behind the form. */
  backdrop?: { url?: string; opacity?: number; size?: number }
}

export interface PreChatFormOptions {
  pre_chat_fields: PreChatField[]
  pre_chat_message: string
  design?: PreChatDesignDto
}

// ─────────────────────────────────────────────────────────────────────────────
// Consent screen (welcome gate)
// ─────────────────────────────────────────────────────────────────────────────

/** One "thing to keep in mind" row on the consent sheet. */
export interface ConsentPointDto {
  icon?: string
  text: string
}

/** One footnote link (terms / privacy). Only http(s) URLs are served. */
export interface ConsentLinkDto {
  show?: boolean
  label?: string
  url?: string
}

/** The welcome / consent sheet shown over the widget until it is accepted. */
export interface ConsentScreenDto {
  enabled?: boolean
  title?: string
  subtitle?: string
  points?: ConsentPointDto[]
  footnote?: string
  buttonText?: string
  links?: { color?: string; underline?: boolean; terms?: ConsentLinkDto; privacy?: ConsentLinkDto }
  design?: {
    showIllustration?: boolean
    overlayColor?: string
    overlayOpacity?: number
    card?: {
      background?: string
      radius?: number
      padding?: number
      shadow?: { size?: number; y?: number; blur?: number; color?: string; opacity?: number }
    }
    title?: { color?: string; size?: number; weight?: string }
    subtitle?: { color?: string; size?: number; weight?: string }
    points?: { textColor?: string; textSize?: number; iconColor?: string; iconSize?: number; gap?: number }
    footnote?: { color?: string; size?: number }
    button?: {
      background?: string
      textColor?: string
      radius?: number
      height?: number
      textSize?: number
      weight?: string
      fullWidth?: boolean
    }
  }
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

/** One header control: whether it shows, and the glyph (or upload) it wears. */
export interface HeaderControlDto {
  show?: boolean
  icon?: string
  iconUrl?: string
}

/** The studio's header controls: a language switch, a theme switch and the close button. */
export interface HeaderControlsDto {
  lang?: HeaderControlDto
  theme?: HeaderControlDto
  close?: Pick<HeaderControlDto, 'show'>
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
  controls?: HeaderControlsDto
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
  /** The heading over the cards, as the studio words it. */
  sectionTitle?: string
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
  /** The default glyph in front of every chip; a chip's own `icon` wins. */
  icon?: string
  /** The upload behind `icon: 'custom'`. */
  iconUrl?: string
  iconPosition?: 'start' | 'end'
  layout?: 'wrap' | 'stack' | 'scroll'
  gap?: number
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
  stickers?: boolean
  fileUpload?: boolean
  voiceMessages?: boolean
  attachmentMenu?: boolean
  /** The studio writes the emoji toggle under this name. */
  showEmojiPicker?: boolean
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
  /** The line above the launcher; the SDK draws it from `styles`, compiled by the studio. */
  message?: {
    show?: boolean
    text?: string
    gap?: number
    tail?: boolean
    dismissible?: boolean
    delayMs?: number
    styles?: CSSProperties
  }
  /** The panel the widget opens into; the SDK sizes its holder from this. */
  panel?: { width?: number; height?: number; maxHeight?: number; minHeight?: number; bottom?: number; radius?: number }
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
  /** false: an AI-bot channel skips the waiting shimmer (replies stream in). */
  showShimmer?: boolean
  messageStyle: MessageStyle
  // TODO: update this when BE supports it
  iconUrl?: string
}

/** The "loading older messages" pill shown while a previous page is fetched. */
export interface LoadingOlder {
  text?: string
  textColor?: string
  background?: string
  spinnerColor?: string
}

export interface CustomerMessages {
  TextStyles: CSSProperties
  bubbleType: BubbleType
  bubbleStyle: CSSProperties
  useBrandColor: boolean
}

/** Studio design for the next-message suggestion chips. */
export interface SuggestionChipsDto {
  align?: 'start' | 'center' | 'end'
  background?: string
  textColor?: string
  borderColor?: string
  radius?: number
  fontSize?: number
}

/** Studio design for the interactive question card. */
export interface QuestionCardDto {
  background?: string
  borderColor?: string
  textColor?: string
  /** Selected options, radio dots and check marks. */
  accentColor?: string
  radius?: number
}

export interface Messages {
  loadingOlder?: LoadingOlder
  feedback: Feedback
  aiMessages: AiMessages
  customerMessages: CustomerMessages
  suggestions?: SuggestionChipsDto
  questions?: QuestionCardDto
}

// ─────────────────────────────────────────────────────────────────────────────
// widget_v2_config (root)
// ─────────────────────────────────────────────────────────────────────────────

/** The studio's CSAT rating section: text overrides plus the compiled design. */
export interface CsatSectionDto {
  header?: string
  body?: string
  buttonText?: string
  submitText?: string
  design?: Record<string, any>
}

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
  consent_screen?: ConsentScreenDto
  /** The studio's editable pre-chat block; served flattened onto the top-level fields. */
  pre_chat_form?: unknown
  csat?: CsatSectionDto
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
  launcher_style?: 'expanded_bubble' | 'chat_icon' | 'standard' | 'icon_only' | 'none'
  launcher_position?: 'left' | 'right'
  styles?: CSSProperties
  launcher_styles?: CSSProperties
  powered_by_pair_ai?: boolean
  launcher_title?: string
  launcher_design?: LauncherDesignDto
  toast_design?: ToastDesignDto
}
