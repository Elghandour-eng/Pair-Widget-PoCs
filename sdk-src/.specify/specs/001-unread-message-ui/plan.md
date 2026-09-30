# Implementation Plan: Incoming Message UI

**Branch**: `001-unread-message-ui` | **Date**: 2026-03-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-unread-message-ui/spec.md`

## Summary

When the chat widget is closed and a new message arrives via Pusher, display a floating preview popup showing the sender's avatar, name, message content, a "Close" button, and a "See new messages" action. The preview container has rounded corners with a sharp bottom-right or bottom-left corner depending on widget position. Dismiss the preview when the user clicks Close, clicks "See new messages" (which also opens the widget), or opens the widget directly. If there are multiple unread messages, show a small badge with the total count.

> [!IMPORTANT]
> **SDK Architecture Consideration**: The widget operates in two modes:
> - **Standalone mode**: Widget renders directly in the page — preview can be a React component rendered alongside the widget eye.
> - **SDK mode**: Widget lives inside an iframe. The SDK creates separate fixed-position DOM elements (`pair-ai-bubble-holder`, `pair-ai-widget-holder`) on the host page. A new `pair-ai-preview-holder` element must be created by the SDK to render the preview **outside the iframe** so it doesn't block host website clicks.

## Technical Context

**Language/Version**: TypeScript (React 18+), Vanilla JS (SDK)  
**Primary Dependencies**: React, framer-motion, lucide-react, TanStack Router, Pusher  
**Storage**: N/A (in-memory React state)  
**Testing**: No existing test suite found  
**Target Platform**: Browser (embedded widget, standalone + SDK mode)  
**Project Type**: Web widget (frontend-only)  
**Constraints**: Must work inside iframe (SDK mode), preview must use separate DOM holder to avoid blocking host website, must not break existing unread badge logic

## Constitution Check

_GATE: Constitution is a template placeholder with no project-specific gates defined. No violations._

## Project Structure

### Documentation (this feature)

```text
specs/001-unread-message-ui/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (files to create/modify)

```text
src/
├── contexts/
│   └── unread-messages-context.tsx    # [MODIFY] Add lastIncomingMessage + dismissPreview state
├── components/
│   ├── incoming-message-preview.tsx   # [NEW] Preview popup component (standalone mode)
│   ├── widget-layout.tsx              # [MODIFY] Render IncomingMessagePreview in standalone mode
│   ├── widget-unread-sync.tsx         # [MODIFY] Send preview data to SDK via postMessage
│   └── widget-eye/
│       └── components/
│           └── widget-eye.tsx         # [MODIFY] Dismiss preview on widget toggle

public/
├── sdk.js                             # [MODIFY] Add preview holder, render/dismiss preview
└── sdk.css                            # [MODIFY] Add styles for preview holder and preview UI
```

---

## Phase 1: Detailed Design

### 1. Extend `UnreadMessagesContext` (`unread-messages-context.tsx`)

**Add new interface:**
```ts
interface LastIncomingMessage {
  messageId: string
  conversationId: string
  content: string
  senderName: string | undefined
  senderAvatar: string | undefined
  timestamp: number
}
```

**Add new state:**
- `lastIncomingMessage: LastIncomingMessage | null` — stores the latest non-contact message data.
- `isPreviewDismissed: boolean` — tracks whether the user has dismissed the current preview.

**Add new functions to context type:**
- `dismissPreview()` — sets `isPreviewDismissed = true`.

**Modify existing `handleNewMessage` logic (inside both `subscribeToConversation` and `initializeSubscriptions`):**
- When a non-contact, non-system message arrives, also update `lastIncomingMessage` with content and sender info from `parsedData.data.message`.
- Set `isPreviewDismissed = false` so the preview becomes visible again.

---

### 2. Create `IncomingMessagePreview` component (`incoming-message-preview.tsx`)

> Used in **standalone mode only** (when widget is NOT inside an iframe).

**Layout (matching the design reference):**
1. **Close button** — top-right, pill-shaped `"✕ Close"` button.
2. **Message container** — white rounded card with:
   - Sharp bottom-right corner (`rounded-br-none`) when `widgetConfig.position === 'right'`
   - Sharp bottom-left corner (`rounded-bl-none`) when `widgetConfig.position === 'left'`
3. **Header row** — avatar (using `WidgetAvatar` with `showIconFallback={true}`) + `"From {widgetConfig.name}"` heading text + bottom border.
4. **Message body** — the message content text.
5. **See new messages button** — text button with right arrow icon (`→ See new messages`).
6. **Unread badge** — if `totalUnreadCount > 1`, display a small badge with the count.

**Visibility logic:**
- Render only when: `!isOpen && lastIncomingMessage !== null && !isPreviewDismissed`.

**Interactions:**
- Close button → call `dismissPreview()`.
- "See new messages" → call `dismissPreview()` + `setIsOpen(true)`.
- Animations: use `AnimatePresence` + `motion.div` for slide-in/out.

---

### 3. Integrate into `widget-layout.tsx`

- In standalone mode only (when `!widgetConfig.sdkMode`), render `<IncomingMessagePreview />` between the `AnimatePresence` (chat panel) block and the `<WidgetEye />` component.
- SDK mode rendering is handled by the SDK itself (see section 6).

---

### 4. Dismiss on widget toggle (`widget-eye.tsx`)

- In the `handleClick` function, if the widget is being opened (`!isOpen → true`), also call `dismissPreview()` from `UnreadMessagesContext`.

---

### 5. Send preview data to SDK (`widget-unread-sync.tsx`)

**Add a new `useEffect`** that watches `lastIncomingMessage` and `isPreviewDismissed`:
- When `lastIncomingMessage` changes and `!isPreviewDismissed`, send a `widget:previewMessage` postMessage to the parent with the message data:
  ```ts
  sendToParent('widget:previewMessage', {
    message: {
      content: lastIncomingMessage.content,
      senderName: lastIncomingMessage.senderName,
      senderAvatar: lastIncomingMessage.senderAvatar,
    },
    unreadCount: totalUnreadCount,
  })
  ```
- When `isPreviewDismissed` becomes `true`, send `widget:dismissPreview` to the parent:
  ```ts
  sendToParent('widget:dismissPreview')
  ```

---

### 6. SDK Changes (`sdk.js`)

**New constant:**
```js
var PREVIEW_HOLDER_ID = 'pair-ai-preview-holder'
```

**New state variable:**
```js
var previewHolder = null
```

**New function `createPreviewHolder()`** — creates the third DOM holder:
- Creates a `div` with `id="pair-ai-preview-holder"`.
- Positioned with `position: fixed`, aligned to the same side as the bubble (`right: 20px` or `left: 20px`).
- Sits above the bubble and below the panel (`bottom: 104px`).
- Starts hidden.
- Appended to `document.body`.

**New function `showPreview(data)`** — renders the preview HTML inside the holder:
- Builds an HTML structure matching the design:
  - Close button (top-right pill)
  - Message card with avatar, "From {name}" header, border, message content
  - "See new messages" text button
  - Optional unread count badge
- Adds event listeners for Close and "See new messages" buttons.
- Close → hides the preview holder, sends `sdk:dismissPreview` to widget iframe.
- "See new messages" → hides the preview holder, opens the widget (`toggleWidget(true)`), sends `sdk:dismissPreview` to widget iframe.

**New function `hidePreview()`** — hides the preview holder.

**Update `setupMessageListener()`** — handle new message types:
```js
case 'widget:previewMessage':
  // Show preview if widget is closed
  if (!isOpen) {
    showPreview(event.data)
  }
  break
case 'widget:dismissPreview':
  hidePreview()
  break
```

**Update `toggleWidget()`:**
- When opening the widget (`isOpen = true`), also call `hidePreview()`.

**Update `init()`:**
- Add `createPreviewHolder()` call after `createWidgetHolder()`.

---

### 7. SDK CSS Changes (`sdk.css`)

**Add new `#pair-ai-preview-holder` styles:**
```css
#pair-ai-preview-holder {
  position: fixed;
  bottom: 104px;
  z-index: 2147483000;
  max-width: 340px;
  display: none; /* hidden by default */
}

#pair-ai-preview-holder.pair-ai-preview--visible {
  display: block;
}
```

**Add preview card styles:**
- `.pair-ai-preview-close` — pill close button
- `.pair-ai-preview-card` — white rounded card with shadow
- `.pair-ai-preview-card--right` — `border-bottom-right-radius: 0`
- `.pair-ai-preview-card--left` — `border-bottom-left-radius: 0`
- `.pair-ai-preview-header` — avatar + name row with bottom border
- `.pair-ai-preview-body` — message content area
- `.pair-ai-preview-action` — "See new messages" text button
- `.pair-ai-preview-badge` — unread count badge

**Add mobile responsive rules** — hide preview on mobile (widget goes fullscreen anyway):
```css
@media (max-width: 667px) {
  #pair-ai-preview-holder {
    display: none !important;
  }
}
```

---

## Verification Plan

### Manual Verification

Since there is no test suite in this project, verification will be manual:

#### Standalone Mode Testing
1. **Run the dev server**: `pnpm dev` from the project root.
2. Open the widget in a browser in standalone mode (direct URL, not via SDK).
3. Close the widget so only the bubble button is visible.
4. **Trigger a Pusher message** (send a message from the agent/bot side through the backend).
5. **Verify** the incoming message preview popup appears showing:
   - The "✕ Close" button at the top.
   - The avatar + "From {name}" header with a bottom border.
   - The message content text.
   - The "→ See new messages" button at the bottom.
6. **Click "Close"** → verify the preview disappears, only the bubble remains.
7. **Trigger another message** → verify the preview reappears with the new message.
8. **Click "See new messages"** → verify the preview disappears AND the widget opens.
9. **Close the widget again, trigger a message, then click the widget bubble** → verify the preview dismisses when the widget opens.
10. **Trigger multiple messages** → verify the badge shows the total unread count and only the last message content is displayed.
11. **Test with `position: 'left'`** → verify the sharp corner is on the bottom-left instead of bottom-right.

#### SDK Mode Testing
12. Open `simple-example.html` in a browser (uses the SDK to embed the widget via iframe).
13. Repeat steps 3–11 above, verifying the preview is rendered **by the SDK on the host page** (not inside the iframe).
14. **Inspect the DOM** — verify `pair-ai-preview-holder` exists as a sibling of `pair-ai-bubble-holder` and `pair-ai-widget-holder` on the host page body.
15. **Click on the host website behind the preview** — verify clicks pass through to the host page (the preview holder doesn't block unrelated areas).
