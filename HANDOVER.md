# Project Handover: Pair AI Widget

This document provides a comprehensive overview of the **Pair AI Widget** project, including its architecture, key capabilities, technology stack, directory structure, detailed technical flows (e.g., audio recording, iframe message protocols), configuration, and deployment details.

---

## 1. Project Overview

The **Pair AI Widget** is a customizable, embeddable chat and ticketing application. It can be integrated into any host website via a thin client-side SDK (`sdk.js`), which renders a chat launcher bubble and loads the core widget interface inside a secure `iframe`.

The system supports:

1. **Chat Mode (`PairAiWidgetSDK.run`)**: Standard live chat with agent assignment, real-time message syncing, attachments, rich audio messages, and customer satisfaction (CSAT) rating forms.
2. **Form Mode (`PairAiWidgetSDK.renderForm`)**: A customizable, embeddable feedback/contact ticketing form that automatically communicates sizing to the host page and fires callback events upon successful submission.

---

## 2. Technology Stack

The application is built on a modern, typed frontend stack:

- **Core Framework**: React 19 (TypeScript)
- **Bundler & Build Tool**: Vite 7
- **Styling**: Tailwind CSS (v4) with `@tailwindcss/vite` integration, Vanilla CSS (`src/styles.css`), Radix UI primitives, and Framer Motion for slide animations.
- **Routing**: [TanStack Router](https://tanstack.com/router) (file-based router).
- **Data Fetching & State**: [TanStack Query](https://tanstack.com/query) (React Query) for API state, and TanStack Store/native React Context for UI state.
- **Real-Time Integration**: Pusher JS for WebSocket-based live syncing (messages, typing indicators).
- **Audio Processing**: Web Audio API combined with `lamejs` for client-side MP3 encoding and compression.
- **Forms & Validation**: React Hook Form with Zod schemas.

---

## 3. Directory Structure

The project follows a modular, feature-oriented folder layout:

```text
widget/
├── .agent/                  # Developer assistant configs
├── .husky/                  # Commit hook scripts
├── .specify/                # SpecKit plan and constitution models
├── dist/                    # Compiled assets for production
├── public/                  # Static assets & client SDK entrypoints
│   ├── sdk.js               # Embeddable SDK script loaded by parent site
│   ├── sdk.css              # Custom styling for launcher bubble & iframe wrapper
│   ├── simple-example.html  # Demo of embedding the Chat Widget
│   └── form-example.html    # Demo of embedding the Feedback Form
├── specs/                   # Specifications for development cycles
└── src/                     # Application source code
    ├── components/          # Reusable UI component libraries
    │   ├── ui/              # Radix primitives & styled inputs (avatar, calendar, etc.)
    │   ├── widget-layout.tsx# Shell layout for the widget panel
    │   ├── widget-avatar.tsx# Status indicator / agent avatar renderer
    │   ├── widget-unread-sync.tsx # Synchronizes state back to the SDK launcher
    │   └── widget-color-sync.tsx  # Dynamic color sync based on configuration
    ├── config/              # Widget-wide configuration queries and schema mapping
    ├── constants/           # Shared thresholds (e.g. file size limits)
    ├── contexts/            # React Context providers (navigation, UI, unread state)
    ├── core/                # Basic utilities (axios HTTP wrapper, JWT local storage)
    ├── features/            # Feature modules (isolated code per domain)
    │   ├── welcome/         # Launcher dashboard screen
    │   ├── pre-chat-form/   # Form used to collect name/email before starting chat
    │   ├── conversation/    # Message lists, input boxes, audio recorder, CSAT feedback
    │   └── feedback-form/   # Dedicated embedded ticket submitter page
    ├── lib/                 # Third-party helper scripts (markdown parsing, tailwind utils)
    ├── pusher/              # Pusher configuration, auth callbacks, and event listeners
    ├── routes/              # TanStack Router files (__root.tsx, index.tsx, form.tsx)
    ├── types/               # Globally declared TS types
    └── utils/               # Loggers, string manipulation, token validity decoders
```

---

## 4. Feature Implementation Details

### A. Embedding SDK (`sdk.js` & `sdk.css`)

The SDK provides a clean integration API for third-party host sites. It implements two main flows:

#### 1. Embedded Chat Widget

Runs by inserting the script and calling `PairAiWidgetSDK.run`. It injects a launcher bubble onto the parent page and loads the widget in a floating panel (`iframe`).

```html
<script>
  window.PairAiWidgetSettings = {
    position: 'right', // 'right' or 'left'
    type: 'standard', // 'standard' or 'expanded_bubble'
    launcherTitle: 'Chat now!',
  }
  ;(function (d, t) {
    var BASE_URL = 'http://localhost:3000'
    var g = d.createElement(t),
      s = d.getElementsByTagName(t)[0]
    g.src = BASE_URL + '/sdk.js'
    g.async = true
    s.parentNode.insertBefore(g, s)
    g.onload = function () {
      window.PairAiWidgetSDK.run({
        widgetId: 'YOUR_WIDGET_ID',
        baseUrl: BASE_URL,
      })
    }
  })(document, 'script')
</script>
```

#### 2. Embedded Feedback Form

Renders the form inside a host-provided container (e.g., a `div` element). The iframe automatically adjusts its height within the container using `postMessage` calls.

```javascript
window.PairAiWidgetSDK.renderForm({
  formId: 'YOUR_FORM_ID',
  containerId: 'container-element-id',
  baseUrl: 'http://localhost:3000',
  styles: {
    backgroundColor: '#ffffff',
    primaryColor: '#1f93ff',
    borderRadius: '8px',
    submitButtonText: 'Send Ticket',
  },
  onSubmitted: function (data) {
    console.log('Feedback submitted:', data)
  },
})
```

---

### B. Audio Message Recording & Web Audio Pipeline

To circumvent browser compatibility issues and server storage limitations, the widget implements an optimized audio pipeline:

1. **Seamless Auto-Chunking**:
   - A 5MB limit is imposed on uploaded files (`VOICE_MAX_FILE_SIZE`).
   - The recording hook (`useVoiceRecorder.ts`) calculates the raw-bytes threshold dynamically. If raw byte accumulations hit the safety threshold (`VOICE_CHUNK_SAFETY_THRESHOLD` set to 4.5MB), the active `MediaRecorder` automatically stops, commits its buffer, and triggers a new `MediaRecorder` instance sequentially without breaking user flow.
2. **Client-Side MP3 Encoding**:
   - The raw audio buffer is converted into a standard 16-bit PCM buffer (`Int16Array`).
   - Using `lamejs` (`Mp3Encoder`), the PCM data is compressed into a mono MP3 blob (`audio/mpeg`) at `128 kbps` (`VOICE_MP3_BITRATE`).
   - Working with a mono channel drastically reduces final payload sizes.
3. **Waveform Visualization**:
   - **Recording Preview**: Uses standard Canvas rendering powered by an `AnalyserNode` connected to the active audio stream.
   - **Playback rendering**: An asynchronous decoder fetches and downsamples peaks from the MP3 buffer (capped between 24 and 45 bars depending on screen width) for an interactive waveform display with custom seek functionality.

---

### C. Iframe Communication Protocol (`postMessage`)

The host window and the embedded widget communicate securely via HTML5 `window.postMessage`.

#### Widget to Host (SDK)

- `widget:ready`: Fired when the React app completes initialization. Triggers the SDK to load `sdk.css` and reveal the launcher button.
- `widget:close`: Triggered when the user clicks the minimize/close button inside the header. Request SDK to hide the iframe.
- `widget:setColor`: Informs the launcher bubble to update its background gradient/color to match the organization's settings.
- `widget:unreadCount`: Syncs the current unread message badge count.
- `widget:previewMessage`: Sends the last incoming message details to render a floating notification preview card natively on the host page.
- `widget:dismissPreview`: Clears the floating preview on the parent.
- `form:resize`: Fired dynamically by the feedback form (via a `ResizeObserver` observing the form container scroll height). Tells the SDK to stretch or shrink the iframe height to prevent scrolls.
- `form:submitted`: Sent when ticket submission completes successfully.

#### Host (SDK) to Widget

- `sdk:config`: Sends configuration options (positions, user information) to the widget frame.
- `sdk:opened` / `sdk:closed`: Syncs the widget UI state when the host opens or closes the panel.
- `sdk:toggle`: Forces a visibility toggle.
- `sdk:setUser`: Passes logged-in user meta-attributes (unique user identifier, email, phone) to bypass the pre-chat questionnaire.
- `sdk:dismissPreview`: Fired when the user dismisses the floating preview card on the host page, prompting the widget state to register it as seen.

---

### D. Data Synchronization & Real-time Updates (Pusher)

- **Authentication**: Private channels are established under the namespace structure `/pusher/auth`. The authentication flow automatically checks for expired local tokens (`token-expiration.ts`) and discards them if they are expired before establishing connections.
- **Pusher Hooks**: Hook utilities (`use-pusher.ts`, `use-pusher-channel.ts`) subscribe to private conversations based on the logged-in user session.
- **Events Handled**:
  - `new-message` / `new_message`: Pushes incoming message payloads (text, images, media, CSAT requests) directly to the react-query cache via optimistic updates.
  - Typing and read indicators to track active agents.

---

### E. Theme & Customization Sync

The component `widget-color-sync.tsx` listens for the resolved primary brand colors fetched during initialization. It writes these properties directly as CSS variables to the document root:

- `--primary-color`
- `--primary-hover`
- `--primary-light`

This allows inputs, buttons, and custom waveforms to dynamically customize their color scheme to match the client's branding setup.

---

## 5. Development Operations

### Prerequisites

Make sure you have Node (v18+) and npm installed.

### Setup and Start Local Server

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in the values:
   ```env
   VITE_BASE_URL=your_base_url
   VITE_PUSHER_APP_KEY=your_pusher_key
   VITE_PUSHER_CLUSTER=your_pusher_cluster
   ```
4. Start the Vite development server (runs on port 3000):
   ```bash
   npm run dev
   ```
5. Test using the local SDK by opening:
   - `http://localhost:3000/simple-example.html` (Chat widget test)
   - `http://localhost:3000/form-example.html` (Feedback form test)

### Production Build

Build TypeScript typings and minify bundle:

```bash
npm run build
```

### Deployment (Firebase Hosting)

To build and deploy your files directly to Firebase hosting environments:

```bash
npm run deploy
```

_(Ensure you are logged in using `firebase login` and have selected the appropriate project directory context)._

---

## 6. Recommendations & Future Scope

1. **Router Route Generation**:
   Since this project uses file-based TanStack Routing, any new root layout pages or pages inside `src/routes` will require the routing compiler to run. Ensure you have the dev server running (`npm run dev`) or run `npx tsr generate` to rebuild the route maps found in `src/routeTree.gen.ts`.
2. **Audio Bitrate Control**:
   The `VOICE_MP3_BITRATE` is set to `128 kbps` in `src/constants/file-upload.ts`. For voice messages, this could be further reduced to `64 kbps` or `32 kbps` to generate even smaller files without a noticeable reduction in voice clarity.
3. **SDK Caching**:
   `public/sdk.js` is loaded directly by the parent. Ensure your production CDN/server serves this file with short caching lifetimes (or caching headers configured correctly) so updates to the postMessage APIs or bubble launcher UI propagate quickly to host sites.
