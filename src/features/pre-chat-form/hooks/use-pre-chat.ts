import { useMutation } from '@tanstack/react-query'

import { tokenStorage } from '@/core/token-storage'
import { PreChat } from '@/features/pre-chat-form/apis/pre-chat'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function usePreChat() {
  logger.debug('usePreChat', 'Initializing pre-chat mutation hook')

  return useMutation({
    mutationFn: PreChat,
    onSuccess: (data) => {
      logger.debug('usePreChat', 'Pre-chat mutation succeeded, saving token and invalidating profile query')
      // Save token to localStorage
      const widgetId = getWidgetId()
      tokenStorage.set(data.token, widgetId)
      logger.debug('usePreChat', 'Token saved and profile query invalidated')
    },
  })
}
