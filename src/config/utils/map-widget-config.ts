import type { PairAiWidgetSettings, WidgetConfig, WidgetConfigResponse } from '@/config/types/widget-config'

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
export function mapToWidgetConfig(
  apiResponse: WidgetConfigResponse,
  windowSettings?: PairAiWidgetSettings,
): WidgetConfig {
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
    workingHoursEnabled: false, // Not in API response
    workingHours: [], // Not in API response
    timezone: 'UTC', // Not in API response
    preChatFormOptions: apiResponse.pre_chat_form_options,
    selectedFeatureFlags: apiResponse.selected_feature_flags,
    businessName: apiResponse.business_name || undefined,
    avatarUrl: apiResponse.avatar_url || undefined,
    websiteToken: apiResponse.widget_id,
    baseUrl: apiResponse.website_url,
    reply_time: apiResponse.reply_time as 'in_a_few_hours' | 'in_a_few_minutes' | 'in_a_day',
    sdkMode: isSdkMode() || windowSettings?.sdkMode || false,
  }
}
