# Feature Specification: Incoming Message UI when Widget Closed

**Feature Branch**: `001-unread-message-ui`  
**Created**: 2026-03-22  
**Status**: Draft  
**Input**: User description: "Incoming message UI when widget closed"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Viewing unread message preview when widget is closed (Priority: P1)

As a visitor, when I receive a new message while the chat widget is closed, I want to see a preview of the latest message so I know who is messaging me and what they said.

**Why this priority**: Core functionality; replaces the current simple unread counter with meaningful context that drives user engagement.

**Independent Test**: Can be fully tested by sending a message to a client with a closed widget and verifying the pop-up appears correctly with the avatar, name, and message content.

**Acceptance Scenarios**:

1. **Given** the chat widget is closed, **When** a new message is received, **Then** a new message UI pop-up is displayed above the widget toggle button showing the avatar, sender name, message content, a "close" button, and a "See new messages" button.
2. **Given** the new message UI is visible, **When** the widget position is right-aligned, **Then** the pop-up container has a sharp bottom-right edge.
3. **Given** the new message UI is visible, **When** the widget position is left-aligned, **Then** the pop-up container has a sharp bottom-left edge.

---

### User Story 2 - Interacting with the unread message preview (Priority: P1)

As a visitor, I want to be able to dismiss the message preview or click it to open the full chat widget so I can control my viewing experience and reply if needed.

**Why this priority**: Essential for user control over the interface. Prevents the pop-up from blocking other site content indefinitely.

**Independent Test**: Can be tested by triggering the pop-up and then interacting with its buttons (Close, See new messages) or the main widget toggle.

**Acceptance Scenarios**:

1. **Given** the new message UI is visible, **When** the user clicks the "x Close" button, **Then** the UI is dismissed (resets) and only the standard widget toggle remains.
2. **Given** the new message UI is visible, **When** the user clicks the "See new messages" text button, **Then** the full chat widget opens and the preview UI is dismissed (resets).
3. **Given** the new message UI is visible, **When** the user interacts with the main widget toggle (opens the widget), **Then** the preview UI is dismissed (resets).

### Edge Cases

- What happens when multiple messages are received in rapid succession while the widget is closed? (Currently specified to only show the last message, but needs clarification on how updates to the latest message are handled).
- How does the system handle long sender names or long message content within the preview container? (Should it truncate or wrap?)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a new message preview UI when a message is received and the chat widget is in a closed state.
- **FR-002**: The preview UI MUST display the content of the most recently received message, and if there are multiple unread messages, it MUST show a small badge with the total number of unread messages.
- **FR-003**: The preview UI MUST include a "Close" button to dismiss the preview.
- **FR-004**: The preview UI MUST include the sender's avatar, sender's name, a bottom border under the header, and the message text.
- **FR-005**: The preview UI MUST include a "See new messages" button with an arrow right icon.
- **FR-006**: System MUST dismiss (reset) the preview UI if the user clicks "Close", "See new messages", or opens the widget directly.
- **FR-007**: System MUST open the full chat widget when the "See new messages" button is clicked.
- **FR-008**: The preview container MUST have dynamic styling for its bottom corners based on widget placement.

### Key Entities

- **Widget State**: Track whether the widget is open or closed.
- **Unread Messages State**: The received but unread messages (specifically the latest one).
- **Widget Configuration**: Used to retrieve `widgetConfig.name`, `widgetConfig.avatarUrl`, and the widget's screen placement.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Feature is fully functional across standard desktop and mobile viewports without layout breakage.
- **SC-002**: Message preview matches the design requirements (avatar usage, border separator, corner radii specific to widget placement).
- **SC-003**: All interactions (Close, See new messages, Open widget) reliably reset the unread message preview state 100% of the time.
