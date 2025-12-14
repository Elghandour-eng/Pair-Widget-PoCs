import { useEffect, useState } from 'react'

import type Pusher from 'pusher-js'

import { getPusherClient } from '@/pusher/utils/pusher-client'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Hook to initialize and manage Pusher client
 * @param config - Pusher configuration (optional, will use env vars if not provided)
 * @returns Pusher client instance
 */
export function usePusher() {
  const [pusher, setPusher] = useState<Pusher | null>(null)

  useEffect(() => {
    logger.debug('usePusher', 'Initializing Pusher client')
    const client = getPusherClient()
    setPusher(client)

    return () => {
      logger.debug('usePusher', 'Cleaning up Pusher client')
      // Note: We don't disconnect here as other components might be using it
      // The disconnect should be handled at the app level when needed
    }
  }, [])

  return pusher
}
