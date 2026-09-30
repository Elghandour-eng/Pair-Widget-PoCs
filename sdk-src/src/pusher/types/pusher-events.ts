import type { Conversation } from '@/features/conversation/types/conversation'
import type { Message, InteractiveMetadata } from '@/features/conversation/types/message'

/**
 * Pusher subscription event data
 * This is the payload received when subscribing to a private channel
 */
export interface PusherSubscribeEventData {
  auth: string
  channel: Conversation['ulid']
}

/**
 * Pusher subscription event
 * Event type: "pusher:subscribe"
 */
export interface PusherSubscribeEvent {
  event: 'pusher:subscribe'
  data: PusherSubscribeEventData
}

/**
 * Pusher subscription succeeded event
 * Event type: "pusher:subscription_succeeded"
 */
export interface PusherSubscriptionSucceededEvent {
  event: 'pusher:subscription_succeeded'
  data?: Record<string, unknown>
  channel: Conversation['ulid']
}

/**
 * Pusher subscription error event
 * Event type: "pusher:subscription_error"
 */
export interface PusherSubscriptionErrorEvent {
  event: 'pusher:subscription_error'
  data?: {
    status?: number
    error?: string
  }
  channel: Conversation['ulid']
}

/**
 * New message event data structure
 * This is the payload received when a new message event is triggered
 */
export interface PusherNewMessageEventData {
  title?: string
  body?: string
  data: {
    message: {
      ulid: Message['ulid']
      type: string
      content: string
      message_type: Message['message_type']
      sender_type: 'contact' | 'agent' | 'human_agent' | 'ai_agent' | string
      sent_at: string
      status: 'sent' | 'pending' | 'failed' | string
      sender_name?: string
      sender_avatar?: string
      is_csat_survey: boolean
      media_url?: string
      metadata?: Record<string, unknown>
      interactive_metadata?: InteractiveMetadata
      next_messages?: Message['next_messages']
      next_msg_type?: Message['next_msg_type']
      next_msg?: Message['next_msg']
    }
    conversationUlid: Conversation['ulid']
    timestamp: string
  }
  eventName: 'new-message'
}

/**
 * New message event
 * Event type: "new_message" or "new-message"
 */
export interface PusherNewMessageEvent {
  event: 'new_message' | 'new-message'
  data: PusherNewMessageEventData | string // Can be stringified JSON or object
  channel: Conversation['ulid']
}

/**
 * Generic Pusher event structure
 */
export interface PusherEvent<T = unknown> {
  event: string
  data: T
  channel?: Conversation['ulid']
}

// ---------------------------------------------------------------------------
// AI Streaming Event Types
// ---------------------------------------------------------------------------

/**
 * Generic envelope wrapper for all Pusher events sent through the
 * notification driver. Event-specific payload lives under `data`.
 *
 * IMPORTANT: Do not read `stream_id`, `delta`, or `status` from the top level.
 */
export interface PusherEnvelope<T> {
  title: string
  body: string
  data: T
  priority?: string
  eventName: string
}

/**
 * Payload for `widget.thinking` events.
 * Emitted from a non-empty Dify `agent_thought`. Render as transient status
 * text, not as part of the answer. Treat as untrusted plain text.
 */
export interface WidgetThinkingData {
  conversation_id: string
  stream_id: string
  text: string
}

/**
 * Payload for `widget.message.delta` events.
 * Contains one answer fragment. `seq` is the ordering / dedup key within a
 * stream. Do NOT assume callback arrival order equals `seq` order.
 */
export interface WidgetDeltaData {
  conversation_id: string
  stream_id: string
  delta: string
  seq: number
}

/**
 * Payload for `widget.message.complete` events.
 * Means the processor observed Dify's end-of-message SSE event. Does NOT mean
 * the reply has been persisted. Keep the provisional bubble until `new-message`.
 */
export interface WidgetCompleteData {
  conversation_id: string
  stream_id: string
}

/**
 * Payload for `widget.typing` events.
 * Coarse fallback and lifecycle hint. `stop` is advisory and must not discard
 * an active streamed bubble.
 */
export interface WidgetTypingData {
  sender_type: 'ai' | 'agent' | 'system'
  sender_id: string | null
  sender_name: string | null
  status: 'start' | 'stop'
  conversation_id: string
  timestamp: string
}
