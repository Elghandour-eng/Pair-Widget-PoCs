import { QueryClient } from '@tanstack/react-query'

import { createDebugLogger, getFilePathFromUrl } from './utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

logger.debug('queryClient', 'Creating QueryClient instance')
export const queryClient = new QueryClient()
logger.debug('queryClient', 'QueryClient created successfully')
