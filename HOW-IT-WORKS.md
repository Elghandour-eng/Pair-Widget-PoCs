# Pair Widget Studio — how it actually works

This document explains one system end to end: what the pieces are, which one
talks to which, and why two URLs that look like they should be the same are
deliberately different.

It is written to be read cold. No prior knowledge of the codebase is assumed,
and every claim points at the file that makes it true, so anything here can be
checked rather than trusted.

---

## 1. The three programs

Three separate programs are involved. Most confusion about this system comes
from thinking there are fewer.

### 1.1 The widget (the thing a visitor sees)

A React application. It renders the chat panel: the header, the hero image, the
quick-link cards, the prompt chips, the text box, the messages.

- **Repository:** a different one — `/var/www/html/pair-widget`
  (`Pair-AI-Platform/pair-widgets-preview`).
- **Shipped as:** static files. A loader script (`public/sdk.js`) plus a bundle.
- **How it gets on a page:** a customer pastes a `<script>` tag. The loader
  creates a floating launcher button and an `<iframe>`, and the widget
  application runs inside that iframe.

The widget **contains no design of its own**. Every colour, every string, every
size is read at runtime from a configuration document it fetches over HTTP. Two
channels running the identical build can look nothing alike.

### 1.2 The studio (this repository)

A dashboard for editing that configuration document, plus the HTTP API that
serves it.

- **Repository:** `/var/www/html/pair-widget-pocs` — this one.
- **Two workspaces:** `server/` (Express + Redis) and `web/` (React dashboard).
- **What it does:** lets a person edit a widget's design, stores it, and serves
  it to the widget at a public URL.

### 1.3 Pair (the upstream platform)

The real product backend, at `https://system.trypair.ai`. It owns the canonical
configuration for every widget, and it handles the actual conversation.

The studio is **not** a replacement for Pair. It is a place to design against,
which can either pass Pair's configuration through untouched or substitute its
own.

---

## 2. How a widget load actually happens

Follow one page load, in order. This is the whole mechanism.

```
  Customer's website
        │
        │  1. <script> runs, fetches the loader
        ▼
  ┌─────────────────────────────┐
  │  sdk.js  (the loader)       │  ← comes from BASE_URL
  └─────────────────────────────┘
        │
        │  2. builds a launcher button and an <iframe>
        ▼
  ┌─────────────────────────────┐
  │  the widget application     │  ← also from BASE_URL
  └─────────────────────────────┘
        │
        │  3. asks for its design
        ▼
  ┌─────────────────────────────┐
  │  GET /v1/widget/<id>/config │  ← goes to beBaseUrl
  └─────────────────────────────┘
        │
        │  4. design arrives as JSON; the widget renders it
        ▼
     the visitor sees the widget
```

Steps 1–2 fetch **program files**. Steps 3–4 fetch **data**. They are different
kinds of thing and they are allowed to live at different addresses — which is
exactly what the next section is about.

---

## 3. The two URLs

The install snippet contains two addresses. They are not duplicates of each
other and making them identical is not automatically correct.

```html
<script>
  window.PairAiWidgetSettings = {
    beBaseUrl: "https://widget-profiessanl.dev.k8s.trypair.ai",   // ← (B)
  }
  ;(function (d, t) {
    var BASE_URL = "https://widgets-test.trypair.ai"              // ← (A)
    var g = d.createElement(t)
    var s = d.getElementsByTagName(t)[0]
    g.src = BASE_URL + '/sdk.js'
    g.async = true
    s.parentNode.insertBefore(g, s)
    g.onload = function () {
      window.PairAiWidgetSDK.run({
        widgetId: "01KZ0RE6RABAXZJR9CA9G1SDDN",
        baseUrl: BASE_URL,
      })
    }
  })(document, 'script')
</script>
```

### (A) `BASE_URL` — where the program is

The address the browser downloads `sdk.js` and the widget bundle from. A static
file host. Changing it changes **which version of the widget code** runs.

### (B) `beBaseUrl` — where the data is

The address the widget asks for its design, and later posts chat messages to.
Changing it changes **which backend** answers.

### The useful analogy

- `BASE_URL` is the **app you installed on your phone**.
- `beBaseUrl` is the **server that app talks to**.

You can install the app from one place and point it at a different server. That
is normal. A staging backend with the app downloaded from a shared CDN is a
perfectly ordinary arrangement.

So: **two different URLs is not the bug.** What matters is whether the code at
(A) is the code you think it is.

---

## 4. Where each URL comes from

### `beBaseUrl` — derived from the page

Set to the origin that served the page. A page served from
`widget-profiessanl.dev.k8s.trypair.ai` writes that same origin into the
snippet, so the widget talks back to the server it came from.

### `BASE_URL` — decided by two environment variables

One function decides it — `server/src/lib/sdkBase.ts`:

```ts
export const isLocalSdk = (): boolean => !!env.WIDGET_SDK_DIST

export const sdkBaseUrl = (): string =>
  isLocalSdk() ? '/sdk' : env.WIDGET_SDK_BASE_URL
```

Read as a decision:

| condition | result | meaning |
| --- | --- | --- |
| `WIDGET_SDK_DIST` is set | `/sdk` | serve our own build, from this same server |
| `WIDGET_SDK_DIST` is empty | `WIDGET_SDK_BASE_URL` | use the hosted build elsewhere |

And the default, from `server/src/config/env.ts`:

```ts
WIDGET_SDK_BASE_URL: z.string().url().default('https://widgets-test.trypair.ai'),
WIDGET_SDK_DIST: z.string().default(''),
```

`WIDGET_SDK_DIST` is a **filesystem path** to a built copy of the widget. When
it is set, `server/src/app.ts` mounts it as static files at `/sdk`, and the
studio hands out its own origin as the SDK base.

---

## 5. The problem this caused

### On a developer machine

`.env` contains:

```
WIDGET_SDK_DIST=/var/www/html/pair-widget/dist-local
```

So `sdkBaseUrl()` returns `/sdk`, and the snippet reads:

```
BASE_URL  = http://localhost:4100/sdk
beBaseUrl = http://localhost:4100
```

Both from the same origin. Edits to the widget code appear immediately after
rebuilding `dist-local`.

### On the staging deployment

Neither variable is set. `WIDGET_SDK_DIST` is empty, so the default applies:

```
BASE_URL  = https://widgets-test.trypair.ai
beBaseUrl = https://widget-profiessanl.dev.k8s.trypair.ai
```

Verified directly:

```
GET https://widget-profiessanl.dev.k8s.trypair.ai/sdk/sdk.js  →  404
GET https://widgets-test.trypair.ai/sdk.js                    →  200
```

The 404 confirms the deployment serves no widget build of its own, so it falls
back to the hosted one.

### Why that matters

`widgets-test.trypair.ai` carries an **older** widget build. Searching it for
code added recently to the widget repository returns nothing.

The consequence is a system that is hard to reason about:

> **Staging runs an old program against a new configuration.**

The design edits land (they travel with the configuration, from `beBaseUrl`),
but anything needing new widget *code* does not — because that code is at
`BASE_URL`, and `BASE_URL` points somewhere that has not been updated.

That produces exactly the symptom that is most misleading: it works locally and
misbehaves on staging, with no error anywhere. Nothing is broken. Two halves of
the system are simply at different versions.

---

## 6. The three ways out

### Option 1 — update the hosted SDK

Build the widget and publish it to `https://widgets-test.trypair.ai`. No code
or snippet change.

- Quick, nothing to configure.
- **But** that host is shared, so the update reaches every project pointing at
  it, not just this one. It also does not prevent the same drift recurring.

### Option 2 — point at a different host

Set `WIDGET_SDK_BASE_URL` in the deployment to a host carrying the intended
build.

- One environment variable.
- **But** still an external dependency, and still a version to keep in step by
  hand.

### Option 3 — the deployment serves its own build (recommended)

Build the widget as part of the container image and set `WIDGET_SDK_DIST` to
where it landed. The snippet then becomes:

```
BASE_URL  = https://widget-profiessanl.dev.k8s.trypair.ai/sdk
beBaseUrl = https://widget-profiessanl.dev.k8s.trypair.ai
```

- Program and data ship together. Every deploy is self-consistent by
  construction, so this class of bug cannot recur.
- **But** the widget lives in a *separate repository*, so the build has to
  fetch it — a git submodule, or a second checkout step in the workflow. That
  decision has not been made yet and is the open question.

---

## 7. Everything else worth knowing

Context that makes the above easier to place.

### 7.1 Two sources for a design

Each registered widget has a `source` (`server/src/services/widgets.ts`):

| source | behaviour |
| --- | --- |
| `api` | fetch the live design from Pair, cache it briefly in Redis |
| `redis` | serve the design stored in the studio |

`resolveConfig()` switches on it. This is what "Live from Pair" versus "Studio
design" means in the dashboard: not two designs shown side by side, but which
one the public endpoint actually hands to the widget.

### 7.2 The public endpoints

Mounted in `server/src/app.ts`:

| path | purpose |
| --- | --- |
| `/v1/widget/:id/config` | the design, in the language the config declares |
| `/lang/:lng/v1/…` | the design forced into `ar` or `en` |
| `/pv/:lng/:theme/v1/…` | forced language **and** theme |
| `/api/public/hero.svg` | the hero, drawn server-side as one image |
| `/api/public/widget/:id/embed` | a live test page carrying the real widget |
| `/api/public/docs` | the integration guide |

`/v1` exists because it mirrors Pair's own path shape, so a widget's
`beBaseUrl` can be pointed at the studio without the widget knowing.

### 7.3 Two languages in one document

A design stores both languages at once, not one:

- structured fields: `welcomeTitle.i18n.ar` / `.i18n.en`, with `.text` holding
  whichever language the config currently declares
- plain fields: `<field>_i18n.{ar,en}` beside the field

`applyWidgetLanguage()` (`server/src/lib/widgetLang.ts`) moves the right
language into place on the way out.

A real failure here: a stored design once declared `locale: "en"` while every
visible string was still Arabic, and the plain `/v1` path served that mix
verbatim — a half-English, half-Arabic widget. The fix was to apply the config's
own declared language on the way out, so an inconsistent stored state cannot
reach a visitor.

### 7.4 The hero is an image, not markup

The widget renders one `heroImage.url`. The studio's hero can be several slides,
including ones it draws itself from configuration values, so before a design
leaves, that field is pointed at `/api/public/hero.svg`, which draws the whole
thing as one animated SVG.

Two consequences:

- The URL carries a hash of the design (`&v=…`). Without it a browser held the
  old hero for the full cache lifetime and an edit looked like it had not
  applied.
- The same builder produces the dashboard preview and the served image, so the
  two cannot drift apart.

### 7.5 Design history

Every save keeps the design it replaces (the last twenty), in
`widget:<id>:versions`. A restore is snapshotted too, so stepping back is
reversible.

This exists because of a real loss: an accidental "Import from Pair" overwrote a
design, and there was no history to recover from. It was rescued from a Redis
snapshot that happened to predate the overwrite — luck, not a feature. That
import button has since been removed from the toolbar.

### 7.6 Streaming to the widget

The widget already accepts streamed replies over Pusher, in three events:

| event | payload |
| --- | --- |
| `widget.thinking` | `{ conversation_id, stream_id, text }` |
| `widget.message.delta` | `{ conversation_id, stream_id, delta, seq }` |
| `widget.message.complete` | `{ conversation_id, stream_id }` |

Sequence numbers, duplicate rejection and out-of-order buffering are all
implemented on the widget side already. Anything wanting to stream into the
widget needs to emit those three events; it does not need new widget code.

---

## 8. The environment variables that matter

From `server/src/config/env.ts`:

| variable | default | what it controls |
| --- | --- | --- |
| `WIDGET_SDK_DIST` | *(empty)* | path to a local widget build; set ⇒ served at `/sdk` |
| `WIDGET_SDK_BASE_URL` | `https://widgets-test.trypair.ai` | the hosted widget build, used when the above is empty |
| `PAIR_API_BASE_URL` | `https://system.trypair.ai` | the upstream Pair backend |
| `REDIS_URL` | `redis://127.0.0.1:6379/5` | where designs, versions and notes live |
| `REDIS_PREFIX` | `pwp:` | key prefix |
| `MONGODB_URI` | *(unset)* | optional; logs and notes fall back to Redis without it |
| `UPLOAD_DIR` | `data/uploads` | uploaded images |

The first two are the subject of this document.

---

## 9. Glossary

- **SDK** — the widget program: the loader plus its bundle. Static files.
- **Loader** (`sdk.js`) — the small script a customer pastes. Builds the
  launcher and the iframe, and exposes `window.PairWidget`.
- **`beBaseUrl`** — the backend the widget asks for data.
- **`BASE_URL`** — the host the widget program is downloaded from.
- **Widget ID** — identifies which design to serve.
- **Config / design** — the JSON document describing everything the widget
  looks like.
- **Channel** — one widget: an ID plus its design.
- **Studio design vs Live from Pair** — whether the public endpoint serves the
  locally stored design or Pair's.
- **Hero** — the banner at the top of the intro screen.

---

## 10. The question actually on the table

The snippet is correct as written. Two different URLs is the intended shape.

The open decision is **Option 3 in section 6**: should the deployment build and
serve its own copy of the widget, so program and data ship together? If so, the
widget lives in a separate repository, and the remaining choice is how the build
gets it — a git submodule, or a second checkout in the CI workflow.
