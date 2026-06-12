import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

import { WidgetFooter } from '@/components/widget-footer'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { PreChatForm } from '../components/pre-chat-form'
import { PreChatHeader } from '../components/pre-chat-header'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function PreChatFormPage() {
  const { widgetConfig } = useWidgetConfigContext()
  const showFooter = widgetConfig?.showFooter

  logger.debug('PreChatFormPage', 'Component rendered')

  return (
    <>
      <PreChatHeader />
      <PreChatForm />
      {showFooter && <WidgetFooter />}
    </>
  )
}
