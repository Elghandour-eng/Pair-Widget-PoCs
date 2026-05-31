import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

import { WidgetFooter } from '@/components/widget-footer'
import { WelcomeContent } from '@/features/welcome/components/welcome-content'
import { WelcomeHeader } from '@/features/welcome/components/welcome-header'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * @deprecated The WelcomePage screen is deprecated and will be removed in a future release.
 * Please use IntroPage instead.
 */
export function WelcomePage() {
  logger.debug('WelcomePage', 'Component rendered')

  return (
    <>
      <WelcomeHeader />
      <WelcomeContent />
      <WidgetFooter />
    </>
  )
}
