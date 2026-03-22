# Tasks: Incoming Message UI

**Input**: Design documents from `/specs/001-unread-message-ui/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No tests requested. Implementation tasks only.

**Organization**: Tasks are grouped by user story. Tasks are intentionally granular for easier execution by a cheaper model.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project initialization needed. This phase covers shared type/interface changes used by multiple later tasks.

- [x] T001 Add `LastIncomingMessage` interface to `src/contexts/unread-messages-context.tsx`. Add it above the existing `UnreadMessagesContextType` interface. Fields: `messageId: string`, `conversationId: string`, `content: string`, `senderName: string | undefined`, `senderAvatar: string | undefined`, `timestamp: number`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend `UnreadMessagesContext` with the new state and functions that all user stories depend on.

**⚠️ CRITICAL**: All user story work depends on this phase being complete.

- [x] T002 Add state variables to `UnreadMessagesProvider` in `src/contexts/unread-messages-context.tsx`. Add `const [lastIncomingMessage, setLastIncomingMessage] = useState<LastIncomingMessage | null>(null)` and `const [isPreviewDismissed, setIsPreviewDismissed] = useState(true)`. Place these right after the existing `viewingState` useState.

- [x] T003 Add `dismissPreview` callback function to `UnreadMessagesProvider` in `src/contexts/unread-messages-context.tsx`. It should be a `useCallback` that calls `setIsPreviewDismissed(true)`. Place it after the existing `setViewingConversation` callback.

- [x] T004 Update `UnreadMessagesContextType` interface in `src/contexts/unread-messages-context.tsx`. Add three new members: `lastIncomingMessage: LastIncomingMessage | null`, `isPreviewDismissed: boolean`, and `dismissPreview: () => void`.

- [x] T005 Update the `UnreadMessagesContext.Provider` value object in `src/contexts/unread-messages-context.tsx`. Add `lastIncomingMessage`, `isPreviewDismissed`, and `dismissPreview` to the value prop alongside the existing properties.

- [x] T006 Update the `handleNewMessage` function inside `subscribeToConversation` in `src/contexts/unread-messages-context.tsx`. After the existing `addUnreadMessage(conversationId, message.ulid)` call (inside the `if (message.sender_type !== 'contact' && message.sender_type !== 'system')` block), add: `setLastIncomingMessage({ messageId: message.ulid, conversationId, content: message.content, senderName: message.sender_name, senderAvatar: message.sender_avatar, timestamp: Date.now() })` and `setIsPreviewDismissed(false)`.

- [x] T007 Update the `handleNewMessage` function inside `initializeSubscriptions` in `src/contexts/unread-messages-context.tsx`. Apply the same change as T006: after the `addUnreadMessage(conversation.ulid, message.ulid)` call inside the `if (message.sender_type !== 'contact' && message.sender_type !== 'system')` block, add `setLastIncomingMessage(...)` and `setIsPreviewDismissed(false)` with the same fields. Use `conversation.ulid` for `conversationId`.

**Checkpoint**: Context is now extended. `lastIncomingMessage` and `isPreviewDismissed` are available to consumers via `useUnreadMessages()`.

---

## Phase 3: User Story 1 - Viewing unread message preview (Priority: P1) 🎯 MVP

**Goal**: When the widget is closed and a new message arrives, show a floating preview popup with avatar, sender name, message content, close button, and "See new messages" action.

**Independent Test**: Send a message from agent/bot side while widget is closed. Verify the preview popup appears with correct layout.

### Implementation for User Story 1

- [x] T008 [US1] Create new file `src/components/incoming-message-preview.tsx`. Import: `AnimatePresence` and `motion` from `framer-motion`, `X` and `ArrowRight` from `lucide-react`, `WidgetAvatar` from `@/components/widget-avatar`, `useWidgetConfigContext` from `@/contexts/widget-config-context`, `useUnreadMessages` from `@/contexts/unread-messages-context`, `useWidgetUIContext` from `@/contexts/widget-ui-context`. Export a function `IncomingMessagePreview`.

- [x] T009 [US1] Implement the visibility logic in `IncomingMessagePreview` in `src/components/incoming-message-preview.tsx`. Destructure `isOpen` and `setIsOpen` from `useWidgetUIContext()`, `lastIncomingMessage`, `isPreviewDismissed`, `dismissPreview`, and `totalUnreadCount` from `useUnreadMessages()`, `widgetConfig` from `useWidgetConfigContext()`. If `isOpen || !lastIncomingMessage || isPreviewDismissed`, return `null`.

- [x] T010 [US1] Implement the close handler in `IncomingMessagePreview` in `src/components/incoming-message-preview.tsx`. Create `handleClose` function that calls `dismissPreview()`. Create `handleSeeMessages` function that calls `dismissPreview()` then `setIsOpen(true)`.

- [x] T011 [US1] Implement the JSX layout for `IncomingMessagePreview` in `src/components/incoming-message-preview.tsx`. Wrap everything in `<AnimatePresence>` → `<motion.div>` with slide-up animation (initial `{opacity: 0, y: 20}`, animate `{opacity: 1, y: 0}`, exit `{opacity: 0, y: 20}`). The structure should be: (1) A close button at the top-right: a `<button>` with `<X>` icon and text "Close", styled as a pill-shape with rounded full corners, white background, shadow, horizontal flex with gap. (2) A message card container: white background, rounded corners with `rounded-2xl`, but with `rounded-br-none` when `widgetConfig.position === 'right'` or `rounded-bl-none` when `widgetConfig.position === 'left'`, with shadow. Inside the card: (a) Header row: `<WidgetAvatar showIconFallback={true} />` + text `"From {widgetConfig.name}"` styled as 20px medium weight, with a bottom border separator and horizontal padding. (b) Message body: `<p>` with `lastIncomingMessage.content`, with padding. (c) "See new messages" button: a text button with `<ArrowRight>` icon and text "See new messages", styled in the primary color, with `onClick={handleSeeMessages}`.

- [x] T012 [US1] Add the fixed positioning container for `IncomingMessagePreview` in `src/components/incoming-message-preview.tsx`. The outermost wrapper (before `AnimatePresence`) should be a `<div>` with `fixed` positioning, `z-50`, positioned with `bottom-[104px]` and `right-4` when `widgetConfig.position === 'right'` (or `left-4` when `left`), `max-w-[340px]`.

- [x] T013 [US1] Add the unread badge to `IncomingMessagePreview` in `src/components/incoming-message-preview.tsx`. If `totalUnreadCount > 1`, render a small circular badge near the top of the message card showing the count number. Style: `bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center`.

- [x] T014 [US1] Integrate `IncomingMessagePreview` into `src/components/widget-layout.tsx`. In the `WidgetLayoutContent` function, inside the standalone mode block (the `else` branch after `if (widgetConfig.sdkMode)`), import and render `<IncomingMessagePreview />` between the `</AnimatePresence>` closing tag (line 86) and the `<WidgetEye />` component (line 89). Only render it in standalone mode (NOT in sdkMode).

**Checkpoint**: At this point, the preview popup should appear in standalone mode when a new message arrives.

---

## Phase 4: User Story 2 - Interacting with the preview (Priority: P1)

**Goal**: Dismissing the preview via Close, See new messages, or opening the widget directly. Reset on new messages.

**Independent Test**: Trigger a message, then test each dismiss method (Close, See new messages, click widget bubble).

### Implementation for User Story 2

- [x] T015 [US2] Update `handleClick` in `src/components/widget-eye/components/widget-eye.tsx`. Import `useUnreadMessages` from `@/contexts/unread-messages-context`. Destructure `dismissPreview` from it. In the existing `handleClick` function, call `dismissPreview()` right before or after `toggle()`.

- [x] T016 [US2] Add a `sdk:dismissPreview` message listener in `src/components/widget-unread-sync.tsx`. Import `useEffect` for an additional effect. Add a `useEffect` that registers a `window.addEventListener('message', handler)` which listens for `event.data.type === 'sdk:dismissPreview'` and calls `dismissPreview()` (destructured from `useUnreadMessages()`). Clean up the listener on unmount.

- [x] T017 [US2] Send preview data to SDK parent in `src/components/widget-unread-sync.tsx`. Destructure `lastIncomingMessage` and `isPreviewDismissed` from `useUnreadMessages()`. Add a `useEffect` that watches `[lastIncomingMessage, isPreviewDismissed]`. When `lastIncomingMessage` is not null and `!isPreviewDismissed`, call `sendToParent('widget:previewMessage', { message: { content: lastIncomingMessage.content, senderName: lastIncomingMessage.senderName, senderAvatar: lastIncomingMessage.senderAvatar }, unreadCount: visibleUnreadCount })`. When `isPreviewDismissed` is `true`, call `sendToParent('widget:dismissPreview')`.

**Checkpoint**: All three dismiss interactions should work in standalone mode. SDK communication is in place for SDK mode.

---

## Phase 5: SDK Mode Support

**Goal**: Render the preview natively on the host page via the SDK (outside the iframe), using the existing holder pattern.

### Implementation for SDK Mode

- [x] T018 Add `PREVIEW_HOLDER_ID` constant and `previewHolder` state variable in `public/sdk.js`. Add `var PREVIEW_HOLDER_ID = 'pair-ai-preview-holder'` next to the other ID constants (line ~16). Add `var previewHolder = null` next to the other state variables (line ~23).

- [x] T019 Create `createPreviewHolder()` function in `public/sdk.js`. Model it after `createBubble()`. It should: (1) check if element already exists, (2) create a `div` with `id=PREVIEW_HOLDER_ID`, (3) set position with `config.position` (`right: '20px'` or `left: '20px'`), (4) start hidden (display: none), (5) add CSS class `'pair-ai-preview-holder pair-ai-position-' + position`, (6) append to `document.body`, (7) store in `previewHolder` variable.

- [x] T020 Create `showPreview(data)` function in `public/sdk.js`. It should: (1) check `previewHolder` exists, (2) build HTML string for the preview card matching the design reference from the spec image. The HTML should include: a close button div with X icon SVG + "Close" text, a message card div with an avatar image (use `data.message.senderAvatar` with a fallback SVG), "From" + `config.widgetName || 'Agent'` text (note: widget name may need to be sent from widget or use a default), a border separator, the message content text from `data.message.content`, a "See new messages" button with arrow icon, and optionally a badge with `data.unreadCount` if > 1. (3) Set `previewHolder.innerHTML` to the built HTML. (4) Add click event listeners on the close button (call `hidePreview()`, send `sdk:dismissPreview` to iframe) and the "See new messages" button (call `hidePreview()`, call `toggleWidget(true)`, send `sdk:dismissPreview` to iframe). (5) Show the holder by adding class `pair-ai-preview--visible`.

- [x] T021 Create `hidePreview()` function in `public/sdk.js`. It should: (1) check `previewHolder` exists, (2) remove class `pair-ai-preview--visible`, (3) optionally clear innerHTML after a short delay for animation.

- [x] T022 Update `setupMessageListener()` in `public/sdk.js`. Add two new cases in the switch statement: `case 'widget:previewMessage': if (!isOpen) { showPreview(event.data) } break;` and `case 'widget:dismissPreview': hidePreview(); break;`.

- [x] T023 Update `toggleWidget()` in `public/sdk.js`. When opening the widget (inside the `if (isOpen)` block, around line 221), add a call to `hidePreview()` to dismiss any visible preview when the widget opens.

- [x] T024 Update `init()` in `public/sdk.js`. Add `createPreviewHolder()` call after the existing `createWidgetHolder()` call (around line 368).

- [x] T025 Add `sendMessageToWidget` call for `sdk:dismissPreview` in `showPreview()` event listeners in `public/sdk.js`. In the close button click handler, after calling `hidePreview()`, call `sendMessageToWidget('sdk:dismissPreview', {})`. Same for the "See new messages" button click handler.

- [x] T026 Add `#pair-ai-preview-holder` base styles in `public/sdk.css`. Add after the bubble holder styles (around line 11): `#pair-ai-preview-holder { position: fixed; bottom: 104px; z-index: 2147483000; max-width: 340px; display: none; }` and `#pair-ai-preview-holder.pair-ai-preview--visible { display: block; }`.

- [x] T027 Add preview card CSS styles in `public/sdk.css`. Add styles for: `.pair-ai-preview-close` (pill close button: flex, items-center, gap 4px, background white, border-radius 999px, padding 6px 14px, box-shadow, cursor pointer, border none, font-size 14px, font-weight 500), `.pair-ai-preview-card` (white background, border-radius 16px, box-shadow, overflow hidden, margin-top 8px), `.pair-ai-preview-card--right` (border-bottom-right-radius: 0), `.pair-ai-preview-card--left` (border-bottom-left-radius: 0).

- [x] T028 Add preview card inner CSS styles in `public/sdk.css`. Add styles for: `.pair-ai-preview-header` (flex, align-items center, gap 8px, padding 12px 16px, border-bottom 1px solid #E5E7EB), `.pair-ai-preview-header img` (width 40px, height 40px, border-radius 12px, object-fit cover), `.pair-ai-preview-header-name` (font-size 16px, font-weight 500, color #1E1E1E), `.pair-ai-preview-body` (padding 12px 16px, font-size 14px, color #374151, line-height 1.5), `.pair-ai-preview-action` (display flex, align-items center, justify-content center, gap 6px, padding 10px 16px, font-size 14px, font-weight 500, color #4D98E2, cursor pointer, border none, background none, width 100%), `.pair-ai-preview-badge` (position absolute, top -6px, right -6px, width 20px, height 20px, background #ff3b30, color white, border-radius 50%, font-size 11px, font-weight 600, display flex, align-items center, justify-content center).

- [x] T029 Add mobile responsive styles for preview holder in `public/sdk.css`. Inside the existing `@media (max-width: 667px)` block, add: `#pair-ai-preview-holder { display: none !important; }`.

**Checkpoint**: SDK mode should now render the preview on the host page outside the iframe.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final adjustments and edge case handling.

- [x] T030 Add CSS transitions/animations to `#pair-ai-preview-holder` in `public/sdk.css`. Add `transition: opacity 0.2s ease, transform 0.2s ease;` to the base styles. When hidden (no `pair-ai-preview--visible` class), add `opacity: 0; transform: translateY(10px);`. When visible, `opacity: 1; transform: translateY(0);`.

- [x] T031 Handle long message content in `IncomingMessagePreview` in `src/components/incoming-message-preview.tsx`. Add `line-clamp-3` (or equivalent CSS `overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;`) to the message body paragraph to truncate long messages to 3 lines.

- [x] T032 Handle long message content in SDK preview in `public/sdk.css`. Add `.pair-ai-preview-body { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }` to truncate to 3 lines.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (needs the preview component to exist)
- **SDK Mode (Phase 5)**: Depends on Phase 4 completion (needs postMessage protocol working)
- **Polish (Phase 6)**: Depends on Phase 3 and Phase 5

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 being complete (needs preview component and context to exist)

### Within Each Phase

- Tasks are numbered sequentially and should be executed in order
- Tasks marked [P] within a phase can run in parallel

### Parallel Opportunities

- T006 and T007 modify different `handleNewMessage` functions and can conceptually run in parallel, but since they're in the same file, run sequentially
- T026, T027, T028, T029 all modify `sdk.css` but different sections — run sequentially
- T018-T025 modify `sdk.js` — run sequentially

---

## Implementation Strategy

### MVP First (User Story 1 Only — Standalone Mode)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T007)
3. Complete Phase 3: User Story 1 (T008–T014)
4. **STOP and VALIDATE**: Open the widget in standalone mode, close it, trigger a message, verify the preview appears
5. Continue to Phase 4 and 5

### Full Delivery

1. Complete all phases in order (1 → 2 → 3 → 4 → 5 → 6)
2. Validate standalone mode after Phase 4
3. Validate SDK mode after Phase 5
4. Final polish after Phase 6
