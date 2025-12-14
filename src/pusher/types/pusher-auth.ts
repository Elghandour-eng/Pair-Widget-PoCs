/**
 * Request payload for Pusher private channel authentication
 */
export interface PusherAuthRequest {
  socket_id: string
  channel_name: string
}

/**
 * Response from Pusher authentication endpoint
 */
export interface PusherAuthResponse {
  auth: string
}
