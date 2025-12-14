import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'

interface WidgetUIContextType {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  toggle: () => void
  closeWidget: () => void // Request SDK to close the widget
  setBubbleColor: (color: string) => void // Update SDK bubble color
}

const WidgetUIContext = createContext<WidgetUIContextType | undefined>(undefined)

// Check if we're in SDK mode (embedded in iframe)
function isInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

// Check if widget is in SDK mode
function isSdkMode(): boolean {
  // Check URL param
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('sdkMode') === 'true') {
    return true
  }
  // Check if in iframe
  return isInIframe()
}

// Send message to parent (SDK)
function sendToParent(type: string, data?: Record<string, unknown>) {
  if (isInIframe() && window.parent) {
    window.parent.postMessage({ type, ...data }, '*')
  }
}

export function WidgetUIProvider({ children }: { children: ReactNode }) {
  // In SDK mode (iframe), widget is always "open" - SDK controls visibility via container
  // In standalone mode, widget starts closed
  const [isOpen, setIsOpenState] = useState(isSdkMode())

  const setIsOpen = useCallback((newIsOpen: boolean) => {
    setIsOpenState(newIsOpen)
  }, [])

  const toggle = useCallback(() => {
    setIsOpenState((prev) => !prev)
  }, [])

  // Request SDK to close the widget (used when user clicks close inside widget)
  const closeWidget = useCallback(() => {
    sendToParent('widget:close')
  }, [])

  // Update SDK bubble color
  const setBubbleColor = useCallback((color: string) => {
    sendToParent('widget:setColor', { color })
  }, [])

  // Listen for SDK messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return
      if (!event.data.type) return

      console.log('[Widget] Received message:', event.data.type)

      switch (event.data.type) {
        case 'sdk:opened':
          setIsOpenState(true)
          break
        case 'sdk:closed':
          setIsOpenState(false)
          break
        case 'sdk:config':
          // SDK sent config, we could use this for additional settings
          console.log('[Widget] Received config from SDK:', event.data.data)
          break
        case 'sdk:toggle':
          if (event.data.data?.show !== undefined) {
            setIsOpenState(event.data.data.show)
          } else {
            setIsOpenState((prev) => !prev)
          }
          break
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Send ready message when widget is mounted
  // This will be called after config is loaded (due to Suspense)
  useEffect(() => {
    sendToParent('widget:ready')
  }, [])

  return (
    <WidgetUIContext.Provider value={{ isOpen, setIsOpen, toggle, closeWidget, setBubbleColor }}>
      {children}
    </WidgetUIContext.Provider>
  )
}

export function useWidgetUIContext() {
  const context = useContext(WidgetUIContext)
  if (context === undefined) {
    throw new Error('useWidgetUIContext must be used within a WidgetUIProvider')
  }
  return context
}
