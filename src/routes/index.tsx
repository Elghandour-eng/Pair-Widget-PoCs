import { createFileRoute } from '@tanstack/react-router'

import { AnimatePresence, motion } from 'framer-motion'

import { WidgetColorSync } from '@/components/widget-color-sync'
import { WidgetLayout } from '@/components/widget-layout'
import { WidgetUnreadSync } from '@/components/widget-unread-sync'
import { WidgetVisitorTokenRefreshSync } from '@/components/widget-visitor-token-refresh-sync'
import { DEV_WINDOW_SETTINGS } from '@/config/constants/dev-window-settings'
import { WidgetConfigQueryOptions } from '@/config/queries/use-widget-config-queries'
import { mapToWidgetConfig } from '@/config/utils/map-widget-config'
import { UnreadMessagesProvider } from '@/contexts/unread-messages-context'
import { WidgetConfigProvider } from '@/contexts/widget-config-context'
import { WidgetNavigationProvider, useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { WidgetUIProvider } from '@/contexts/widget-ui-context'
import { tokenStorage } from '@/core/token-storage'
import { ConversationPage } from '@/features/conversation/pages/conversation-page'
import { ConversationsQueryOptions } from '@/features/conversation/queries/use-conversations-queries'
import { IntroPage } from '@/features/intro/pages/intro-page'
import { PreChatFormPage } from '@/features/pre-chat-form/pages/pre-chat-form-page'
import { WelcomePage } from '@/features/welcome/pages/welcome-page'
import { loadAllFontsFromConfigAsync } from '@/lib/font-loader'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// Set window settings in development if not already set (before beforeLoad runs)
if (import.meta.env.DEV && !window.PairAiWidgetSettings) {
  window.PairAiWidgetSettings = DEV_WINDOW_SETTINGS
  logger.debug('Route', 'Set development window settings', DEV_WINDOW_SETTINGS)
}

function WidgetRouter() {
  const { currentScreen, conversationId, navigationDirection } = useWidgetNavigation()

  logger.debug('WidgetRouter', 'Component rendered', {
    currentScreen,
    conversationId,
    navigationDirection,
  })

  // Animation variants for slide transitions
  const slideVariants = {
    enter: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? '-100%' : '100%',
      opacity: 0,
    }),
  }

  const transition = {
    type: 'tween' as const,
    ease: [0.4, 0, 0.2, 1] as const,
    duration: 0.3,
  }

  // Create a unique key for each screen to trigger animations
  const screenKey = currentScreen === 'conversation' ? `conversation-${conversationId || 'new'}` : currentScreen

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <AnimatePresence custom={navigationDirection}>
        {currentScreen === 'intro' && (
          <motion.div
            key="intro"
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0 flex h-full w-full flex-col"
          >
            <IntroPage />
          </motion.div>
        )}

        {currentScreen === 'welcome' && (
          <motion.div
            key="welcome"
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0 flex h-full w-full flex-col"
          >
            <WelcomePage />
          </motion.div>
        )}

        {currentScreen === 'pre-chat' && (
          <motion.div
            key="pre-chat"
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0 flex h-full w-full flex-col"
          >
            <PreChatFormPage />
          </motion.div>
        )}

        {currentScreen === 'conversation' && (
          <motion.div
            key={screenKey}
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0 flex h-full w-full flex-col"
          >
            <ConversationPage conversationId={conversationId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: () => {
    return (
      <WidgetConfigProvider>
        <WidgetVisitorTokenRefreshSync />
        <WidgetUIProvider>
          <WidgetColorSync />
          <WidgetNavigationProvider>
            <UnreadMessagesProvider>
              <WidgetUnreadSync />
              <WidgetLayout>
                <WidgetRouter />
              </WidgetLayout>
            </UnreadMessagesProvider>
          </WidgetNavigationProvider>
        </WidgetUIProvider>
      </WidgetConfigProvider>
    )
  },
  beforeLoad: async () => {
    logger.debug('loader', 'Route loader started, ensuring widget config query data')
    const data = await queryClient.ensureQueryData(WidgetConfigQueryOptions())
    logger.debug('loader', 'Widget config query data ensured', data)

    // Load fonts before the widget is initialized to prevent flash of unstyled text
    logger.debug('loader', 'Loading dynamic fonts from config')
    try {
      const mappedConfig = mapToWidgetConfig(data, window.PairAiWidgetSettings)
      await loadAllFontsFromConfigAsync(mappedConfig)
      logger.debug('loader', 'Dynamic fonts loaded successfully')
    } catch (err) {
      logger.debug('loader', 'Failed to load dynamic fonts', err)
    }

    // Check if there's a token and fetch conversations (subscription happens in WidgetRouter component)
    const widgetId = getWidgetId()
    const token = tokenStorage.get(widgetId)
    if (token) {
      logger.debug('loader', 'Token found, fetching conversations')
      try {
        const conversationsData = await queryClient.ensureQueryData(ConversationsQueryOptions())
        logger.debug('loader', 'Conversations fetched', {
          count: conversationsData.data.length,
        })
      } catch (error) {
        logger.debug('loader', 'Error fetching conversations', error)
        // Don't throw - allow the app to continue even if fetching conversations fails
      }
    } else {
      logger.debug('loader', 'No token found, skipping conversation fetch')
    }

    return data
  },
  pendingComponent: () => {
    logger.debug('pendingComponent', 'Route is pending, showing pending component')
  },
  errorComponent: ({ error }) => {
    logger.debug('errorComponent', 'Route error occurred, showing error component', error)
  },
})
