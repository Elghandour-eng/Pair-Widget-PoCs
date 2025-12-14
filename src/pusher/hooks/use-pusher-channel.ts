import { useEffect, useRef, useState } from 'react'

import Pusher from 'pusher-js'

import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

import type { Channel } from 'pusher-js'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

export interface UsePusherChannelOptions {
  /**
   * The Pusher client instance
   */
  pusher: Pusher | null
  /**
   * The channel name to subscribe to (e.g., "private-conversation-01ARZ3NDEKTSV4RRFFQ69G5FAV")
   */
  channelName: string | null
  /**
   * Whether the channel subscription is enabled
   */
  enabled?: boolean
  /**
   * Callback when channel subscription succeeds
   */
  onSubscriptionSucceeded?: () => void
  /**
   * Callback when channel subscription fails
   */
  onSubscriptionError?: (error: Error) => void
}

export interface UsePusherChannelReturn {
  /**
   * The Pusher channel instance (null if not subscribed)
   */
  channel: Channel | null
  /**
   * Whether the channel is currently subscribed
   */
  isSubscribed: boolean
  /**
   * Whether the channel subscription is in progress
   */
  isSubscribing: boolean
  /**
   * Any error that occurred during subscription
   */
  error: Error | null
}

/**
 * Hook to subscribe to a Pusher channel
 * Handles private channel authentication automatically
 */
export function usePusherChannel(options: UsePusherChannelOptions): UsePusherChannelReturn {
  const { pusher, channelName, enabled = true, onSubscriptionSucceeded, onSubscriptionError } = options

  const [channel, setChannel] = useState<Channel | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<Channel | null>(null)

  useEffect(() => {
    if (!pusher || !channelName || !enabled) {
      logger.debug('usePusherChannel', 'Skipping subscription', {
        hasPusher: !!pusher,
        hasChannelName: !!channelName,
        enabled,
      })
      setChannel(null)
      setIsSubscribed(false)
      setIsSubscribing(false)
      setError(null)
      return
    }

    // Unsubscribe from previous channel if channel name changed
    if (channelRef.current && channelRef.current.name !== channelName) {
      logger.debug('usePusherChannel', 'Unsubscribing from previous channel', {
        previousChannel: channelRef.current.name,
      })
      pusher.unsubscribe(channelRef.current.name)
      channelRef.current = null
      setChannel(null)
      setIsSubscribed(false)
    }

    // If already subscribed to this channel, return
    if (channelRef.current?.name === channelName && isSubscribed) {
      return
    }

    logger.debug('usePusherChannel', 'Subscribing to channel', { channelName })
    setIsSubscribing(true)
    setError(null)

    try {
      // Check if it's a private channel
      const isPrivateChannel = channelName.startsWith('private-')

      let pusherChannel: Channel

      if (isPrivateChannel) {
        // For private channels, pusher-js will automatically call the authEndpoint
        // configured in the Pusher client options
        pusherChannel = pusher.subscribe(channelName)
      } else {
        pusherChannel = pusher.subscribe(channelName)
      }

      channelRef.current = pusherChannel

      // Handle subscription success
      pusherChannel.bind('pusher:subscription_succeeded', () => {
        logger.debug('usePusherChannel', 'Channel subscription succeeded', { channelName })
        setIsSubscribed(true)
        setIsSubscribing(false)
        setChannel(pusherChannel)
        onSubscriptionSucceeded?.()
      })

      // Handle subscription error
      pusherChannel.bind('pusher:subscription_error', (status: number) => {
        const error = new Error(`Failed to subscribe to channel: ${channelName} (status: ${status})`)
        logger.debug('usePusherChannel', 'Channel subscription error', { channelName, status })
        setIsSubscribed(false)
        setIsSubscribing(false)
        setError(error)
        onSubscriptionError?.(error)
      })

      setChannel(pusherChannel)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error subscribing to channel')
      logger.debug('usePusherChannel', 'Error subscribing to channel', { channelName, error })
      setIsSubscribed(false)
      setIsSubscribing(false)
      setError(error)
      onSubscriptionError?.(error)
    }

    // Cleanup function
    return () => {
      if (channelRef.current && channelRef.current.name === channelName) {
        logger.debug('usePusherChannel', 'Unsubscribing from channel', { channelName })
        pusher.unsubscribe(channelName)
        channelRef.current = null
        setChannel(null)
        setIsSubscribed(false)
        setIsSubscribing(false)
        setError(null)
      }
    }
  }, [pusher, channelName, enabled, onSubscriptionSucceeded, onSubscriptionError, isSubscribed])

  return {
    channel,
    isSubscribed,
    isSubscribing,
    error,
  }
}
