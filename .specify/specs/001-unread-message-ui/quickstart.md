# Quickstart: Incoming Message UI

## What this feature does

Displays a floating message preview popup when a new message arrives while the chat widget is closed. Shows the sender's avatar, name, message content, and action buttons ("Close" and "See new messages"). Replaces the current behavior of only showing an unread counter on the bubble.

## Key files

| File | Role |
|------|------|
| `src/contexts/unread-messages-context.tsx` | Extended to store `lastIncomingMessage` and `isPreviewDismissed` |
| `src/components/incoming-message-preview.tsx` | **New** — preview popup component (standalone mode) |
| `src/components/widget-layout.tsx` | Modified to render preview in standalone mode |
| `src/components/widget-unread-sync.tsx` | Modified to send preview data to SDK via postMessage |
| `src/components/widget-eye/components/widget-eye.tsx` | Modified to dismiss preview on toggle |
| `public/sdk.js` | **Modified** — adds preview holder + renders preview in SDK mode |
| `public/sdk.css` | **Modified** — styles for preview holder and preview UI |

## How it works

### Standalone mode (direct rendering)
1. Pusher delivers a new message event → `unread-messages-context` stores the message data in `lastIncomingMessage` and sets `isPreviewDismissed = false`.
2. `IncomingMessagePreview` checks: `!isOpen && lastIncomingMessage && !isPreviewDismissed` → renders the preview popup.
3. User dismisses via Close button, "See new messages" (opens widget), or clicking the bubble → `isPreviewDismissed` is set to `true`.

### SDK mode (iframe rendering)
1. Same Pusher flow stores `lastIncomingMessage` inside the iframe.
2. `widget-unread-sync.tsx` sends `widget:previewMessage` postMessage to the parent SDK.
3. SDK receives the message and renders the preview natively in a `pair-ai-preview-holder` div on the host page.
4. User dismisses from the host page → SDK sends `sdk:dismissPreview` back to the iframe.

## Running locally

```bash
pnpm dev
```
