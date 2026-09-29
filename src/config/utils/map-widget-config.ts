import type {
  ChatInputConfig,
  HeaderConfig,
  IntroScreenConfig,
  MessagesConfig,
  PairAiWidgetSettings,
  QuickLinksConfig,
  TrendingPromptsConfig,
  WidgetConfig,
} from '@/config/types/widget-config'
import type { HeroSection, WidgetConfigDto } from '../types/widget-config-dto'
import { formatWelcomeTitle } from './format-welcome-title'

/** `#brand` in a dot colour follows the widget colour; anything else is taken as given. */
function resolveDotColor(value: string | undefined, fallback: string, brand: string | undefined): string {
  if (!value) return fallback
  return value === '#brand' ? (brand ?? fallback) : value
}

const clamp = (value: number | undefined, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

/**
 * The hero's slide list and how its carousel behaves.
 *
 * Designed slides are drawn upstream and arrive as image URLs, so the widget
 * only ever deals in URLs here. A hero with one slide carries no carousel.
 */
function mapHero(section: HeroSection | undefined, brand: string | undefined) {
  const slides = (section?.heroImages ?? [])
    .map((slide) => (typeof slide === 'string' ? slide : slide?.url))
    .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
  const single = section?.heroImage?.url
  const all = slides.length ? slides : typeof single === 'string' && single.trim() ? [single] : []

  const raw = section?.carousel
  const dots = raw?.dots
  return {
    slides: all,
    carousel: {
      autoplay: raw?.autoplay !== false,
      intervalMs: clamp(raw?.intervalMs, 3500, 800, 30000),
      transition: raw?.transition === 'slide' ? ('slide' as const) : ('fade' as const),
      dots: {
        show: dots?.show !== false,
        shape: dots?.shape === 'dot' || dots?.shape === 'bar' ? dots.shape : ('pill' as const),
        size: clamp(dots?.size, 5, 2, 20),
        activeWidth: clamp(dots?.activeWidth, 16, 2, 60),
        gap: clamp(dots?.gap, 6, 0, 24),
        activeColor: resolveDotColor(dots?.activeColor, brand ?? '#E30613', brand),
        inactiveColor: resolveDotColor(dots?.inactiveColor, '#A1A1A6', brand),
        inactiveOpacity: clamp(dots?.inactiveOpacity, 0.35, 0, 1),
        position: dots?.position === 'overlay' ? ('overlay' as const) : ('below' as const),
      },
    },
  }
}

/**
 * Check if widget is running in SDK mode (embedded via SDK)
 * SDK passes sdkMode=true as URL param, OR widget is in an iframe
 */
function isSdkMode(): boolean {
  // Check URL param first
  const urlParams = new URLSearchParams(window.location.search)
  const urlParamMode = urlParams.get('sdkMode') === 'true'

  // If in iframe, assume SDK mode (SDK creates the iframe)
  let inIframe = false
  try {
    inIframe = window.self !== window.top
  } catch {
    // Cross-origin iframe - definitely SDK mode
    inIframe = true
  }

  const sdkMode = urlParamMode || inIframe

  console.log('[Widget] SDK Mode Detection:', {
    urlParam: urlParamMode,
    inIframe: inIframe,
    result: sdkMode,
  })

  return sdkMode
}

/**
 * Maps API response and window settings to WidgetConfig
 */
export function mapToWidgetConfig(apiResponse: WidgetConfigDto, windowSettings?: PairAiWidgetSettings): WidgetConfig {
  const urlWelcomeTitleVar =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('welcome_title_var') : null

  const welcomeTitleVar = windowSettings?.welcome_title_var ?? urlWelcomeTitleVar ?? undefined
  // header
  const rawHeader = apiResponse.widget_v2_config?.header
  const rawIconStyle = (rawHeader as any)?.iconStyle
  const shape = rawIconStyle?.shape?.toString().toLowerCase()

  let resolvedBorderRadius: string | undefined = undefined
  if (shape === 'circle') {
    resolvedBorderRadius = '50%'
  } else if (shape === 'square') {
    resolvedBorderRadius = '8px'
  } else {
    resolvedBorderRadius = rawIconStyle?.borderRadius ?? (rawHeader as any)?.iconBorderRadius
  }

  const iconStyle = rawIconStyle
    ? {
        ...rawIconStyle,
        ...(resolvedBorderRadius ? { borderRadius: resolvedBorderRadius } : {}),
      }
    : (rawHeader as any)?.iconBorderRadius || (rawHeader as any)?.iconBackgroundColor || resolvedBorderRadius
      ? {
          borderRadius: resolvedBorderRadius,
          backgroundColor: (rawHeader as any)?.iconBackgroundColor,
        }
      : undefined

  const headerConfig: HeaderConfig | undefined = rawHeader
    ? {
        enabled: rawHeader.enabled,
        backgroundEnabled: rawHeader.background?.enabled ?? false,
        backgroundColor: rawHeader.background?.color ?? '',
        title: rawHeader.content?.title ?? '',
        subtitle: rawHeader.content?.subtitle ?? '',
        titleStyle: rawHeader.titleStyle ?? {},
        subtitleStyle: rawHeader.subtitleStyle ?? {},
        iconUrl: rawHeader.icon ?? undefined,
        iconStyle,
        actions: {
          cart: rawHeader.actions?.cart ?? false,
          favorites: rawHeader.actions?.favorites ?? false,
        },
        // The language and theme switches are on unless the studio turns them
        // off; their glyphs default to the ones the studio previews.
        controls: {
          lang: {
            show: rawHeader.controls?.lang?.show ?? true,
            // The default is the عربي / EN text badge; a glyph is the studio's choice.
            icon: rawHeader.controls?.lang?.icon ?? 'badge',
            iconUrl: rawHeader.controls?.lang?.iconUrl,
          },
          theme: {
            show: rawHeader.controls?.theme?.show ?? true,
            icon: rawHeader.controls?.theme?.icon ?? 'moon',
            iconUrl: rawHeader.controls?.theme?.iconUrl,
          },
        },
      }
    : undefined

  // intro screen
  const rawIntro = apiResponse.widget_v2_config?.intro_screen
  const hero = mapHero(rawIntro?.heroSection, apiResponse.widget_color)
  const introScreen: IntroScreenConfig | undefined = rawIntro
    ? {
        show: rawIntro.showIntroScreen.value,
        welcomeTitle: formatWelcomeTitle(
          rawIntro.welcomeTitle?.text ?? apiResponse.welcome_title ?? '',
          welcomeTitleVar,
        ),
        welcomeTitleStyles: rawIntro.welcomeTitle?.styles,
        welcomeSubtitle: rawIntro.welcomeSubtitle?.text ?? apiResponse.welcome_tagline ?? '',
        welcomeSubtitleStyles: rawIntro.welcomeSubtitle?.styles,
        heroImage:
          rawIntro.heroSection?.enabled?.value && rawIntro.heroSection?.heroImage?.url
            ? {
                url: rawIntro.heroSection.heroImage.url,
                position: rawIntro.heroSection.heroImage.position ?? 'top',
                styles: rawIntro.heroSection.heroImage.styles,
                containerStyles: rawIntro.heroSection.enabled.styles,
              }
            : undefined,
        heroSlides: rawIntro.heroSection?.enabled?.value ? hero.slides : undefined,
        heroCarousel: rawIntro.heroSection?.enabled?.value ? hero.carousel : undefined,
        widgetBackground: rawIntro.widgetBackground
          ? {
              type: rawIntro.widgetBackground.type,
              background: rawIntro.widgetBackground.background,
            }
          : undefined,
        loadingState: rawIntro.loadingState
          ? {
              type: rawIntro.loadingState.type,
              styles: rawIntro.loadingState.styles,
              design: rawIntro.loadingState.design,
            }
          : undefined,
      }
    : undefined

  // quick links
  const rawQL = apiResponse.widget_v2_config.quick_links
  const quickLinks: QuickLinksConfig = {
    show: rawQL.showQuickLinks.value,
    title: rawQL.displaySettings?.sectionTitle,
    position: rawQL.displaySettings?.position ?? 'under_welcome',
    carouselLoop: rawQL.displaySettings?.carouselLoop ?? false,
    cardStyles: rawQL.cardStyle
      ? {
          ...rawQL.cardStyle,
          gap: (rawQL.cardStyle as any).imageTextGap ?? rawQL.cardStyle.gap,
        }
      : undefined,
    textStyle: rawQL.textStyle,
    subtitleStyle: rawQL.subtitleStyle,
    design: rawQL.design,
    showTitle: rawQL.displaySettings?.showTitle ?? rawQL.showTitle ?? true,
    showSubtitle: rawQL.displaySettings?.showSubtitle ?? rawQL.showSubtitle ?? true,
    links: (rawQL.quickLinkCards ?? []).map((card, idx) => ({
      id: card.id,
      text: card.title,
      image: card.url,
      displayOrder: card.order ?? idx + 1,
      active: card.active,
      subtitle: card.subtitle,
      media_ulid: card.media_ulid,
    })),
  }

  // trending prompts
  const v2Trending = apiResponse.widget_v2_config?.trending_prompts
  // The studio stores `#brand` for "follow the widget colour"; it is not a CSS
  // colour, so it is resolved here rather than handed to a style attribute.
  const promptIconColor =
    v2Trending?.design?.iconColor === '#brand' ? apiResponse.widget_color : v2Trending?.design?.iconColor
  const trendingPrompts: TrendingPromptsConfig | undefined = v2Trending
    ? {
        show: v2Trending.showTrendingPrompts.value,
        title: v2Trending.displaySettings?.sectionTitle,
        // TODO: This showTitle property is mocked for now. Sync with BE when they support showTitle in displaySettings.
        showTitle: v2Trending.displaySettings?.showTitle ?? false,
        titleStyle: v2Trending.displaySettings?.styles ?? {},
        showIcon: v2Trending.displaySettings?.showIcons ?? false,
        chipStyles: v2Trending.chipStyle ?? {},
        textStyle: v2Trending.textStyle ?? {},
        layout: v2Trending.displaySettings?.layout ?? 'chip',
        // TODO: This carouselLoop property is mocked for now. Sync with BE when they support carouselLoop in displaySettings.
        carouselLoop: v2Trending.displaySettings?.carouselLoop ?? false,
        iconStyle: v2Trending.design ? { size: v2Trending.design.iconSize, color: promptIconColor } : undefined,
        defaultIcon: v2Trending.design?.icon,
        defaultIconUrl: v2Trending.design?.iconUrl,
        iconPosition: v2Trending.design?.iconPosition,
        chipLayout: v2Trending.design?.layout,
        gap: v2Trending.design?.gap,
        prompts: (v2Trending.promptChips || []).map((chip, idx) => ({
          id: `trending-prompt-${idx}`,
          text: chip.text,
          icon: chip.icon,
          iconUrl: chip.iconUrl,
        })),
      }
    : undefined

  // chat input
  const rawChatInput = apiResponse.widget_v2_config.chat_input
  // const featureFlags = apiResponse.selected_feature_flags || []
  const rawSendIcon = rawChatInput.sendButtonIcon
  const sendButtonIcon = {
    variant: rawSendIcon?.variant ?? 'send',
    styles: rawSendIcon?.styles,
  }

  // The studio writes the emoji toggle as `showEmojiPicker` and folds the
  // attach button into `attachmentMenu`; older configs still carry `stickers`
  // and `fileUpload`, so both spellings are read.
  const chatInput: ChatInputConfig = {
    styles: rawChatInput.styles ?? {},
    layout: rawChatInput.inputLayout?.type ?? 'floating_pill',
    sendButtonIcon,
    actions: {
      showEmojiPicker: rawChatInput.inputActions?.showEmojiPicker ?? rawChatInput.inputActions?.stickers ?? false,
      showFileUpload: rawChatInput.inputActions?.fileUpload ?? rawChatInput.inputActions?.attachmentMenu ?? false,
      showVoiceMessages: rawChatInput.inputActions?.voiceMessages || false,
      showAttachmentMenu: rawChatInput.inputActions?.attachmentMenu || false,
    },
    placeholder: {
      text: rawChatInput.placeholderText?.text ?? 'Ask me Anything...',
      styles: rawChatInput.placeholderText?.styles ?? {},
    },
    design: rawChatInput.design,
  }

  const rawMessages = apiResponse.widget_v2_config?.messages
  const messagesConfig: MessagesConfig = {
    loadingOlder: rawMessages?.loadingOlder,
    suggestions: rawMessages?.suggestions,
    questions: rawMessages?.questions,
    feedback: rawMessages?.feedback
      ? {
          showFeedbackButtons: rawMessages.feedback.showFeedbackButtons ?? true,
          toastMessage: rawMessages.feedback.toastMessage ?? 'Thanks for your feedback.',
          iconColorType: rawMessages.feedback.iconColorType ?? 'widget',
          style: {
            iconSize: rawMessages.feedback.style?.iconSize ?? '1.5rem',
            iconColor: rawMessages.feedback.style?.iconColor ?? null,
          },
        }
      : undefined,
    aiMessages: rawMessages?.aiMessages
      ? {
          iconId: rawMessages.aiMessages.iconId ?? '',
          iconUrl: rawMessages.aiMessages.iconUrl,
          CardStyles: rawMessages.aiMessages.CardStyles ?? {},
          TextStyles: rawMessages.aiMessages.TextStyles ?? {},
          showAiIcon: rawMessages.aiMessages.showAiIcon ?? true,
          showShimmer: rawMessages.aiMessages.showShimmer ?? true,
          messageStyle: rawMessages.aiMessages.messageStyle ?? 'plain',
        }
      : undefined,
    customerMessages: rawMessages?.customerMessages
      ? {
          TextStyles: rawMessages.customerMessages.TextStyles ?? {},
          bubbleType: rawMessages.customerMessages.bubbleType ?? 'filled',
          bubbleStyle: rawMessages.customerMessages.bubbleStyle ?? {},
          useBrandColor: rawMessages.customerMessages.useBrandColor ?? false,
        }
      : undefined,
  }

  return {
    name: apiResponse.name,
    enabled: true, // Widget is enabled if config is returned
    locale: apiResponse.locale,
    position: apiResponse.launcher_position || windowSettings?.position || 'right',
    type: apiResponse.launcher_style
      ? apiResponse.launcher_style === 'expanded_bubble'
        ? 'expanded_bubble'
        : apiResponse.launcher_style === 'icon_only'
          ? 'icon_only'
          : apiResponse.launcher_style === 'none'
            ? 'none'
            : 'standard'
      : windowSettings?.type,
    launcherTitle: apiResponse.launcher_title || windowSettings?.launcherTitle,
    primaryColor: apiResponse.widget_color,
    requiresPreChat: apiResponse.pre_chat_form_enabled,
    greetingEnabled: apiResponse.enable_greeting,
    greetingMessage: apiResponse.greeting_message_en || apiResponse.greeting_message_ar || '',
    preChatFormOptions: apiResponse.pre_chat_form_options,
    businessName: apiResponse.business_name || undefined,
    avatarUrl: apiResponse.avatar_url || undefined,
    widgetTitle: apiResponse.widget_v2_config?.intro_screen?.introTitle || apiResponse.widget_v2_config?.introTitle,
    websiteToken: apiResponse.widget_id,
    baseUrl: apiResponse.website_url,
    reply_time: apiResponse.reply_time as 'in_a_few_hours' | 'in_a_few_minutes' | 'in_a_day',
    sdkMode: isSdkMode() || windowSettings?.sdkMode || false,
    introScreen,
    quickLinks,
    trendingPrompts,
    chatInput,
    messagesConfig,
    // TODO: Discuss with the PM if we need to have these styles in the config
    textboxStyle: undefined,
    widgetBgColor:
      rawIntro?.widgetBackground?.background ??
      'linear-gradient(180deg, var(--Surface-Base, #FFF) -19.27%, var(--Surface-Tertiary, #EEECE1) 99.71%)',
    hideMessageTime: true,
    showHeader: apiResponse.widget_header ?? true,
    showFooter: apiResponse.powered_by_pair_ai ?? true,
    openAutomatically:
      apiResponse.opening_method === 'automatically_open' ||
      apiResponse.launcher_style === 'none' ||
      windowSettings?.openAutomatically ||
      false,
    userId: windowSettings?.userId,
    visitorCredential:
      windowSettings?.accessToken || windowSettings?.accessTokenExpiresIn || windowSettings?.refreshFn
        ? {
            accessToken: windowSettings.accessToken,
            accessTokenExpiresIn: windowSettings.accessTokenExpiresIn,
            refreshFn: windowSettings.refreshFn,
            _updatedAt: windowSettings._updatedAt,
          }
        : undefined,
    metadata: windowSettings?.metadata,
    consentScreen: apiResponse.widget_v2_config?.consent_screen,
    csat: apiResponse.widget_v2_config?.csat,
    hostHeaderMappings: apiResponse.headers,
    hostParamMappings: apiResponse.params,
    // Deprecated used for Welcome Screen
    welcomeTitle: apiResponse.welcome_title
      ? formatWelcomeTitle(apiResponse.welcome_title, welcomeTitleVar)
      : undefined,
    welcomeTagline: apiResponse.welcome_tagline || undefined,
    launcherStyles: apiResponse.launcher_styles || apiResponse.styles,
    launcherDesign: apiResponse.launcher_design,
    toastDesign: apiResponse.toast_design,
    headerConfig,
  }
}
