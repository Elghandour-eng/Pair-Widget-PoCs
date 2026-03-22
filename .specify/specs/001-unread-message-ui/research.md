# Research: Incoming Message UI

**Branch**: `001-unread-message-ui` | **Date**: 2026-03-22 | **Spec**: [spec.md](../spec.md)

## Research Summary

Research conducted by exploring the existing codebase to understand current architecture, state management, real-time messaging, and component patterns.

## Findings

### 1. Widget Open/Close State

- **Decision**: Use existing `useWidgetUIContext()` which exposes `isOpen`, `setIsOpen`, `toggle`.
- **Rationale**: Already manages open/close state and SDK ↔ iframe communication. The new message preview only renders when `!isOpen` (standalone mode only).
- **Alternatives considered**: Creating a separate context → rejected because `isOpen` is already sufficient to gate the preview.

### 2. Unread Messages & Latest Message Content

- **Decision**: Extend `UnreadMessagesContext` to also store the latest incoming message data (content + sender info), not just message IDs.
- **Rationale**: Currently, `UnreadMessagesContext` stores `UnreadMessage { messageId, conversationId, timestamp }` only. The preview UI needs the message `content`, `sender_name`/`sender_type`, and `sender_avatar` to display the preview. The Pusher event data (`PusherNewMessageEventData`) already contains all of this via `data.message`.
- **Alternatives considered**: Fetching the message from the API cache → rejected because the Pusher event already delivers all needed data in real-time; no need for an extra query.

### 3. Widget Position (Corner Radius Logic)

- **Decision**: Read `widgetConfig.position` (`'left' | 'right'`) from `useWidgetConfigContext()`. Apply `rounded-br-none` for right-aligned widgets and `rounded-bl-none` for left-aligned widgets.
- **Rationale**: Position is already available globally. Design reference image shows a sharp bottom-right corner.

### 4. Reset / Dismiss Logic

- **Decision**: Track `isPreviewDismissed` boolean state. Reset on: close button click, "See new messages" click, or widget open (`toggle`/`setIsOpen(true)`). Each new incoming message resets `isPreviewDismissed = false`.
- **Rationale**: All three interactions are variations of the user acknowledging the incoming message.

### 5. SDK Architecture — Separate DOM Holders (Critical Finding)

- **Decision**: Create a third DOM holder (`pair-ai-preview-holder`) in the SDK for the preview UI, separate from both `pair-ai-bubble-holder` and `pair-ai-widget-holder`.
- **Rationale**: The widget in SDK mode runs inside an iframe. The iframe's DOM boundary means elements cannot render outside the iframe rectangle. The preview needs to float above the bubble without blocking the host website. Just like the bubble holder and widget holder are separate fixed-position elements with minimal footprint, the preview holder must also be a separate element to avoid creating a large invisible click-blocking area.
- **Alternatives considered**:
  - Rendering inside the widget iframe → rejected because the iframe is either hidden (widget closed) or positioned as a panel, so the preview would be clipped or invisible.
  - Expanding the widget iframe to include the preview area → rejected because this would create a large invisible region blocking clicks on the host website.

### 6. PostMessage Protocol for Preview Data

- **Decision**: Add two new postMessage event types:
  - `widget:previewMessage` — widget sends preview data (content, sender name/avatar, unread count) to SDK.
  - `widget:dismissPreview` — widget tells SDK to hide the preview.
  - `sdk:dismissPreview` — SDK tells widget that preview was dismissed from SDK side (e.g., user clicked close on SDK-rendered preview).
- **Rationale**: Follows the existing pattern used by `widget:unreadCount`, `widget:close`, `widget:setColor`, etc. The widget already communicates state changes to the SDK via `sendToParent()` in `widget-unread-sync.tsx`.

### 7. Component Location (Standalone Mode)

- **Decision**: Create a new component `IncomingMessagePreview` under `src/components/`. Render it in `widget-layout.tsx` between the `AnimatePresence` panel block and the `WidgetEye` component.
- **Rationale**: `widget-layout.tsx` is where standalone rendering happens, and this preview is a standalone-mode-only UI that sits visually between the chat panel and the bubble button.

### 8. Rendering Framework

- **Decision**: Use `framer-motion` (`AnimatePresence` + `motion.div`) for enter/exit animations in standalone mode. Use CSS transitions for SDK mode (vanilla JS).
- **Rationale**: Standalone mode already uses framer-motion consistently. SDK uses vanilla CSS animations.
