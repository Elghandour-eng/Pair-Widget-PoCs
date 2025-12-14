import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import { routeTree } from '@/routeTree.gen'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import './styles.css'
import { createDebugLogger, getFilePathFromUrl } from './utils/logger'

import { checkAndRemoveExpiredTokens } from './core/token-expiration'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

// Check for expired tokens before anything else
checkAndRemoveExpiredTokens()

logger.debug('main', 'Application initialization started')

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

logger.debug('main', 'Router created')

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  logger.debug('main', 'Root element found, creating React root')
  const root = ReactDOM.createRoot(rootElement)
  logger.debug('main', 'Rendering application')
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
  logger.debug('main', 'Application rendered successfully')
} else {
  logger.debug('main', 'Root element not found or already has content', {
    hasElement: !!rootElement,
    hasContent: rootElement?.innerHTML ? true : false,
  })
}
