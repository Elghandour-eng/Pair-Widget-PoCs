# Pusher Integration

This module provides Pusher integration for real-time communication in the widget. It supports private channel authentication and subscription.

## Features

- Private channel authentication via API endpoint
- React hooks for easy integration
- Automatic channel subscription management
- Event listening utilities
- Type-safe implementation

## Setup

### 1. Configure Pusher

You need to provide Pusher configuration (appKey, cluster) when initializing the client. This can come from:

- Environment variables
- Widget configuration API
- Manual configuration

### 2. Initialize Pusher Client

```tsx
import { usePusher } from '@/pusher'
import type { PusherConfig } from '@/pusher'

function MyComponent() {
  const pusherConfig: PusherConfig = {
    appKey: 'your-pusher-app-key',
    cluster: 'your-pusher-cluster',
    // authEndpoint is optional - will be auto-generated from widgetId
  }

  const pusher = usePusher(pusherConfig)

  // Use pusher instance...
}
```

## Usage Examples

### Subscribe to a Private Conversation Channel

```tsx
import { usePusher, usePusherChannel, usePusherEvent, getPrivateConversationChannelName } from '@/pusher'
import type { PusherConfig } from '@/pusher'

function ConversationComponent({ conversationId }: { conversationId: string }) {
  const pusherConfig: PusherConfig = {
    appKey: 'your-app-key',
    cluster: 'your-cluster',
  }

  const pusher = usePusher(pusherConfig)
  const channelName = getPrivateConversationChannelName(conversationId)

  const { channel, isSubscribed, isSubscribing, error } = usePusherChannel({
    pusher,
    channelName,
    enabled: true,
    onSubscriptionSucceeded: () => {
      console.log('Subscribed to conversation channel')
    },
    onSubscriptionError: (error) => {
      console.error('Failed to subscribe:', error)
    },
  })

  // Listen to new messages
  usePusherEvent({
    channel,
    eventName: 'new_message',
    callback: (data) => {
      console.log('New message received:', data)
      // Handle new message
    },
    enabled: isSubscribed,
  })

  if (isSubscribing) {
    return <div>Connecting...</div>
  }

  if (error) {
    return <div>Error: {error.message}</div>
  }

  if (!isSubscribed) {
    return <div>Not subscribed</div>
  }

  return <div>Listening for messages...</div>
}
```

### API Authentication

The authentication is handled automatically by the Pusher client. When you subscribe to a private channel, pusher-js will:

1. Make a POST request to `/v1/widget/{widgetId}/auth/pusher`
2. Send `socket_id` and `channel_name` in the request body
3. Include the JWT token from localStorage in the Authorization header
4. Receive `{ auth: "..." }` response
5. Use the auth signature to complete the subscription

### Channel Names

Use the utility functions to generate channel names:

```tsx
import { getPrivateConversationChannelName, extractConversationIdFromChannelName } from '@/pusher'

// Generate channel name from conversation ID
const channelName = getPrivateConversationChannelName('01ARZ3NDEKTSV4RRFFQ69G5FAV')
// Returns: "private-conversation-01ARZ3NDEKTSV4RRFFQ69G5FAV"

// Extract conversation ID from channel name
const conversationId = extractConversationIdFromChannelName('private-conversation-01ARZ3NDEKTSV4RRFFQ69G5FAV')
// Returns: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
```

## API Reference

### Hooks

#### `usePusher(config: PusherConfig | null)`

Initializes and returns a Pusher client instance.

**Parameters:**

- `config`: Pusher configuration object or null

**Returns:** Pusher client instance or null

#### `usePusherChannel(options: UsePusherChannelOptions)`

Subscribes to a Pusher channel and manages subscription state.

**Parameters:**

- `pusher`: Pusher client instance
- `channelName`: Channel name to subscribe to
- `enabled`: Whether subscription is enabled (default: true)
- `onSubscriptionSucceeded`: Callback when subscription succeeds
- `onSubscriptionError`: Callback when subscription fails

**Returns:**

- `channel`: Channel instance or null
- `isSubscribed`: Whether currently subscribed
- `isSubscribing`: Whether subscription is in progress
- `error`: Any error that occurred

#### `usePusherEvent(options: UsePusherEventOptions)`

Listens to events on a Pusher channel.

**Parameters:**

- `channel`: Channel instance
- `eventName`: Event name to listen to
- `callback`: Callback function when event is received
- `enabled`: Whether listener is enabled (default: true)

### Utilities

#### `getPusherClient(config: PusherConfig)`

Gets or creates a Pusher client instance (singleton).

#### `disconnectPusher()`

Disconnects and cleans up the Pusher client.

#### `getPrivateConversationChannelName(conversationId: string)`

Generates a private channel name for a conversation.

#### `extractConversationIdFromChannelName(channelName: string)`

Extracts conversation ID from a channel name.

### API Functions

#### `authenticatePusherChannel(data: PusherAuthRequest)`

Authenticates a user for a Pusher private channel subscription. This is called automatically by pusher-js, but can be used manually if needed.

## Notes

- The Pusher client is a singleton - only one instance is created
- Private channel authentication requires a valid JWT token in localStorage
- Channel subscriptions are automatically cleaned up when components unmount
- Event listeners are automatically bound/unbound when dependencies change
