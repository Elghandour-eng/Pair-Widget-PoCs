import { useEffect, useRef } from 'react'

import type { Channel } from 'pusher-js'

import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface UsePusherEventOptions {
  /**
   * The Pusher channel instance
   */
  channel: Channel | null
  /**
   * The event name to listen to
   */
  eventName: string
  /**
   * Callback function when the event is received
   */
  callback: (data: unknown) => void
  /**
   * Whether the event listener is enabled
   */
  enabled?: boolean
}

/**
 * Hook to listen to Pusher channel events
 * Automatically binds and unbinds event listeners
 */
export function usePusherEvent(options: UsePusherEventOptions): void {
  const { channel, eventName, callback, enabled = true } = options
  const callbackRef = useRef(callback)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!channel || !enabled) {
      logger.debug('usePusherEvent', 'Skipping event binding', {
        hasChannel: !!channel,
        eventName,
        enabled,
      })
      return
    }

    logger.debug('usePusherEvent', 'Binding event listener', { eventName, channelName: channel.name })

    // Wrapper function that uses the latest callback
    const eventHandler = (data: unknown) => {
      logger.debug('usePusherEvent', 'Event received', { eventName, channelName: channel.name })
      callbackRef.current(data)
    }

    channel.bind(eventName, eventHandler)

    return () => {
      logger.debug('usePusherEvent', 'Unbinding event listener', { eventName, channelName: channel.name })
      channel.unbind(eventName, eventHandler)
    }
  }, [channel, eventName, enabled])
}
