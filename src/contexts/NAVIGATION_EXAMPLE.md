# Widget Navigation - Simple Example

This is a **state-based navigation** system for the widget. It's simpler than routing because:

- The widget runs in an iframe (URLs don't matter)
- We have a simple flow: Welcome → Pre-chat → Conversation
- No need for browser back/forward buttons

## How It Works

### 1. Navigation Context (`widget-navigation-context.tsx`)

Manages which screen is currently shown:

- `currentScreen`: 'welcome' | 'pre-chat' | 'conversation'
- `conversationId`: The ID of the current conversation (if on conversation screen)

### 2. Main Route (`routes/index.tsx`)

Conditionally renders the correct screen based on state:

```tsx
function WidgetRouter() {
  const { currentScreen, conversationId } = useWidgetNavigation()

  if (currentScreen === 'welcome') {
    return <WelcomePage />
  }
  if (currentScreen === 'pre-chat') {
    return <PreChatFormPage />
  }
  if (currentScreen === 'conversation' && conversationId) {
    return <ConversationPage conversationId={conversationId} />
  }
}
```

### 3. Using Navigation in Components

**Example 1: Navigate from Welcome to Pre-chat**

```tsx
// In welcome-content.tsx
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'

function WelcomeContent() {
  const { navigateToPreChat } = useWidgetNavigation()

  const handleStartConversation = () => {
    navigateToPreChat() // Changes screen to pre-chat
  }

  return <Button onClick={handleStartConversation}>Start conversation</Button>
}
```

**Example 2: Navigate from Pre-chat to Conversation**

```tsx
// In pre-chat-form.tsx
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'

function PreChatForm() {
  const { navigateToConversation } = useWidgetNavigation()

  const handleSubmit = async (data) => {
    const response = await sendMessage(data)
    navigateToConversation(response.conversation_id) // Changes screen to conversation
  }
}
```

**Example 3: Go Back**

```tsx
// In conversation-header.tsx
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'

function ConversationHeader() {
  const { goBack } = useWidgetNavigation()

  return <Button onClick={goBack}>Back</Button>
}
```

## Available Navigation Functions

- `navigateToWelcome()` - Go to welcome screen
- `navigateToPreChat()` - Go to pre-chat form screen
- `navigateToConversation(conversationId)` - Go to conversation screen
- `goBack()` - Go back one screen (conversation → pre-chat → welcome)

## Flow

```
Welcome Screen
    ↓ (user clicks "Start conversation")
Pre-chat Form Screen
    ↓ (user submits form)
Conversation Screen
    ↓ (user clicks back)
Pre-chat Form Screen
```

That's it! Simple state management, no routing complexity.
