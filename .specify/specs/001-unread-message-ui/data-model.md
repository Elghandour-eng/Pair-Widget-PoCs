# Data Model: Incoming Message UI

**Branch**: `001-unread-message-ui` | **Date**: 2026-03-22

## Entity: `LastIncomingMessage`

Represents the most recently received incoming message to display in the preview popup.

| Field            | Type     | Description                                    |
|------------------|----------|------------------------------------------------|
| `messageId`      | `string` | Unique message identifier (ulid)               |
| `conversationId` | `string` | Conversation this message belongs to           |
| `content`        | `string` | Text content of the message                    |
| `senderName`     | `string` | Display name of the sender (from Pusher event) |
| `senderAvatar`   | `string` | Avatar URL of the sender (from Pusher event)   |
| `timestamp`      | `number` | Unix timestamp when the message was received   |

## State: `IncomingMessagePreview` (added to `UnreadMessagesContext`)

| Field                  | Type                           | Description                                                        |
|------------------------|--------------------------------|--------------------------------------------------------------------|
| `lastIncomingMessage`  | `LastIncomingMessage \| null`  | The most recent non-contact message for the preview UI             |
| `isPreviewDismissed`   | `boolean`                      | Whether the user has dismissed the preview for the current message |

## State Transitions

```
[No message] 
  → New Pusher message received (sender_type ≠ 'contact' & ≠ 'system', widget closed)
  → [Preview visible: lastIncomingMessage set, isPreviewDismissed = false]

[Preview visible]
  → User clicks "Close" button 
  → [Preview hidden: isPreviewDismissed = true]

[Preview visible]
  → User clicks "See new messages" 
  → [Preview hidden: isPreviewDismissed = true, widget opens]

[Preview visible]
  → User clicks widget eye (opens widget)
  → [Preview hidden: isPreviewDismissed = true]

[Preview hidden]
  → New Pusher message received (sender_type ≠ 'contact' & ≠ 'system', widget closed)
  → [Preview visible: lastIncomingMessage updated, isPreviewDismissed = false]
```
