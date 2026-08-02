import Pusher, { type Channel, type ChannelAuthorizationCallback } from 'pusher-js'

import { env } from '@/core/env'
import { authenticatePusherChannel } from '@/pusher/apis/pusher-auth'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

let pusherInstance: Pusher | null = null

/**
 * Gets or creates a Pusher client instance
 * @param config - Pusher configuration (appKey, cluster, etc.)
 * @returns Pusher client instance
 */
export function getPusherClient(): Pusher {
  if (pusherInstance) {
    logger.debug('getPusherClient', 'Returning existing Pusher instance')
    return pusherInstance
  }

  logger.debug('getPusherClient', 'Creating new Pusher instance', {
    appKey: env.pusherAppKey,
    cluster: env.pusherCluster,
  })

  const widgetId = getWidgetId()

  if (!widgetId) {
    logger.debug('getPusherClient', 'Widget ID is required to create Pusher instance')
    throw new Error('Widget ID is required to create Pusher instance')
  }

  pusherInstance = new Pusher(env.pusherAppKey, {
    cluster: env.pusherCluster,

    // Use custom authorizer to send JSON instead of form data
    authorizer: (channel: Channel) => {
      return {
        authorize: async (socketId: string, callback: ChannelAuthorizationCallback) => {
          const channelName = channel.name
          logger.debug('authorizer', 'Authorizing channel', {
            socketId,
            channelName,
          })

          try {
            const response = await authenticatePusherChannel({
              socket_id: socketId,
              channel_name: channelName,
            })

            logger.debug('authorizer', 'Channel authorized successfully', {
              channelName,
            })
            callback(null, { auth: response.auth })
          } catch (error) {
            logger.debug('authorizer', 'Channel authorization failed', {
              error,
              channelName,
            })
            callback(error instanceof Error ? error : new Error(String(error)), null)
          }
        },
      }
    },
  })

  // Set up connection event handlers
  pusherInstance.connection.bind('error', (err: Error) => {
    logger.debug('pusherClient', 'Pusher connection error', err)
  })

  pusherInstance.connection.bind('connected', () => {
    logger.debug('pusherClient', 'Pusher connected successfully')
  })

  pusherInstance.connection.bind('disconnected', () => {
    logger.debug('pusherClient', 'Pusher disconnected')
  })

  pusherInstance.connection.bind('state_change', (states: { previous: string; current: string }) => {
    logger.debug('pusherClient', 'Pusher connection state changed', states)
    // Dispatch reconnect event so the app can hydrate messages and clear stale streams
    if (states.current === 'connected' && states.previous !== 'initialized') {
      window.dispatchEvent(new CustomEvent('pusher:reconnected'))
    }
  })

  // Handle subscription errors
  pusherInstance.connection.bind('pusher:subscription_error', (status: number) => {
    logger.debug('pusherClient', 'Pusher subscription error', { status })
  })

  return pusherInstance
}

/**
 * Disconnects and cleans up the Pusher client instance
 */
export function disconnectPusher(): void {
  if (pusherInstance) {
    logger.debug('disconnectPusher', 'Disconnecting Pusher client')
    pusherInstance.disconnect()
    pusherInstance = null
  }
}
