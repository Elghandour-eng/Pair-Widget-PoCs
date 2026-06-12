import type { IntroScreenConfig, PairAiWidgetSettings, WidgetConfig, WorkingHour } from '@/config/types/widget-config'
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

function getDayOfWeekNumber(day: string): number {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days.indexOf(day.toLowerCase())
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  try {
    const [time, modifier] = timeStr.split(' ')
    const [hoursStr, minutesStr] = time.split(':')
    let hours = parseInt(hoursStr, 10)
    const minutes = parseInt(minutesStr, 10)
    if (modifier === 'PM' && hours < 12) {
      hours += 12
    }
    if (modifier === 'AM' && hours === 12) {
      hours = 0
    }
    return { hour: hours, minute: minutes }
  } catch {
    return { hour: 0, minute: 0 }
  }
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
  let quickLinks = apiResponse.quick_links
  if (apiResponse.widget_v2_config?.quick_links) {
    const v2 = apiResponse.widget_v2_config.quick_links
    quickLinks = {
      show: {
        value: v2.showQuickLinks.value,
      },
      position: v2.displaySettings?.position,
      cardStyle: {
        layout: v2.displaySettings?.position === 'under_welcome' ? 'row' : 'column',
      },
      cardStyles: v2.cardStyle,
      textStyle: v2.textStyle,
      carouselLoop: v2.displaySettings?.carouselLoop,
      links: (v2.quickLinkCards || []).map((card, idx) => ({
        id: card.id,
        text: card.title,
        image: card.url,
        displayOrder: idx + 1,
        active: card.active,
        subtitle: card.subtitle,
        media_ulid: card.media_ulid,
      })),
    }
  }

  let trendingPrompts = apiResponse.trending_prompts
  if (apiResponse.widget_v2_config?.trending_prompts) {
    const v2 = apiResponse.widget_v2_config.trending_prompts
    trendingPrompts = {
      show: {
        value: v2.showTrendingPrompts.value,
      },
      title: v2.displaySettings?.sectionTitle,
      showIcon: {
        value: v2.displaySettings?.showIcons ?? false,
      },
      chipStyles: v2.chipStyle,
      textStyle: v2.textStyle,
      prompts: (v2.promptChips || []).map((chip, idx) => ({
        id: chip.id,
        text: chip.text,
        displayOrder: chip.displayOrder ?? idx + 1,
        iconUrl: chip.iconUrl,
      })),
    }
  }

  const chatInput = apiResponse.widget_v2_config?.chat_input
  const messagesConfig = apiResponse.widget_v2_config?.messages

  const workingHoursEnabled = apiResponse.working_hours?.enabled ?? false
  const workingHours: WorkingHour[] =
    apiResponse.working_hours?.schedule.map((s) => {
      const parsedStart = parseTime(s.startTime)
      const parsedEnd = parseTime(s.endTime)
      return {
        day_of_week: getDayOfWeekNumber(s.day),
        closed_all_day: !s.enabled,
        open_hour: parsedStart.hour,
        open_minutes: parsedStart.minute,
        close_hour: parsedEnd.hour,
        close_minutes: parsedEnd.minute,
        open_all_day: s.startTime === '12:00 AM' && s.endTime === '11:59 PM',
      }
    }) || []

  return {
    name: apiResponse.name,
    enabled: true, // Widget is enabled if config is returned
    position: windowSettings?.position || 'right',
    type: windowSettings?.type,
    launcherTitle: windowSettings?.launcherTitle,
    primaryColor: apiResponse.widget_color,
    requiresPreChat: apiResponse.pre_chat_form_enabled,
    welcomeTitle: apiResponse.welcome_title || undefined,
    welcomeTagline: apiResponse.welcome_tagline || undefined,
    greetingEnabled: apiResponse.enable_greeting,
    greetingMessage: apiResponse.greeting_message_en || apiResponse.greeting_message_ar || '',
    workingHoursEnabled,
    workingHours,
    timezone: 'UTC', // Default timezone fallback
    preChatFormOptions: apiResponse.pre_chat_form_options,
    selectedFeatureFlags: apiResponse.selected_feature_flags,
    businessName: apiResponse.business_name || undefined,
    avatarUrl: apiResponse.avatar_url || undefined,
    websiteToken: apiResponse.widget_id,
    baseUrl: apiResponse.website_url,
    reply_time: apiResponse.reply_time as 'in_a_few_hours' | 'in_a_few_minutes' | 'in_a_day',
    sdkMode: isSdkMode() || windowSettings?.sdkMode || false,
    introScreen,
    quickLinks,
    trendingPrompts,
    textboxStyle: apiResponse.textbox_style,
    widgetBgColor: apiResponse.widget_bg_color,
    hideMessageTime: apiResponse.hide_message_time || false,
    hideHeader: apiResponse.hide_header || false,
    hideFooter: apiResponse.hide_footer || false,
    chatInput,
    messagesConfig,
  }
}
