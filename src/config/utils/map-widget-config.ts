import type {
  ChatInputConfig,
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
      }
    : undefined

  // quick links
  const rawQL = apiResponse.widget_v2_config.quick_links
  const quickLinks: QuickLinksConfig = {
    show: rawQL.showQuickLinks.value,
    position: rawQL.displaySettings?.position ?? 'under_welcome',
    carouselLoop: rawQL.displaySettings?.carouselLoop ?? false,
    cardStyles: rawQL.cardStyle,
    textStyle: rawQL.textStyle,
    links: (rawQL.quickLinkCards ?? []).map((card, idx) => ({
      id: card.id,
      text: card.title,
      image: card.url,
      displayOrder: idx + 1,
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
  const featureFlags = apiResponse.selected_feature_flags || []
  const chatInput: ChatInputConfig = {
    styles: rawChatInput.styles ?? {},
    layout: rawChatInput.inputLayout?.type ?? 'floating_pill',
    sendButtonIcon: rawChatInput.sendButtonIcon ?? 'arrow-up',
    actions: {
      showEmojiPicker: rawChatInput.inputActions?.stickers || featureFlags.includes('emoji_picker') || false,
      showFileUpload: rawChatInput.inputActions?.fileUpload || featureFlags.includes('attachments') || false,
      showVoiceMessages: rawChatInput.inputActions?.voiceMessages || false,
      showAttachmentMenu: rawChatInput.inputActions?.attachmentMenu || featureFlags.includes('attachments') || false,
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
    position: windowSettings?.openAutomatically ? 'right' : windowSettings?.position || 'right',
    type: windowSettings?.type,
    launcherTitle: windowSettings?.launcherTitle,
    primaryColor: apiResponse.widget_color,
    requiresPreChat: apiResponse.pre_chat_form_enabled,
    greetingEnabled: apiResponse.enable_greeting,
    greetingMessage: apiResponse.greeting_message_en || apiResponse.greeting_message_ar || '',
    preChatFormOptions: apiResponse.pre_chat_form_options,
    businessName: apiResponse.business_name || undefined,
    avatarUrl: apiResponse.avatar_url || undefined,
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
      'linear-gradient(180deg, var(--Surface-Base, #FFF) -19.27%, var(--Surface-Tertiary, #EEECE1) 99.71%)',
    hideMessageTime: true,
    showHeader: false,
    showFooter: false,
    // Deprecated used for Welcome Screen
    welcomeTitle: apiResponse.welcome_title || undefined,
    welcomeTagline: apiResponse.welcome_tagline || undefined,
  }
}
