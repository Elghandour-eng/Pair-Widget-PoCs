import type { CSSProperties } from 'react'

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
  preChatFormOptions?: PreChatFormOptions
  businessName?: string
  avatarUrl?: string
  websiteToken?: string
  baseUrl?: string
  reply_time: 'in_a_few_hours' | 'in_a_few_minutes' | 'in_a_day'
  sdkMode: boolean // When true, SDK handles bubble button
  introScreen?: IntroScreenConfig
  quickLinks?: QuickLinksConfig
  trendingPrompts?: TrendingPromptsConfig
  textboxStyle?: {
    layout: 'standard' | 'full_width'
    placeholder?: string
  }
  widgetBgColor?: string
  hideMessageTime?: boolean
  showHeader?: boolean
  showFooter?: boolean
  chatInput: ChatInputConfig
  messagesConfig?: MessagesConfig
}

export interface QuickLinksConfig {
  show: boolean
  position: 'under_welcome' | 'above_welcome'
  carouselLoop: boolean
  cardStyles?: CSSProperties
  textStyle?: CSSProperties
  links: QuickLinkData[]
}

export interface QuickLinkData {
  id: string
  text: string
  image?: string
  displayOrder?: number
  active?: boolean
  subtitle?: string
  media_ulid?: string
}

export interface TrendingPromptsConfig {
  show: boolean
  title?: string
  titleStyle: CSSProperties
  showIcon: boolean
  chipStyles: CSSProperties
  textStyle: CSSProperties
  prompts: TrendingPromptData[]
  // TODO: update this when BE supports it
  showTitle?: boolean
}

export interface TrendingPromptData {
  id: string
  text: string
  iconUrl?: string
}

export interface IntroHeroImage {
  url: string
  position: 'top' | 'bottom'
  styles?: CSSProperties
  containerStyles?: CSSProperties
}

export interface IntroScreenConfig {
  show: boolean
  welcomeTitle: string
  welcomeTitleStyles?: CSSProperties
  welcomeSubtitle: string
  welcomeSubtitleStyles?: CSSProperties
  heroImage?: IntroHeroImage
}

export interface ChatInputConfig {
  styles: CSSProperties
  layout: 'floating_pill' | 'full_width_bar'
  actions: {
    showEmojiPicker: boolean
    showFileUpload: boolean
    showVoiceMessages: boolean
    showAttachmentMenu: boolean
  }
  placeholder: {
    text: string
    styles: CSSProperties
  }
  // TODO: update this when BE supports it
  sendButtonIcon: 'arrow-up' | 'send'
}

// TODO: Start consuming this configuration in the message and feedback UI components
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

export interface CsatConfig {}

export interface AutoAssignmentConfig {}

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
