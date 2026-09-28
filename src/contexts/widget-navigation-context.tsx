import { tokenStorage } from '@/core/token-storage'
import { ConversationsQueryOptions } from '@/features/conversation/queries/use-conversations-queries'
import { queryClient } from '@/queryClient'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'
import { createContext, useContext, useState, type ReactNode } from 'react'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// Define the possible screens
export type WidgetScreen = 'intro' | 'welcome' | 'pre-chat' | 'conversation'

export type NavigationDirection = 'forward' | 'backward'

interface WidgetNavigationContextType {
  currentScreen: WidgetScreen
  conversationId: string | null
  navigationDirection: NavigationDirection
  initialMessage: string | null
  navigateToIntro: () => void
  navigateToWelcome: () => void
  navigateToPreChat: () => void
  navigateToConversation: (conversationId: string | null) => void
  setInitialMessage: (msg: string | null) => void
  goBack: () => void
}

const WidgetNavigationContext = createContext<WidgetNavigationContextType | undefined>(undefined)

/**
 * Where a visitor lands when the widget opens: a returning visitor — one with
 * a token and a previous conversation (prefetched by the route loader) —
 * lands straight in that conversation; everyone else starts on the intro.
 */
function initialScreen(): { screen: WidgetScreen; id: string | null } {
  try {
    if (!tokenStorage.get(getWidgetId())) return { screen: 'intro', id: null }
    const cached = queryClient.getQueryData(ConversationsQueryOptions().queryKey)
    const ulid = cached?.data?.[0]?.ulid
    if (ulid) {
      logger.debug('WidgetNavigationProvider', 'Returning visitor, opening last conversation', { ulid })
      return { screen: 'conversation', id: ulid }
    }
  } catch (err) {
    logger.debug('WidgetNavigationProvider', 'Could not resolve initial screen', err)
  }
  return { screen: 'intro', id: null }
}

export function WidgetNavigationProvider({ children }: { children: ReactNode }) {
  // Returning visitors start in their conversation; new ones on the intro.
  const [initial] = useState(initialScreen)
  const [currentScreen, setCurrentScreen] = useState<WidgetScreen>(initial.screen)
  const [conversationId, setConversationId] = useState<string | null>(initial.id)
  const [navigationDirection, setNavigationDirection] = useState<NavigationDirection>('forward')
  const [initialMessage, setInitialMessage] = useState<string | null>(null)

  const navigateToIntro = () => {
    logger.debug('WidgetNavigationProvider', 'Navigating to intro screen')
    setNavigationDirection('backward') // Intro is a backward/start screen
    setCurrentScreen('intro')
    setConversationId(null)
  }

  const navigateToWelcome = () => {
    logger.debug('WidgetNavigationProvider', 'Navigating to welcome screen')
    setNavigationDirection('backward') // Welcome is always a back navigation
    setCurrentScreen('welcome')
    setConversationId(null)
  }

  const navigateToPreChat = () => {
    logger.debug('WidgetNavigationProvider', 'Navigating to pre-chat screen')
    setNavigationDirection('forward') // Pre-chat is a forward navigation
    setCurrentScreen('pre-chat')
    setConversationId(null)
  }

  const navigateToConversation = (id: string | null) => {
    logger.debug('WidgetNavigationProvider', 'Navigating to conversation screen', { conversationId: id })
    setNavigationDirection('forward') // Conversation is a forward navigation
    setCurrentScreen('conversation')
    setConversationId(id)
  }

  const goBack = () => {
    logger.debug('WidgetNavigationProvider', 'Going back')
    setNavigationDirection('backward') // goBack is always backward
    // Simple back navigation: conversation -> pre-chat -> intro
    if (currentScreen === 'conversation') {
      setCurrentScreen('pre-chat')
      setConversationId(null)
    } else if (currentScreen === 'pre-chat') {
      setCurrentScreen('intro')
      setConversationId(null)
    }
  }

  return (
    <WidgetNavigationContext.Provider
      value={{
        currentScreen,
        conversationId,
        navigationDirection,
        initialMessage,
        navigateToIntro,
        navigateToWelcome,
        navigateToPreChat,
        navigateToConversation,
        setInitialMessage,
        goBack,
      }}
    >
      {children}
    </WidgetNavigationContext.Provider>
  )
}

export function useWidgetNavigation() {
  const context = useContext(WidgetNavigationContext)
  if (context === undefined) {
    throw new Error('useWidgetNavigation must be used within a WidgetNavigationProvider')
  }
  return context
}
