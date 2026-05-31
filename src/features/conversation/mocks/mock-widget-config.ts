import type { WidgetConfigResponse } from '@/config/types/widget-config'

export const mockWidgetConfig: WidgetConfigResponse = {
  allow_messages_after_resolved: true,
  avatar_url: '',
  business_name: null,
  continuity_via_email: true,
  csat_survey_enabled: false,
  enable_email_collect: true,
  enable_greeting: false,
  greeting_message_ar: '',
  greeting_message_en: null,
  locale: 'en',
  lock_to_single_conversation: false,
  name: 'sample-widget',
  pre_chat_form_enabled: false,
  pre_chat_form_options: {
    pre_chat_fields: [],
    pre_chat_message: '',
  },
  reply_time: 'in_a_few_minutes',
  sender_name_type: 'friendly',
  website_url: 'http://www.xlcloseve.com',
  welcome_tagline: '',
  welcome_title: '',
  widget_color: '#374247',
  widget_id: '01KP0TPQNVJ330AQ7D4S19D753',
  selected_feature_flags: ['voice_messages', 'attachments'],
  intro_screen: {
    showIntroScreen: {
      value: true,
      styles: {},
    },
    welcomeTitle: {
      text: 'Hi Noor, what are you looking for today?',
      styles: { fontFamily: 'DM Sans' },
    },
    welcomeSubtitle: {
      text: 'Ask me a question, or choose a quick link below to get started.',
      styles: {},
    },
    heroSection: {
      enabled: {
        value: true,
        styles: {},
      },
      heroImage: {
        url: '/demo.webp',
        position: 'bottom',
        styles: {},
      },
    },
    loadingState: {
      type: 'shimmer',
      styles: {},
    },
  },
  quick_links: {
    show: {
      value: true,
    },
    position: 'bottom',
    cardStyle: {
      layout: 'row',
    },
    cardStyles: {},
    textStyle: { fontFamily: 'DM Sans' },
    carouselLoop: true,
    links: [
      { id: 1, text: 'Build Your Routine', image: '/quick-link-img-3.png', displayOrder: 1 },
      { id: 2, text: 'Browse\nProducts', image: '/quick-link-img-1.jpg', displayOrder: 2 },
      { id: 3, text: 'Track\nOrder', image: '/quick-link-img-2.jpg', displayOrder: 3 },
    ],
  },
  trending_prompts: {
    show: {
      value: true,
    },
    title: 'Trending prompts',
    showIcon: {
      value: true,
    },
    chipStyles: {},
    textStyle: {},
    prompts: [
      { id: 1, text: 'Build my skincare routine', displayOrder: 1, iconUrl: '/lotion.svg' },
      { id: 2, text: 'Trending now', displayOrder: 2, iconUrl: '/fire.svg' },
      { id: 3, text: 'Under 50 KWD finds', displayOrder: 3, iconUrl: '/money.svg' },
      { id: 4, text: 'Fix a skin concern', displayOrder: 4, iconUrl: '/sparkles.svg' },
      { id: 5, text: 'Sweat-proof makeup essentials', displayOrder: 5, iconUrl: '/lipstick.svg' },
    ],
  },
  textbox_style: {
    layout: 'standard',
    placeholder: 'Write your message...',
  },
  widget_bg_color: '#FAFAFA',
  hide_message_time: true,
  hide_footer: true,
  hide_header: true,
}

