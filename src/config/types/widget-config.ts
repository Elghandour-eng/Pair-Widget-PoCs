import type { CSSProperties } from 'react'

export type FeatureFlag =
  | 'attachments'
  | 'emoji_picker'
  | 'end_conversation'
  | 'use_inbox_avatar_for_bot'
  // TODO: Placeholder Replace with actual values
  | 'voice_messages'

export interface PairAiWidgetSettings {
  position: 'left' | 'right'
  type: 'expanded_bubble' | 'standard'
  launcherTitle?: string
  widgetId?: string
  sdkMode?: boolean // When true, SDK handles bubble button, widget just shows panel
  beBaseUrl?: string
  openAutomatically?: boolean
}

declare global {
  interface Window {
    PairAiWidgetSettings?: PairAiWidgetSettings
  }
}

export interface WidgetConfig {
  name: string
  enabled: boolean
  position: 'left' | 'right'
  type?: string
  launcherTitle?: string
  primaryColor: string
  requiresPreChat: boolean
  welcomeTitle?: string
  welcomeTagline?: string
  greetingEnabled: boolean
  greetingMessage: string
  workingHoursEnabled: boolean
  workingHours: WorkingHour[]
  timezone: string
  preChatFormOptions?: PreChatFormOptions
  selectedFeatureFlags: FeatureFlag[]
  businessName?: string
  avatarUrl?: string
  websiteToken?: string
  baseUrl?: string
  reply_time: 'in_a_few_hours' | 'in_a_few_minutes' | 'in_a_day'
  sdkMode: boolean // When true, SDK handles bubble button
  // TODO: Placeholder Replace with actual values
  introScreen?: IntroScreenConfig
  quickLinks?: QuickLinksConfig
  trendingPrompts?: TrendingPromptsConfig
  textboxStyle?: {
    layout: 'standard' | 'full_width'
    placeholder?: string
  }
  widgetBgColor?: string
  hideMessageTime?: boolean
  hideHeader?: boolean
  hideFooter?: boolean
  chatInput?: ChatInputConfig
  messagesConfig?: MessagesConfig
}

// TODO: Placeholder Replace with actual values
export interface QuickLinksConfig {
  show: {
    value: boolean
  }
  position?: string
  cardStyle: {
    layout: 'column' | 'row'
  }
  cardStyles?: CSSProperties
  textStyle?: CSSProperties
  carouselLoop?: boolean
  links: QuickLinkData[]
}

// TODO: Placeholder Replace with actual values
export interface QuickLinkData {
  id: string | number
  text: string
  image?: string
  displayOrder?: number
  active?: boolean
  subtitle?: string
  media_ulid?: string
}

// TODO: Placeholder Replace with actual values
export interface TrendingPromptsConfig {
  show: {
    value: boolean
  }
  title?: string
  showIcon: {
    value: boolean
  }
  chipStyles?: CSSProperties
  textStyle?: CSSProperties
  prompts: TrendingPromptData[]
}

// TODO: Placeholder Replace with actual values
export interface TrendingPromptData {
  id: string | number
  text: string
  displayOrder?: number
  iconUrl?: string
}

// TODO: Placeholder Replace with actual values
export interface IntroScreenConfig {
  showIntroScreen: {
    value: boolean
    styles: CSSProperties
  }
  welcomeTitle: {
    text: string
    styles: CSSProperties
  }
  welcomeSubtitle: {
    text: string
    styles: CSSProperties
  }
  heroSection: {
    enabled: {
      value: boolean
      styles: CSSProperties
    }
    heroImage: {
      url?: string
      position: string
      styles: CSSProperties
    }
  }
  loadingState: {
    type: string
    styles: CSSProperties
  }
}

// TODO: Placeholder Replace with actual values
export interface QuickLinksConfigV2 {
  showQuickLinks: {
    value: boolean
  }
  displaySettings?: {
    position?: string
    carouselLoop?: boolean
  }
  cardStyle?: CSSProperties & {
    cardShadow?: string
    imageTextGap?: string
  }
  textStyle?: CSSProperties
  quickLinkCards: QuickLinkCardV2[]
}

// TODO: Placeholder Replace with actual values
export interface QuickLinkCardV2 {
  id: string | number
  url?: string
  title: string
  active: boolean
  subtitle?: string
  media_ulid?: string
}

// TODO: Placeholder Replace with actual values
export interface TrendingPromptsConfigV2 {
  showTrendingPrompts: {
    value: boolean
  }
  promptChips: TrendingPromptCardV2[]
  displaySettings?: {
    sectionTitle?: string
    showIcons?: boolean
    styles?: CSSProperties
  }
  chipStyle?: CSSProperties
  textStyle?: CSSProperties
}

// TODO: Placeholder Replace with actual values
export interface TrendingPromptCardV2 {
  id: string | number
  text: string
  displayOrder?: number
  iconUrl?: string
}

// TODO: Placeholder Replace with actual values
export interface ChatInputConfig {
  styles?: CSSProperties
  inputLayout?: {
    type?: string
  }
  inputActions?: {
    stickers?: boolean
    fileUpload?: boolean
    voiceMessages?: boolean
    attachmentMenu?: boolean
  }
  placeholderText?: {
    text?: string
    styles?: CSSProperties
  }
}

// TODO: Placeholder Replace with actual values
export interface MessagesConfig {
  feedback?: {
    style?: CSSProperties & {
      iconSize?: string
      iconColor?: string | null
    }
    toastMessage?: string
    iconColorType?: string
    showFeedbackButtons?: boolean
  }
  aiMessages?: {
    iconId?: string
    CardStyles?: CSSProperties
    TextStyles?: CSSProperties
    showAiIcon?: boolean
    messageStyle?: string
  }
  customerMessages?: {
    TextStyles?: CSSProperties
    bubbleType?: string
    bubbleStyle?: CSSProperties
    useBrandColor?: boolean
  }
}

// TODO: Placeholder Replace with actual values
export interface WorkingHoursConfig {
  enabled: boolean
  schedule: Array<{
    day: string
    enabled: boolean
    startTime: string
    endTime: string
  }>
}

// TODO: Placeholder Replace with actual values
export interface WidgetV2Config {
  intro_screen?: IntroScreenConfig
  quick_links?: QuickLinksConfigV2
  trending_prompts?: TrendingPromptsConfigV2
  chat_input?: ChatInputConfig
  messages?: MessagesConfig
}

export interface WidgetConfigResponse {
  widget_id: string
  name: string
  widget_color: string
  welcome_title: string | null
  welcome_tagline: string | null
  reply_time: string
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
  sender_name_type: string
  allow_messages_after_resolved: boolean
  lock_to_single_conversation: boolean
  enable_email_collect: boolean
  continuity_via_email: boolean
  csat_survey_enabled: boolean
  // TODO: Placeholder Replace with actual values
  intro_screen?: IntroScreenConfig
  quick_links?: QuickLinksConfig
  trending_prompts?: TrendingPromptsConfig
  textbox_style?: {
    layout: 'standard' | 'full_width'
    placeholder?: string
  }
  widget_bg_color?: string
  hide_message_time?: boolean
  hide_header?: boolean
  hide_footer?: boolean
  widget_v2_config?: WidgetV2Config
  working_hours?: WorkingHoursConfig
}

export interface CsatConfig {}

export interface AutoAssignmentConfig {}

export interface WorkingHour {
  day_of_week: number
  closed_all_day: boolean
  open_hour: number | null
  open_minutes: number | null
  close_hour: number | null
  close_minutes: number | null
  open_all_day: boolean
}

export interface PreChatFormOptions {
  pre_chat_fields: PreChatField[]
  pre_chat_message: string
}

export interface PreChatField {
  name: string
  type: string
  label: string
  order: number
  enabled: boolean
  required: boolean
  field_type: string
  placeholder?: string
}
