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
import type { WidgetConfigDto } from '../types/widget-config-dto'

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
      }
    : undefined

  // intro screen
  const rawIntro = apiResponse.widget_v2_config?.intro_screen
  const introScreen: IntroScreenConfig | undefined = rawIntro
    ? {
        show: rawIntro.showIntroScreen.value,
        welcomeTitle: rawIntro.welcomeTitle?.text ?? apiResponse.welcome_title ?? '',
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
            }
          : undefined,
      }
    : undefined

  // quick links
  const rawQL = apiResponse.widget_v2_config.quick_links
  const quickLinks: QuickLinksConfig = {
    show: rawQL.showQuickLinks.value,
    position: rawQL.displaySettings?.position ?? 'under_welcome',
    carouselLoop: rawQL.displaySettings?.carouselLoop ?? false,
    cardStyles: rawQL.cardStyle
      ? {
          ...rawQL.cardStyle,
          gap: (rawQL.cardStyle as any).imageTextGap ?? rawQL.cardStyle.gap,
        }
      : undefined,
    textStyle: rawQL.textStyle,
    showTitle: rawQL.showTitle ?? true,
    showSubtitle: rawQL.showSubtitle ?? true,
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
        prompts: (v2Trending.promptChips || []).map((chip, idx) => ({
          id: `trending-prompt-${idx}`,
          text: chip.text,
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

  const chatInput: ChatInputConfig = {
    styles: rawChatInput.styles ?? {},
    layout: rawChatInput.inputLayout?.type ?? 'floating_pill',
    sendButtonIcon,
    actions: {
      showEmojiPicker: rawChatInput.inputActions?.stickers || false,
      showFileUpload: rawChatInput.inputActions?.fileUpload || false,
      showVoiceMessages: rawChatInput.inputActions?.voiceMessages || false,
      showAttachmentMenu: rawChatInput.inputActions?.attachmentMenu || false,
    },
    placeholder: {
      text: rawChatInput.placeholderText?.text ?? 'Ask me Anything...',
      styles: rawChatInput.placeholderText?.styles ?? {},
    },
  }

  const rawMessages = apiResponse.widget_v2_config?.messages
  const messagesConfig: MessagesConfig = {
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
    position: apiResponse.launcher_position || windowSettings?.position || 'right',
    type: apiResponse.launcher_style
      ? apiResponse.launcher_style === 'expanded_bubble'
        ? 'expanded_bubble'
        : apiResponse.launcher_style === 'icon_only'
          ? 'icon_only'
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
      apiResponse.opening_method === 'automatically_open' || windowSettings?.openAutomatically || false,
    userId: windowSettings?.userId,
    // Deprecated used for Welcome Screen
    welcomeTitle: apiResponse.welcome_title || undefined,
    welcomeTagline: apiResponse.welcome_tagline || undefined,
    launcherStyles: apiResponse.launcher_styles || apiResponse.styles,
    headerConfig,
  }
}
