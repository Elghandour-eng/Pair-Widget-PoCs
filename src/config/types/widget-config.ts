import type {
  ChatInputDesignDto,
  LauncherDesignDto,
  LoadingDesignDto,
  QuickLinksDesignDto,
  ToastDesignDto,
} from './widget-config-dto'
import type { CSSProperties } from 'react'

export interface HeaderConfig {
  enabled: boolean
  backgroundEnabled: boolean
  backgroundColor: string
  title: string
  subtitle: string
  titleStyle: CSSProperties
  subtitleStyle: CSSProperties
  iconUrl?: string | null
  iconStyle?: CSSProperties & {
    shape?: 'circle' | 'square' | string
    borderRadius?: string
    backgroundColor?: string
  }
  actions: {
    cart: boolean
    favorites: boolean
  }
  /** Header controls: the language and theme switches and the glyphs they wear. */
  controls: {
    lang: { show: boolean; icon: string; iconUrl?: string }
    theme: { show: boolean; icon: string; iconUrl?: string }
  }
}

export interface VisitorCredential {
  accessToken?: string
  accessTokenExpiresIn?: number
  refreshFn?: () => Promise<{ accessToken?: string; accessTokenExpiresIn?: number }>
  _updatedAt?: number
}

export interface PairAiWidgetSettings {
  position: 'left' | 'right'
  type: 'expanded_bubble' | 'standard'
  launcherTitle?: string
  widgetId?: string
  sdkMode?: boolean // When true, SDK handles bubble button, widget just shows panel
  beBaseUrl?: string
  openAutomatically?: boolean
  userId?: string
  accessToken?: string
  accessTokenExpiresIn?: number
  refreshFn?: () => Promise<{ accessToken?: string; accessTokenExpiresIn?: number }>
  metadata?: Record<string, unknown>
  welcome_title_var?: string
  _updatedAt?: number
}

declare global {
  interface Window {
    PairAiWidgetSettings?: PairAiWidgetSettings
  }
}

export interface WidgetConfig {
  name: string
  enabled: boolean
  /** The config's own language, as served — what the language switch toggles from. */
  locale?: string
  position: 'left' | 'right'
  /** 'none': no launcher at all — the panel opens by itself and stays. */
  type?: 'expanded_bubble' | 'standard' | 'icon_only' | 'none'
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
  widgetTitle?: {
    text: string
    styles?: CSSProperties
  }
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
  openAutomatically?: boolean
  userId?: string
  visitorCredential?: VisitorCredential
  metadata?: Record<string, unknown>
  /** Host integration header mappings: maps outgoing header names to keys in metadata */
  hostHeaderMappings?: Record<string, string>
  /** Host integration query parameter mappings: maps outgoing query parameter names to keys in metadata */
  hostParamMappings?: Record<string, string>
  chatInput: ChatInputConfig
  messagesConfig?: MessagesConfig
  launcherStyles?: CSSProperties
  launcherDesign?: LauncherDesignDto
  toastDesign?: ToastDesignDto
  headerConfig?: HeaderConfig
  /** The welcome / consent sheet shown until the visitor accepts it. */
  consentScreen?: import('./widget-config-dto').ConsentScreenDto
  /** The CSAT rating survey's studio overrides and design. */
  csat?: import('./widget-config-dto').CsatSectionDto
}

export interface QuickLinksConfig {
  show: boolean
  /** The heading over the cards; nothing is drawn without one. */
  title?: string
  position: 'under_welcome' | 'above_welcome'
  carouselLoop: boolean
  cardStyles?: CSSProperties
  textStyle?: CSSProperties
  links: QuickLinkData[]
  showTitle?: boolean
  showSubtitle?: boolean
  subtitleStyle?: CSSProperties
  /** Layout, auto-scroll and image sizing from the studio. */
  design?: QuickLinksDesignDto
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
  layout?: 'card' | 'chip'
  // TODO: update this when BE supports it
  showTitle?: boolean
  carouselLoop?: boolean
  /** Size and colour for drawn chip glyphs; the colour arrives resolved. */
  iconStyle?: { size?: number; color?: string }
  /** The studio's default glyph, for chips that carry none of their own. */
  defaultIcon?: string
  /** The upload behind `defaultIcon: 'custom'`. */
  defaultIconUrl?: string
  iconPosition?: 'start' | 'end'
  /** How the chips flow, as the studio words it; `layout: 'card'` still wins. */
  chipLayout?: 'wrap' | 'stack' | 'scroll'
  /** Space between chips, in px. */
  gap?: number
}

export interface TrendingPromptData {
  /** A drawn glyph's name, when the chip has no uploaded image. */
  icon?: string
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

/** Resolved carousel dots: colours are real colours by this point. */
export interface IntroHeroDots {
  show: boolean
  shape: 'pill' | 'dot' | 'bar'
  size: number
  activeWidth: number
  gap: number
  activeColor: string
  inactiveColor: string
  inactiveOpacity: number
  position: 'below' | 'overlay'
}

export interface IntroHeroCarousel {
  autoplay: boolean
  intervalMs: number
  transition: 'fade' | 'slide'
  dots: IntroHeroDots
}

export interface WidgetBackgroundConfig {
  type: 'color' | 'gradient'
  background: string
}

export type LoadingStateType = 'shimmer' | 'spinner'

export interface LoadingStateConfig {
  type: LoadingStateType
  styles?: CSSProperties
  design?: LoadingDesignDto
}

export interface IntroScreenConfig {
  show: boolean
  welcomeTitle: string
  welcomeTitleStyles?: CSSProperties
  welcomeSubtitle: string
  welcomeSubtitleStyles?: CSSProperties
  heroImage?: IntroHeroImage
  /** Every hero slide, in order. One entry means no carousel and no dots. */
  heroSlides?: string[]
  heroCarousel?: IntroHeroCarousel
  widgetBackground?: WidgetBackgroundConfig
  loadingState?: LoadingStateConfig
}

export interface SendButtonIconConfig {
  variant: 'arrow-up' | 'send'
  styles?: CSSProperties & {
    iconColor?: string
  }
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
  sendButtonIcon: SendButtonIconConfig
  /** The studio's compiled design, for what CSS on the container cannot reach. */
  design?: ChatInputDesignDto
}

// TODO: Start consuming this configuration in the message and feedback UI components
export interface MessagesConfig {
  suggestions?: import('./widget-config-dto').SuggestionChipsDto
  loadingOlder?: {
    text?: string
    textColor?: string
    background?: string
    spinnerColor?: string
  }
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
    /** false: an AI-bot channel skips the waiting shimmer (replies stream in). */
    showShimmer?: boolean
    messageStyle?: string
    iconUrl?: string
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
  /** The studio's compiled pre-chat design (see PreChatDesignDto). */
  design?: import('./widget-config-dto').PreChatDesignDto
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
