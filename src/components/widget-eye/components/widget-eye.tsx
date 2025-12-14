import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'

import { useUnreadMessages } from '@/contexts/unread-messages-context'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetUIContext } from '@/contexts/widget-ui-context'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { WIDGET_EYE_POSITION_CLASSES } from '../constants/widget-eye-positions'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export function WidgetEye() {
  const { isOpen, toggle } = useWidgetUIContext()
  const { widgetConfig } = useWidgetConfigContext()
  const { getVisibleUnreadCount } = useUnreadMessages()

  // Get count that should be visible on badge
  const visibleUnreadCount = getVisibleUnreadCount()

  logger.debug('WidgetEye', 'Component rendered', {
    isOpen,
    position: widgetConfig.position,
    primaryColor: widgetConfig.primaryColor,
    type: widgetConfig.type,
    visibleUnreadCount,
  })

  const handleClick = () => {
    logger.debug('handleClick', 'Widget eye clicked', {
      currentState: isOpen,
      newState: !isOpen,
    })

    toggle()
  }

  const position = widgetConfig.position
  const launcherTitle = widgetConfig.launcherTitle || 'Open chat'
  const isExpandedBubble = widgetConfig.type === 'expanded_bubble'

  // Calculate initial position for slide-in animation based on position
  const getInitialX = () => {
    if (position === 'right') return 40
    if (position === 'left') return -40
    return 0
  }

  // Expanded bubble view - horizontal pill-shaped button with text
  if (isExpandedBubble) {
    // Calculate slide distance when opening - slide right for left position, left for right position
    const getSlideX = () => {
      if (isOpen) {
        // When opening, slide to align the circle properly
        // For left position: slide right (positive)
        // For right position: slide left (negative) or stay
        return position === 'left' ? 100 : 0
      }
      return 0
    }

    return (
      <div className="fixed z-50">
        <motion.button
          onClick={handleClick}
          type="button"
          aria-label={launcherTitle}
          title={launcherTitle}
          className={`fixed ${WIDGET_EYE_POSITION_CLASSES[position]} z-50 flex cursor-pointer touch-none items-center gap-2 overflow-hidden rounded-full px-4 shadow-lg hover:shadow-xl ${
            isOpen ? 'size-16' : 'h-12 max-w-[300px] min-w-[200px]'
          }`}
          style={{ backgroundColor: widgetConfig.primaryColor }}
          initial={{
            scale: 0,
            opacity: 0,
            x: getInitialX(),
            y: 20,
          }}
          animate={{
            scale: 1,
            opacity: 1,
            x: getSlideX(),
            y: 0,
          }}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
          }}
        >
          <div className="pointer-events-none flex shrink-0 items-center justify-center">
            {!isOpen && <MessageCircle className="pointer-events-none size-5 text-white" />}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="close-icon"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <X className="pointer-events-none size-6 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {!isOpen && launcherTitle && (
              <motion.span
                key="launcher-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none truncate text-sm font-medium whitespace-nowrap text-white"
              >
                {launcherTitle}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Unread badge for expanded bubble */}
        <AnimatePresence>
          {visibleUnreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`fixed ${position === 'right' ? 'right-4' : 'left-4'} bottom-[60px] z-[51] flex size-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg`}
            >
              {visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Default circular button view
  return (
    <div className="relative">
      <motion.button
        onClick={handleClick}
        type="button"
        aria-label={launcherTitle}
        title={launcherTitle}
        className={`fixed ${WIDGET_EYE_POSITION_CLASSES[position]} z-40 flex size-16 cursor-pointer touch-none items-center justify-center rounded-full shadow-lg hover:shadow-xl`}
        style={{ backgroundColor: widgetConfig.primaryColor }}
        initial={{
          scale: 0,
          opacity: 0,
          x: getInitialX(),
          y: 20,
        }}
        animate={{
          scale: 1,
          opacity: 1,
          x: 0,
          y: 0,
        }}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <div className="pointer-events-none relative size-6">
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close-icon"
                initial={{ scale: 0, rotate: 90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <X className="pointer-events-none size-6 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="message-icon"
                initial={{ scale: 0, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <MessageCircle className="pointer-events-none size-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {/* Unread badge for circular button */}
      <AnimatePresence>
        {visibleUnreadCount > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`fixed ${position === 'right' ? 'right-3' : 'left-3'} bottom-[60px] z-[51] flex size-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg ring-2 ring-white`}
          >
            {visibleUnreadCount > 99 ? '99+' : visibleUnreadCount}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
