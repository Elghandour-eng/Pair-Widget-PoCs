import { useMutation } from '@tanstack/react-query'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { tokenStorage } from '@/core/token-storage'
import { PreChat } from '@/features/pre-chat-form/apis/pre-chat'
import type { PreChatFormPayload } from '@/features/pre-chat-form/types/pre-chat-form-payload'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function usePreChat() {
  logger.debug('usePreChat', 'Initializing pre-chat mutation hook')
  const { widgetConfig } = useWidgetConfigContext()

  return useMutation({
    mutationFn: (data: PreChatFormPayload) => PreChat(data, widgetConfig),
    onSuccess: (data) => {
      logger.debug('usePreChat', 'Pre-chat mutation succeeded, saving token and invalidating profile query')
      // Save token to localStorage
      const widgetId = getWidgetId()
      tokenStorage.set(data.token, widgetId)
      logger.debug('usePreChat', 'Token saved and profile query invalidated')
    },
  })
}
