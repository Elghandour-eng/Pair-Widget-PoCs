# The Template Engine

How a widget turns a few bytes from an agent into a finished card, where the
data behind that card comes from, and how to add one of your own.

This document is the reference for the subsystem introduced on branch `sse`. It
assumes you know what this repo is (a studio that serves widget designs and
proxies widget chat) but nothing about templates.

---

## Table of contents

1. [The problem this solves](#1-the-problem-this-solves)
2. [Architecture](#2-architecture)
3. [The life of one card](#3-the-life-of-one-card)
4. [Layer 1 — the template registry](#4-layer-1--the-template-registry)
5. [Layer 2 — data sources](#5-layer-2--data-sources)
6. [Layer 3 — per-widget bindings](#6-layer-3--per-widget-bindings)
7. [Per-widget agents](#7-per-widget-agents)
8. [The SDK side](#8-the-sdk-side)
8b. [The template studio](#8b-the-template-studio--a-template-without-a-deploy)
9. [HTTP API reference](#9-http-api-reference)
10. [The dashboard page](#10-the-dashboard-page)
11. [Adding a template](#11-adding-a-template)
12. [Adding a data source](#12-adding-a-data-source)
13. [Operations](#13-operations)
14. [Testing](#14-testing)
15. [Design decisions and their reasons](#15-design-decisions-and-their-reasons)
16. [Known gaps](#16-known-gaps)
17. [File map](#17-file-map)

---

## 1. The problem this solves

An agent answering "what are your ticket prices?" could write the whole price
table into its reply. That is the obvious design and it is a bad one:

- **It costs tokens on every single reply**, for data that never changes.
- **It drifts.** The model's copy of the price table is whatever was in its
  prompt when the prompt was last edited. The real table is in Airtable. The
  two diverge silently, and the customer is the one who finds out.
- **It renders as text.** A price table typed into a chat bubble is a price
  table typed into a chat bubble. It is not a card.

So the widget has always had *templates*: the agent names a card shape and
sends a reference, and the server fills in the rest. `{"template":"price_list",
"data":{}}` becomes a full, correctly-priced, correctly-localised card.

That much predates this work. What did not exist was any way to manage it:

- The card shapes were a chain of `if` statements inside the chat route.
- The data behind them was hardcoded in the same file — a cinema table, a price
  table, an experiences table — plus a 1,728-line compiled menu export.
- Every widget got the same templates with the same data, because there was
  nowhere to say otherwise.
- There was no way to see what templates existed without reading the code.
- A live Airtable loader had been written and was never wired up, so the menu
  answered from a snapshot that drifted the moment anyone edited the table.

The template engine replaces all of that with three separated layers and a
dashboard page.

---

## 2. Architecture

Three layers. The separation is the whole point, so it is worth being precise
about what each one owns.

```
┌─────────────────────────────────────────────────────────────────┐
│ REGISTRY          server/src/lib/templates/registry.ts          │
│ The SHAPE of a card.                                            │
│ • what the agent is allowed to emit  (emits)                    │
│ • how a reference expands into card data  (hydrate)             │
│ • which SDK renderer draws it  (widgetType)                     │
│ • what to render when there is no data  (seed)                  │
│ Compiled in. Not per-customer. Not per-widget.                  │
└─────────────────────────────────────────────────────────────────┘
                              ▲ rows
┌─────────────────────────────────────────────────────────────────┐
│ DATA SOURCES      server/src/lib/dataSource.ts                  │
│ WHERE the rows come from and how long a copy stays good.        │
│ • kind: airtable | http | inline                                │
│ • ttlMs, refreshed on one sweep timer                           │
│ • memory copy + Redis copy + stale-while-revalidate             │
│ Records in Redis. Created from the dashboard. No deploy.        │
└─────────────────────────────────────────────────────────────────┘
                              ▲ which source
┌─────────────────────────────────────────────────────────────────┐
│ BINDINGS          server/src/services/templates.ts              │
│ WHICH templates this widget renders, and from which source.     │
│ Redis: widget:{id}:templates                                    │
│ Absent = every template, from its seed. Opt-in by design.       │
└─────────────────────────────────────────────────────────────────┘
```

A template says *what a price list looks like*. A data source says *where the
prices are*. A binding says *this widget's price list reads that source*. None
of the three knows anything about the other two beyond the name it refers to.

---

## 3. The life of one card

Follow a single reply end to end. The customer asks for the ticket prices.

**1. The agent decides.** The orchestrator's envelope carries a `components`
array next to the reply text:

```json
{
  "message": "هذي أسعار التذاكر 🎬",
  "status": "answered",
  "components": [{ "type": "template", "template": "price_list", "data": {} }]
}
```

Note `data: {}`. The agent has spent no tokens on prices.

**2. The engine validates and emits.** `ValidComponents` in the orchestrator
drops anything malformed, then sends a dedicated SSE event:

```
data: {"event":"components","data":{"agent":"main","components":[…]}}
```

**3. The studio hydrates.** Before the stream opens, the chat route reads this
widget's bindings once:

```ts
const [target, binding] = await Promise.all([
  engineTarget(conv.widgetId),
  bindingFor(conv.widgetId),
])
```

Then, for each component, synchronously:

```ts
hydrateComponents(components, binding)
```

which looks the template up in the registry, resolves its rows, and calls its
`hydrate`. `{}` becomes:

```json
{
  "title": "أسعار التذاكر 🎬", "title_en": "Ticket prices 🎬",
  "currency": "د.ك", "currency_en": "KD",
  "items": [{ "label": "عادي 2D/3D", "label_en": "Standard 2D/3D", "price": "3.500" }, …]
}
```

**4. The studio picks one card group.** `componentsToTemplate` walks the
registry in order and returns the first template the reply carries, as the
SDK's native `widget_template`. Language follows the reply text, not the
widget's view setting, so an Arabic answer gets an Arabic card.

**5. The widget draws it.** The SDK switches on `widget_template.type` and
renders `<PriceList/>`. It never saw a price table, a registry, or a data
source — only the finished card.

That last point matters and is worth stating on its own: **no template data
ever reaches the browser.** Hydration is server side. The SDK bundle carries
renderers and nothing else. Caching a 96-row menu in the studio does not add a
single byte to what the customer downloads.

---

## 4. Layer 1 — the template registry

`server/src/lib/templates/registry.ts`

### The definition

```ts
export interface TemplateDef {
  name: string            // what the agent writes in "template"
  title: string           // dashboard label
  description: string
  widgetType: string      // the SDK renderer that draws it
  collects?: boolean      // several components → one card list
  passthrough?: boolean   // rows come from the agent's tool; no source applies
  emits: TemplateField[]  // what the agent may put in `data` — the prompt contract
  sample: Record<string, unknown>
  seed: () => Row[]       // what renders when no source has good data
  hydrate(data: Row, rows: Row[]): Row
}
```

`seed` is a **function**, not an array. That is deliberate: the menu templates'
fallback is itself a live, refreshing copy, so a frozen array would have
reintroduced the drift this work removed.

### The registered templates

Order matters — `componentsToTemplate` sends the first match.

| `name` | `widgetType` | What the agent sends | Rows from |
|---|---|---|---|
| `location_card` | `location_cards` | `{"id":"1"}`, optional `distance_km` | branches |
| `price_list` | `price_list` | `{}`, or `{"items":[…]}` for a subset | prices |
| `experiences_list` | `experiences_list` | `{}` | experiences |
| `menu_categories` | `menu_categories` | `{}` | menu |
| `movie_cards` | `movie_cards` | `{"items":[…]}` verbatim from its tool | **nothing** (passthrough) |
| `app_links` | `app_links` | `{}` | one row of store URLs |
| `menu_list` | `menu_cards` *or* `price_list` | `{"category"}` / `{"match"}` / `{"cinema"}` / `{"items"}` | menu |

Two entries deserve a note.

**`movie_cards` is passthrough.** Now-showing data comes from the agent's own
live tool, which is the only source of truth for what is playing today. The
server fills in nothing and binds no source. `hydrate` is the identity function.

**`menu_list` picks its renderer at send time.** Items with photos render as
photo cards; items without render as a price list. A photo-card grid full of
grey rectangles is worse than a clean list, so the honest renderer wins.

### Rules hydration follows

- A **non-template** component passes through untouched.
- An **unregistered template name** passes through untouched rather than being
  dropped, so a newer agent is never silently broken by an older server.
- A template the widget has **not enabled** is dropped.
- An **unresolvable reference** (an unknown branch id) passes its data through
  rather than inventing a card.
- The **model's own fields win** over the source. `distance_km` is computed per
  conversation and must survive the merge.

---

## 5. Layer 2 — data sources

`server/src/lib/dataSource.ts`

A source is a named, cached feed. Three kinds:

| `kind` | Config | Notes |
|---|---|---|
| `airtable` | `base`, `table`, optional `view`, optional `token` | Pages the whole table. Records arrive flattened: `{_id, …fields}`, so a hydrator never knows it was Airtable. Falls back to `AIRTABLE_TOKEN` when no per-source token is set. |
| `http` | `url`, optional `headers`, optional `path` | `path` is a dot path to the array inside the response, e.g. `data.items`. |
| `inline` | `items` | Rows typed into the dashboard. Never fetched, never expires. |

### The caching rule

Every source follows one rule, the one the Cinescape menu already proved:

> Serve what we have while a refresh runs. Keep the last good copy when a
> refresh fails. Fall back to the template's seed when there is no copy at all.

Concretely:

- **Memory is the read path.** `rowsOf(id)` never awaits and never throws.
- **Redis is the restart path.** A copy is written under
  `datasource:{id}:cache` with a 7-day TTL, so a restart answers immediately
  with recent data rather than a cold fetch.
- **Staleness triggers a background refresh**, it does not block the caller.
  The stale copy is returned now; the fresh one lands for the next turn.
- **A failed refresh logs and keeps the old copy.** It never empties the cache,
  because an empty card is worse than a slightly old one.
- **One refresh per source at a time.** Callers arriving mid-refresh await the
  one already running.

### Refresh scheduling

One sweep timer every 60 seconds, not one timer per source. The sweep refreshes
whatever has aged past its own `ttlMs`. `ttlMs: 0` means fetch once at boot and
never again.

The timer is `unref`'d, so it never holds the process open.

### Boot

`startDataSources()` is called from `index.ts` **without `await`**:

```ts
void startDataSources()
```

Every source warms from its Redis copy, then the first sweep fetches what is
stale — all behind the listening socket. A slow or dead Airtable cannot delay
the boot, and the seeds answer in the meantime.

---

## 6. Layer 3 — per-widget bindings

`server/src/services/templates.ts` · Redis `widget:{id}:templates`

```ts
interface WidgetTemplatesRecord {
  enabled: string[] | null              // null = every registered template
  sources: Record<string, string>       // template name → source id
  updatedAt: string | null
  updatedBy: string | null
}
```

**A widget with no record renders every template from its seed** — exactly how
the system behaved before this existed. Nothing needed migrating, and a widget
nobody has configured is not broken.

Validation happens on write, not on render. Saving an unknown template name or
an unknown source id is rejected with a 400. The alternative is discovering it
in a customer's chat window.

### The render-path cache

Hydration runs inside the streaming loop and must not await Redis. So the
binding is read once per turn and held for 30 seconds, and a save clears the
entry outright. A dashboard change therefore shows up on the next message.

---

## 7. Per-widget agents

This was the blocker. Before it, `AGENT_ENGINE_AGENT` was read from the
environment once, so one studio could serve exactly one agent — and "add this
template to any widget" would have been meaningless.

A widget record now carries three optional fields:

| Field | Meaning |
|---|---|
| `engine` | `agent-engine` routes chat to the orchestrator over SSE. Anything else goes to Pair. |
| `agentId` | Which agent the orchestrator should run. |
| `engineKey` | The application key that authenticates and selects it. |

Resolution falls back to the env pair, so existing widgets are unaffected:

```ts
const { agentId, apiKey } = await engineTarget(widgetId)
```

An application key is sent as `Authorization: Bearer`; without one the legacy
`X-Agent-Id` header names the agent directly.

`EngineConv` now carries its `widgetId` so a restored conversation resolves the
same agent and the same bindings it started with.

---

## 8. The SDK side

The SDK never sees `components`. It receives `message.widget_template`:

```ts
{ type: 'price_list', content: { lang: 'ar', title: '…', items: [ … ] } }
```

and switches on `type` in
`sdk-src/src/features/conversation/components/conversation-message/ai-assistant-message/widget-template/template-renderer.tsx`.

Every `widgetType` in the registry has a renderer there: `location-cards.tsx`,
`price-list.tsx`, `experiences-list.tsx`, `app-links.tsx`, `menu-cards.tsx`,
`movie-cards.tsx`, `menu-categories.tsx`, plus the shared `card-image.tsx`.

**The registry and the renderer switch are two halves of one contract.** A
template with no renderer draws nothing; a renderer with no registry entry is
never reached. Adding a template means touching both, and nothing else.

---

## 8b. The template studio — a template without a deploy

Everything above describes a template as code: an entry in `registry.ts` and a
renderer in the SDK. The studio is the other way in, for the templates nobody
wants to wait for a deploy to get.

An operator opens **Templates → New template** and gives the design in one of
three ways: a picture of the card (dropped, pasted or picked), the markup a
designer sent, or a sentence describing it. One call to Claude
(`TEMPLATE_STUDIO_MODEL`, default `claude-haiku-5-5`) turns that into the same
contract every other template has:

- **fields** — what the agent may emit, each with a type and a one-line
  description the agent reads;
- **html** — the card body, with `{{field}}` holes to put the values in,
  `{{#each list}}…{{/each}}` to repeat a block, and `{{#if field}}…{{/if}}` to
  drop a part of the card nobody filled in;
- **name, title, description, category** — how it sits in the catalog and what
  the agent calls it.

Nothing is saved by generating. The operator edits the name, the fields and the
markup by hand, asks for changes in a sentence ("make the price bigger"), and
presses save — and only then does it become a template.

### What a studio template is, once saved

A record in Redis (`template:<name>`), loaded into the registry at boot and
registered beside the compiled templates. From that point it behaves like any
other template: it is in the catalog, a widget can enable it, bind a data
source to it and design it, and the agent emits it by name. `rows` inside the
body is the bound source's copy, so a studio card can iterate a live feed.

Its `widgetType` is always `custom_card`, and the server sends **finished
markup** — the values are already in it. That is what keeps the SDK out of it:
one renderer draws every studio template, and the widget never learns what any
particular card is.

### The two locks on the markup

A card body is written by a model and filled with values an agent produced, so
neither is trusted:

1. **Values are escaped** where they are substituted, so data can never become
   markup.
2. **The body is stripped** of `<script>`, frames, inline `on…=` handlers and
   `javascript:` targets when it is saved, and it is drawn in an iframe with no
   `allow-scripts` — in the widget and in the dashboard alike.

### Where it lives

| Piece | File |
|---|---|
| Store, renderer, sanitiser | `server/src/lib/templates/customTemplates.ts` |
| The model call | `server/src/lib/templates/studio.ts` |
| Registry hooks (`registerCustom`, `templateByName`, `allTemplates`) | `server/src/lib/templates/registry.ts` |
| Routes | `server/src/routes/templates.ts` (`/studio/*`, `/custom/*`) |
| The page | `web/src/pages/templates/Studio.tsx` |
| The one renderer | `sdk-src/.../widget-template/custom-card.tsx` |

Set `ANTHROPIC_API_KEY` to turn the studio on; without it the page says so and
the rest of the engine is unaffected.

---

## 9. HTTP API reference

All dashboard routes require auth. Mutations require `editor`; deletes require
`admin`.

### Catalog

```
GET /api/templates
```

Returns every registered template: name, title, description, `widgetType`,
`collects`, `passthrough`, `emits`, `sample`, a copy-pasteable `snippet`, and
`seedRows`. `hydrate` is deliberately not exposed — a template is described by
its contract, not its implementation.

```
GET /api/templates/:name/preview[?source=<id>]
```

Renders the template from its own sample through the **real hydrator** and
returns what a widget would receive. With `?source=` it previews against that
source instead of the seed, which is how you check a new feed before binding it
to anything.

### The studio

```
GET  /api/templates/studio/status                       { ready }
POST /api/templates/studio/generate   { image?, html?, prompt?, previous? }
POST /api/templates/studio/preview    { html, sample }
```

`generate` is the model call and returns an **unsaved** template spec;
`preview` runs the engine's own renderer over an unsaved body, which is what
the studio's live preview draws. An image is base64 with its media type, under
1.4MB — the dashboard downscales before it uploads.

```
GET    /api/templates/custom
GET    /api/templates/custom/:name
POST   /api/templates/custom          { name, title, description, category, fields, html, sample }
PATCH  /api/templates/custom/:name    (everything but the name)
DELETE /api/templates/custom/:name
```

A studio template may not take the name of a compiled one, and its body may
only use fields it declares — both fail on the form rather than in a chat.

### Data sources

```
GET    /api/datasources
POST   /api/datasources              { id, name, kind, ttlMs, config }
PATCH  /api/datasources/:id          { name?, ttlMs?, config? }
POST   /api/datasources/:id/refresh
DELETE /api/datasources/:id
```

Every response carries live `status`: `{rows, fetchedAt, lastError}`.

A source's `token` is **write-only** and never read back to the dashboard.

`PATCH` re-fetches rather than ageing the copy out, because a config change may
have changed the shape of what is fetched.

### Bindings

```
GET /api/widgets/:widgetId/templates
PUT /api/widgets/:widgetId/templates  { enabled?: string[] | null, sources?: Record<string,string> }
```

Behind the same per-widget access check as every other widget route. A blank
source id means "back to the seed" and is removed rather than stored.

### Health

`GET /api/health` reports `menu` — which copy is answering (`airtable` or
`snapshot`), how many items, when it was fetched, and the last error.

---

## 10. The dashboard page

`/templates` in the studio. Two halves, matching the architecture.

**The catalog** shows every template as a card: its description, the fields the
agent may emit with types and required flags, the exact JSON the agent writes,
and — fetched live — the hydrated result. That preview is the real hydrator's
output, not a mock-up, so what an operator sees is what a customer gets.

"Add to widget" picks a widget and optionally a source. It reads the widget's
current bindings first and merges, because a widget that renders everything
must not silently lose the rest when you add one template to it.

**The sources panel** lists each feed with its row count, when it was last
fetched, its refresh interval and its last error — which is the only place a
stale feed becomes visible, since a failed refresh deliberately keeps serving.
It creates Airtable, HTTP and inline sources, refreshes one on demand, and
deletes.

The page is its own lazily-loaded chunk (~11 kB gzipped ~3 kB) and is in the
sidebar for every signed-in role; editing is gated by role as above.

---

## 11. Adding a template

Five steps, two files plus a prompt.

**1. Register it.** Add a `TemplateDef` to `TEMPLATES` in `registry.ts`. Put it
in the position you want it to win ties — first match is what gets sent.

```ts
{
  name: 'offer_cards',
  title: 'Offer cards',
  description: 'Current promotions, newest first.',
  widgetType: 'offer_cards',
  emits: [{ key: 'limit', type: 'number', description: 'How many to show. Default 4.' }],
  sample: { limit: 2 },
  seed: () => OFFER_SEED,
  hydrate(data, rows) {
    const limit = typeof data.limit === 'number' ? data.limit : 4
    return { title: 'عروضنا', items: rows.slice(0, limit) }
  },
}
```

Keep `hydrate` pure and synchronous. It runs inside the streaming loop. If it
needs data, that data is a source, not a fetch.

**2. Write the renderer.** Add `offer-cards.tsx` next to the others in the SDK
and a `case 'offer_cards':` to `template-renderer.tsx`. Add its content type to
`sdk-src/src/features/conversation/types/message.ts`.

**3. Create a source** for its rows, from the dashboard. Or ship a `seed` and
add the source later — the template works either way, which is the point.

**4. Bind it** to the widgets that should have it, from `/templates`.

**5. Teach the agent.** Add the template to that agent's prompt with its exact
`data` shape, one short `message` line, and — the part that is always forgotten
— **when not to send it**. Re-sending a card the customer already has reads as
a bug. The contract lives in `TEMPLATES/WIDGET-TEMPLATES.md` in the Cinescape
prompts repo.

You do **not** touch the chat route.

---

## 12. Adding a data source

From `/templates` → **New source**.

**Airtable.** Base id (`app…`), table id (`tbl…`), optional view, optional
token. Leave the token blank to use the server's `AIRTABLE_TOKEN`. Pick a
refresh interval from the customer's editing habits, not from a wish for
freshness: every interval is a full table scan.

**HTTP JSON.** A URL, optional headers, and `path` if the array is nested. If
the endpoint returns the array at the top level, leave `path` empty.

**Inline.** Paste a JSON array. Useful for small tables that have no system of
record — store links, a handful of branches — and for testing a template's
hydrator against controlled rows before pointing it at a real feed.

Then preview: `GET /api/templates/:name/preview?source=<id>` renders the
template against the new source without binding anything.

---

## 13. Operations

**Is the menu live?** `GET /api/health` → `menu.source`. `airtable` means the
live copy is answering; `snapshot` means the compiled fallback is. The most
common cause of `snapshot` is an unset `AIRTABLE_TOKEN`.

**Is a source healthy?** `GET /api/datasources` → each `status`. A non-null
`lastError` with a recent `fetchedAt` means it failed and is still serving the
old copy, which is the intended behaviour and exactly why it must be visible.

**A feed changed and I need it now.** `POST /api/datasources/:id/refresh`, or
the refresh button on the card.

**Environment.** The Airtable settings are documented in `.env.example`:

```
AIRTABLE_TOKEN=
AIRTABLE_MENU_BASE=appRkp6YvIgE5m69N
AIRTABLE_MENU_TABLE=tblrzeqWS3OaV3OtQ
MENU_REFRESH_MS=900000
```

The agent-engine settings are read straight from `process.env`, not the zod
schema: `AGENT_ENGINE_URL`, `AGENT_ENGINE_AGENT`, `AGENT_ENGINE_KEY`. They are
now only defaults; a widget record overrides them.

**Redis keys.** All defined in one place, `server/src/lib/redis.ts`:

```
widget:{id}:templates      the bindings
datasource:{id}            the definition
datasource:{id}:cache      the last good copy (7-day TTL)
datasources                the set of ids
```

---

## 14. Testing

`server/src/lib/templates/hydrate.test.ts` — 11 tests pinning the behaviour
that moved out of the chat route:

- a branch id expands, and the model's `distance_km` survives the merge
- an unknown id passes through rather than inventing a card
- an empty price list renders all rows; a subset renders only those
- non-template and unregistered components pass through
- a template the widget has not enabled is dropped
- a bound source beats the seed
- a source that has produced nothing falls back to the seed
- several branch cards collect into one card list, in the reply's language
- the menu picks `price_list` without photos and `menu_cards` with them
- a reply with no template sends no `widget_template`

Run with `npm test` from the repo root. The suite is 71 tests total.

Note the test file sets `JWT_SECRET` and imports dynamically: the registry
pulls in Redis-backed modules that validate the environment at import time.

---

## 15. Design decisions and their reasons

**The data lives in the studio, not in the orchestrator.** The orchestrator
decides *what* to show; the studio fetches and renders it. The orchestrator has
no cache layer, and an extra round-trip per card would cost exactly the speed
this design exists for. An orchestrator endpoint can still *be* a source —
that is what `kind: 'http'` is for.

**Seeds are functions, not arrays.** A frozen fallback table is the drift
problem in miniature. The menu's fallback is itself a refreshing copy.

**Bindings are opt-in.** A widget with no record renders everything from seeds.
Making the new layer mandatory would have meant a migration and a window where
an unconfigured widget rendered nothing.

**Hydration is synchronous.** It runs per component inside an SSE loop.
Everything it needs — the binding, the rows — is resolved before the stream
opens. `rowsOf` never awaits and never throws.

**One sweep timer, not one per source.** N timers for N sources is N wakeups;
one sweep that checks staleness is one.

**Unregistered template names pass through.** Dropping them would mean a server
that is one deploy behind silently breaks a newer agent. Passing them through
means the worst case is a component the SDK ignores.

**Tokens are write-only.** A source's credential is never read back to the
dashboard, only replaced.

---

## 16. Known gaps

Honest list of what is not done.

- **The builder has no templates page.** Bindings are edited from `/templates`
  by picking a widget, not from inside the widget builder. A `TemplatesPage`
  alongside the other builder pages would be the natural home.
- **No per-source field mapping.** A source's rows must already match the shape
  the hydrator expects. An Airtable table with different column names needs a
  mapper, which would be a `map` field on the source config.
- **`menu_list`'s cinema filter is a hardcoded regex table** in the registry.
  It maps a customer's words to Airtable availability columns and is specific to
  one customer's schema. It should become source config.
- **No bulk binding.** Adding a template to twenty widgets is twenty actions.
- **The chat route is still Cinescape-shaped** in other ways: thinking-phrase
  tables, a hardcoded tool name, the demo page's inline renderer. The template
  engine is factored out; the route around it is not.
- **Uncommitted at time of writing.** The working tree also held unrelated
  in-progress Pusher-env and pairProxy work, interleaved in `server/src/app.ts`
  and `.env.example`.

---

## 17. File map

### New

| File | What it is |
|---|---|
| `server/src/lib/dataSource.ts` | The generic cached data source layer |
| `server/src/lib/templates/registry.ts` | The template definitions |
| `server/src/lib/templates/seeds.ts` | Compiled fallback rows, moved verbatim out of the chat route |
| `server/src/lib/templates/hydrate.ts` | `hydrateComponents`, `componentsToTemplate`, `rowsFor` |
| `server/src/lib/templates/hydrate.test.ts` | 11 tests |
| `server/src/services/templates.ts` | Per-widget bindings and the render-path cache |
| `server/src/routes/templates.ts` | Catalog and data source API |
| `web/src/pages/Templates.tsx` | The dashboard page |

### Changed

| File | Why |
|---|---|
| `server/src/routes/engineChat.ts` | Hydration and the static tables removed (~13.5 kB); per-widget agent and bindings threaded through |
| `server/src/routes/cinescapeMenuSource.ts` | Was written and never called; now wired up |
| `server/src/services/widgets.ts` | `engine`, `agentId`, `engineKey` on the record |
| `server/src/routes/widgets.ts` | Those fields in the schemas; the bindings routes |
| `server/src/lib/redis.ts` | Key helpers for bindings and sources |
| `server/src/app.ts` | Mounts the new routers; `menu` in health |
| `server/src/index.ts` | Starts the menu refresh and the source sweep, both unawaited |
| `.env.example` | The Airtable block |
| `web/src/lib/api.ts` | Types and calls for the new endpoints |
| `web/src/App.tsx`, `pages/routes.tsx`, `components/Shell.tsx` | Route, lazy chunk, nav item |
| `web/src/lib/i18n.tsx` | 39 strings, English and Arabic |

### Related, in the Cinescape prompts repo

`TEMPLATES/WIDGET-TEMPLATES.md` on branch `production-v4` — the `components`
contract as prompt authors need it: the seven templates, the exact `data` each
takes, and the rules that are easy to get wrong.
