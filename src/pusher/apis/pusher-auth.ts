import { apiClient } from '@/core/http'
import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'
import { getWidgetId } from '@/utils/widget-id'

import { env } from '@/core/env'
import { mockPusherAuthResponse } from '@/features/conversation/mocks/mock-pusher-auth'
import type { PusherAuthRequest, PusherAuthResponse } from '../types/pusher-auth'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

/**
 * Authenticates a user for a Pusher private channel subscription
 * @param data - Authentication request containing socket_id and channel_name
 * @returns Authentication signature response
 */
export async function authenticatePusherChannel(data: PusherAuthRequest): Promise<PusherAuthResponse> {
  logger.debug('authenticatePusherChannel', 'Authenticating Pusher channel', {
    channelName: data.channel_name,
    socketId: data.socket_id,
  })

  const widgetId = getWidgetId()
  if (!widgetId) {
    logger.debug('authenticatePusherChannel', 'Widget ID is required to authenticate Pusher channel')
    throw new Error('Widget ID is required to authenticate Pusher channel')
  }

  if (env.useMock) {
    logger.debug('authenticatePusherChannel', 'Using mock Pusher authentication', mockPusherAuthResponse)
    return mockPusherAuthResponse
  }

  const response = await apiClient.post<PusherAuthResponse>(`v1/widget/${widgetId}/auth/pusher`, data)

  logger.debug('authenticatePusherChannel', 'Pusher channel authenticated successfully', {
    channelName: data.channel_name,
  })

  return response.data
}
