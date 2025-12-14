import { publicApiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export async function WidgetConfig(): Promise<any> {
  logger.debug('WidgetConfig', 'Fetching widget configuration')

  const widgetId = getWidgetId()
  if (!widgetId) {
    throw new Error('Widget ID is required to fetch widget configuration')
  }

  const response = await publicApiClient.get(`/v1/widget/${widgetId}/config`)
  logger.debug('WidgetConfig', 'Widget configuration fetched successfully', response.data)
  return response.data
  // {
  //   widget_id: '01KCHXF0CXA1Q5EWDY8GKFMDVK',
  //   name: 'Kemitt',
  //   avatar_url: 'https://images.kemitt.com/img/category/image-1759845531417.png?class=category',
  //   pre_chat_form_enabled: false,
  //   selected_feature_flags: [],
  //   enable_greeting: true,
  //   greeting_message_en: 'Hello! How can we help you today?',
  //   greeting_message_ar: null,
  //   locale: 'en',
  //   widget_color: '#f7941d',
  //   welcome_title: 'Kemitt',
  //   welcome_tagline: 'Welcome to [Kemitt](https://kemitt.com/) **Furniture** - *Comfort* - ***Lazy***',
  //   website_url: 'https://images.kemitt.com/img/category/image-1759845531417.png?class=category',
  // }
}
