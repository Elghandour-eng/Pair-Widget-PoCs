import { AnimatePresence, motion } from 'framer-motion'

import { IncomingMessagePreview } from '@/components/incoming-message-preview'
import { Card } from '@/components/ui/card'
import { WidgetEye } from '@/components/widget-eye/components/widget-eye'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { Toaster } from './ui/sonner'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

function WidgetLayoutContent({ children }: { children: React.ReactNode }) {
  logger.debug('WidgetLayout', 'Component rendered')

  const { widgetConfig } = useWidgetConfigContext()
  const { isOpen } = useWidgetUIContext()

  logger.debug('WidgetLayout', 'Widget config loaded', {
    enabled: widgetConfig.enabled,
    position: widgetConfig.position,
    sdkMode: widgetConfig.sdkMode,
  })

  if (!widgetConfig.enabled) {
    logger.debug('WidgetLayout', 'Widget is disabled, not rendering')
    return null
  }

  const position = widgetConfig.position

  // SDK Mode: Widget is embedded via SDK, SDK controls bubble button and panel visibility
  // In this mode, we just render the panel content (always visible, fills iframe)
  // NO fixed positioning, NO bubble button - just content
  // Add entrance animation when widget appears
  if (widgetConfig.sdkMode) {
    logger.debug('WidgetLayout', 'SDK mode - rendering panel only (no fixed positioning)')
    return (
      <motion.div
        className="relative h-full w-full overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Card
          className="flex h-full w-full flex-col gap-0 overflow-y-auto rounded-none border-0 p-0"
          style={widgetConfig.widgetBgColor ? { background: widgetConfig.widgetBgColor } : undefined}
        >
          {widgetConfig.widgetTitle?.text && (
            <div
              className="px-4 pt-6 text-start text-2xl font-bold text-[#0D223F]"
              style={widgetConfig.widgetTitle.styles}
            >
              {widgetConfig.widgetTitle.text}
            </div>
          )}
          {children}
        </Card>
      </motion.div>
    )
  }

  // Standalone Mode: Widget renders its own bubble button and handles toggle
  logger.debug('WidgetLayout', 'Standalone mode - rendering with bubble')

  // Position classes for the panel
  const panelPositionClasses = {
    right: 'min-[668px]:top-auto min-[668px]:left-auto min-[668px]:bottom-[104px] min-[668px]:right-4',
    left: 'min-[668px]:top-auto min-[668px]:right-auto min-[668px]:bottom-[104px] min-[668px]:left-4',
  }

  const slideDistance = 50

  return (
    <div className="fixed z-50">
      {/* Chat Panel with Framer Motion */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="widget-panel"
            className={`min-[668px]:max-h-175-[668px]:w-full min-min-[668px]:max-w-100 ${panelPositionClasses[position as keyof typeof panelPositionClasses]} fixed inset-0 z-50 min-[668px]:h-full`}
            initial={{
              opacity: 0,
              y: slideDistance,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: slideDistance,
            }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Card
              className="flex h-full w-full flex-col gap-0 overflow-y-auto rounded-none border-0 p-0 shadow-[0_5px_40px_rgba(0,0,0,.16)] min-[668px]:rounded-xl"
              style={widgetConfig.widgetBgColor ? { background: widgetConfig.widgetBgColor } : undefined}
            >
              {widgetConfig.widgetTitle?.text && (
                <div
                  className="px-5 pt-5 text-start text-[1.25rem] font-bold text-[#1E1E1E]"
                  style={widgetConfig.widgetTitle.styles}
                >
                  {widgetConfig.widgetTitle.text}
                </div>
              )}
              {children}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Message Preview - only in standalone mode */}
      <IncomingMessagePreview />

      {/* Chat Bubble Button - only in standalone mode */}
      <WidgetEye />
    </div>
  )
}

function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WidgetLayoutContent>{children}</WidgetLayoutContent>
      <Toaster position="top-center" richColors />
    </>
  )
}

export { WidgetLayout }
