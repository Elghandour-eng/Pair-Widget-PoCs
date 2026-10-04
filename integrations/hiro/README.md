# Ask Hiro

Hiro's personal health companion: a chat screen in the Hiro app that reads the
user's own body scans and suggests meals and workouts from Hiro's catalogue,
answering with rich cards.

```
Hiro app (web view) ── metadata {phone, user_id, name} ──▶ widget (HIRO_ASK)
        │                                                     │ every message carries them
        ▼                                                     ▼
   embed-example.html                           studio  ── inputs ──▶ Danah agent `hiro`
                                                                          │ tools
                                         dev.hiro.pro (scans, favourites) ┤
                                       hiro-backend /api/v2 (meals, plans) ┘
```

## What is here

| File | What it is |
|---|---|
| `hiro-agent.json` | The Danah agent (`{agent, tools}`, the body of `PUT /v1/admin/agents/hiro`). Model: OpenAI `gpt-4.1`. |
| `agent-prompt.md` | The same prompt, readable. |
| `provision_hiro.py` | Creates or updates the `HIRO_ASK` widget in a studio: uploads `assets/`, saves the design, points chat at the agent. |
| `assets/` | The animated orb (hero) and the three card icons. |
| `embed-example.html` | How the app embeds it. |

## The agent's keys

The tools read three environment variables of the Danah instance (names start
with `AGENT_` because Danah only lets agents read allow-listed names):

- `AGENT_HIRO_METRICS_TOKEN` — `X-API-TOKEN` for `dev.hiro.pro …/get-device-health-metrics`
- `AGENT_HIRO_FAVORITES_TOKEN` — `X-API-TOKEN` for `dev.hiro.pro …/get-user-favorites`
- `AGENT_HIRO_API_TOKEN` — `Bearer` token (`hiro_…`) for `hiro-backend.dev.k8s.trypair.ai/api/v2`

Danah reads its environment at start, so adding them needs a restart.

## Setting it up

1. On the Danah instance: add the three variables, restart, create a workspace
   for Hiro, then `POST /v1/admin/agents {id: "hiro", workspace}` and
   `PUT /v1/admin/agents/hiro` with `hiro-agent.json`. Create an application
   key: `POST /v1/admin/agents/hiro/api-keys`.
2. On the studio: `python3 provision_hiro.py <studio> <admin email> <password> <danah url> <app key>`.
3. In the app: `embed-example.html`, with the signed-in user's phone, id and name.

## Cards

Registered in `server/src/lib/templates/hiro.ts`, drawn by
`sdk-src/.../widget-template/hiro-cards.tsx`. Several in one reply stack in the
order the agent sent them.

| Card | Answers |
|---|---|
| `hiro_progress_trend` | Am I losing fat or muscle? Is my weight improving? |
| `hiro_body_snapshot` | How am I doing? Latest scan, each reading against its healthy range |
| `hiro_body_composition` | What is my weight made of (water, protein, fat, bone) |
| `hiro_goal_progress` | How close am I to my target weight |
| `hiro_muscle_balance` | Left vs right arms and legs |
| `hiro_macro_targets` | How much should I eat (calories and macros) |
| `hiro_meal_cards` / `hiro_meal_plan` | Meal ideas / a day's plan with totals |
| `hiro_workout_plan` / `hiro_exercise_cards` | A routine by block / exercises with sets and reps |
| `hiro_insight` | What to focus on next |
