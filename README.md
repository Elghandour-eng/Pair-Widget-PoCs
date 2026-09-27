# Pair Widget PoCs — Widget Studio

A small, production-grade dashboard for designing Pair chat widgets per channel.

Register a **channel name + Pair widget ID**, then choose where that widget's design is served from:

| Source | Behaviour |
| --- | --- |
| **Pair API** | The public endpoint proxies `GET https://system.trypair.ai/v1/widget/{id}/config` live (cached 60 s in Redis). Nothing is stored. |
| **Redis** | The design JSON lives in Redis and is edited here. Pair is never called for that widget. |

Either way the widget itself only needs one URL:

```
GET /api/public/widget/{widgetId}/config      # same shape as Pair's config endpoint
```

The response carries `X-Config-Source: api|redis` so you can always tell where a design came from.

## Stack

- **Server** — Node 22, Express, TypeScript, ioredis, JWT auth (bcrypt), Zod validation, Helmet, rate limiting, pino logging, graceful shutdown, vitest integration tests.
- **Web** — React 19, Vite 7, Tailwind 4, React Router. Pair-styled UI with a live widget preview (light/dark), a structured design form, a raw JSON editor, an API-vs-Redis diff view and an activity log per widget.
- **Storage** — Redis only (users, widgets, configs, audit, API cache). All keys are prefixed (`REDIS_PREFIX`).

## Roles

| Role | Can |
| --- | --- |
| `viewer` | Sign in, browse widgets, see previews and diffs |
| `editor` | Everything above + register widgets, import from Pair, edit and save designs, switch the source |
| `admin` | Everything above + manage users, delete widgets |

Safeguards: the last admin cannot be demoted or deleted, and a user cannot delete themselves.

## Quick start

```bash
cp .env.example .env          # set JWT_SECRET, seed accounts, Redis URL
npm install
npm run dev                   # server :4100 + web :5173 (proxied)
```

Seed accounts are created on first boot from `SEED_ADMIN_*` and `SEED_USERS` (`email:password:role,…`). Quote values that contain `#`.

Production:

```bash
npm run build                 # server/dist + web/dist
npm start                     # serves API and the built dashboard from :4100
# or
docker compose up -d --build
# or
pm2 start ecosystem.config.cjs
```

## API

All dashboard routes require `Authorization: Bearer <jwt>`.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | – | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/widgets` | any | List widgets |
| GET | `/api/widgets/peek/:widgetId` | any | Fetch a Pair config without registering |
| POST | `/api/widgets` | editor | Register `{ widgetId, channelName, source, importFromApi, apiBaseUrl?, notes? }` |
| GET | `/api/widgets/:widgetId` | any | Widget + stored config + audit |
| PATCH | `/api/widgets/:widgetId` | editor | Update name / source / notes / API base |
| DELETE | `/api/widgets/:widgetId` | admin | Remove widget and its Redis config |
| GET | `/api/widgets/:widgetId/config?source=api\|redis` | any | Resolved config (override to compare) |
| PUT | `/api/widgets/:widgetId/config` | editor | Save design JSON to Redis |
| POST | `/api/widgets/:widgetId/import` | editor | Snapshot the live Pair design into Redis |
| GET/POST/PATCH/DELETE | `/api/users[/:id]` | admin | User management |
| GET | `/api/public/widget/:widgetId/config` | public | What the widget consumes |
| GET | `/api/health` | public | Liveness + Redis status |

## Redis layout

```
{prefix}users                         SET of user ids
{prefix}user:{id}                     JSON user (bcrypt hash)
{prefix}user:email:{email}            id
{prefix}widgets                       SET of widget ids
{prefix}widget:{id}                   JSON metadata (channel, source, audit stamps)
{prefix}widget:{id}:config            JSON design (the Redis override)
{prefix}widget:{id}:audit             LIST of last 50 actions
{prefix}cache:api:{id}                60 s cache of the live Pair config
```

## Tests

```bash
npm test        # spins the app on a random port against REDIS_URL (db 9, prefix pwp-test:)
```
