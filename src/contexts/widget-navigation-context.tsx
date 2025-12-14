import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { createContext, useContext, useState, type ReactNode } from 'react'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// Define the possible screens
export type WidgetScreen = 'welcome' | 'pre-chat' | 'conversation'

export type NavigationDirection = 'forward' | 'backward'

interface WidgetNavigationContextType {
  currentScreen: WidgetScreen
  conversationId: string | null
  navigationDirection: NavigationDirection
  navigateToWelcome: () => void
  navigateToPreChat: () => void
  navigateToConversation: (conversationId: string | null) => void
  goBack: () => void
}

const WidgetNavigationContext = createContext<WidgetNavigationContextType | undefined>(undefined)

export function WidgetNavigationProvider({ children }: { children: ReactNode }) {
  // Start with 'welcome' screen
  const [currentScreen, setCurrentScreen] = useState<WidgetScreen>('welcome')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [navigationDirection, setNavigationDirection] = useState<NavigationDirection>('forward')

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
    // Simple back navigation: conversation -> pre-chat -> welcome
    if (currentScreen === 'conversation') {
      setCurrentScreen('pre-chat')
      setConversationId(null)
    } else if (currentScreen === 'pre-chat') {
      setCurrentScreen('welcome')
      setConversationId(null)
    }
  }

  return (
    <WidgetNavigationContext.Provider
      value={{
        currentScreen,
        conversationId,
        navigationDirection,
        navigateToWelcome,
        navigateToPreChat,
        navigateToConversation,
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
