export type FeatureFlag = 'attachments' | 'emoji_picker' | 'end_conversation' | 'use_inbox_avatar_for_bot'

export interface PairAiWidgetSettings {
  position: 'left' | 'right'
  type: 'expanded_bubble' | 'standard'
  launcherTitle?: string
  widgetId?: string
  sdkMode?: boolean // When true, SDK handles bubble button, widget just shows panel
  beBaseUrl?: string
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
  placeholder: string
}

// <script>
//   window.pairAiWidgetSettings = {"position":"right","type":"expanded_bubble","launcherTitle":"Widget Bubble Launcher Title", "widgetId": "01KCHXF0CXA1Q5EWDY8GKFMDVK"};
//   (function(d,t) {
//     var BASE_URL="https://app.chatwoot.com";
//     var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
//     g.src=BASE_URL+"/packs/js/sdk.js";
//     g.async = true;
//     s.parentNode.insertBefore(g,s);
//     g.onload=function(){
//       window.pairAiWidgetSDK.run({
//         websiteToken: 'DqDmR4VKw9Kxm7xojX1SLXuE',
//         baseUrl: BASE_URL
//       })
//     }
//   })(document,"script");
// </script>
