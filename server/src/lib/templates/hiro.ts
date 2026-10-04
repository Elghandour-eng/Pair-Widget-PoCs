import type { TemplateDef } from './registry.js'

/**
 * Hiro's cards: a personal health companion's answers about the visitor's own
 * body scans, nutrition and training.
 *
 * Every one is `passthrough` — the rows are the visitor's own readings or
 * Hiro's catalogue, fetched by the agent's tools for this turn, so no shared
 * source applies — and `stackable`: one reply can carry several (a trend and
 * the scan behind it), and the widget draws them one under the other in the
 * order the agent sent them.
 *
 * `hydrate` only tidies: it keeps the shape the renderer expects, drops what
 * it cannot draw, and caps list lengths. It never invents a value.
 */

type Row = Record<string, unknown>

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}
const str = (v: unknown, max = 160): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const rows = (v: unknown, cap: number): Row[] =>
  (Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === 'object' && !Array.isArray(x)) : []).slice(0, cap)
const strs = (v: unknown, cap: number): string[] =>
  (Array.isArray(v) ? v.map((x) => str(x, 60)).filter((x): x is string => !!x) : []).slice(0, cap)
/** Drops keys whose value is undefined, so the card data stays small and honest. */
const clean = <T extends Row>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const DESIGN = ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize']
const DEFAULTS = { radius: 18, padding: 14, titleSize: 14 }

function hiro(def: Omit<TemplateDef, 'passthrough' | 'seed' | 'design' | 'designDefaults' | 'stackable'> & { design?: string[] }): TemplateDef {
  return { passthrough: true, stackable: true, seed: () => [], designDefaults: DEFAULTS, ...def, design: def.design ?? DESIGN }
}

const meal = (m: Row) =>
  clean({
    name: str(m.name),
    category: str(m.category, 40),
    calories: num(m.calories),
    protein_g: num(m.protein_g),
    carbs_g: num(m.carbs_g),
    fat_g: num(m.fat_g),
    image: str(m.image, 400),
  })

const exercise = (e: Row) =>
  clean({
    name: str(e.name),
    muscles: strs(e.muscles, 6),
    sets: num(e.sets),
    reps: str(e.reps, 20) ?? (num(e.reps) !== undefined ? String(num(e.reps)) : undefined),
    duration_seconds: num(e.duration_seconds),
    rest_seconds: num(e.rest_seconds),
    description: str(e.description, 220),
    image: str(e.image, 400),
  })

export const HIRO_TEMPLATES: TemplateDef[] = [
  hiro({
    name: 'hiro_body_snapshot',
    title: 'Hiro · Latest scan',
    description: 'The visitor’s latest body-scan readings as tiles, each marked low / healthy / high against its healthy range.',
    widgetType: 'hiro_body_snapshot',
    emits: [
      { key: 'title', type: 'string', description: 'Card heading in the reply language, e.g. "Your latest scan".' },
      { key: 'date', type: 'string', description: 'Scan date, YYYY-MM-DD, from the metric’s created_at.' },
      { key: 'score', type: 'number', description: 'body_score (0–100) when present.' },
      { key: 'items', type: 'array', required: true, description: 'Up to 8, each {key, label, value, unit, min?, max?, better?}. min/max are the healthy range from the *_min/*_max fields; better is "up" when more is good (muscle, water, protein, bone, BMR) and "down" when less is (body fat, fat mass, visceral fat).' },
    ],
    sample: { title: 'Your latest scan', date: '2026-09-17', score: 83, items: [{ key: 'weight', label: 'Weight', value: 75.1, unit: 'kg', min: 57.3, max: 77.5 }, { key: 'body_fat', label: 'Body fat', value: 16.6, unit: '%', min: 10, max: 20 }] },
    hydrate: (d) =>
      clean({
        title: str(d.title),
        date: str(d.date, 20),
        score: num(d.score),
        items: rows(d.items, 8)
          .map((i) =>
            clean({
              key: str(i.key, 30),
              label: str(i.label, 40),
              value: num(i.value),
              unit: str(i.unit, 10),
              min: num(i.min),
              max: num(i.max),
              better: i.better === 'up' || i.better === 'down' ? i.better : undefined,
            }),
          )
          .filter((i) => i.label && i.value !== undefined),
      }),
  }),
  hiro({
    name: 'hiro_progress_trend',
    title: 'Hiro · Progress trend',
    description: 'How weight, muscle and body fat moved across the visitor’s scans: one small chart per measure, with the change since the first reading.',
    widgetType: 'hiro_progress_trend',
    emits: [
      { key: 'title', type: 'string', description: 'Heading, e.g. "Your progress".' },
      { key: 'verdict', type: 'string', description: 'One sentence that answers the question, e.g. "You lost 2.6 kg — mostly fat, and kept your muscle."' },
      { key: 'series', type: 'array', required: true, description: 'Up to 4, each {key, label, unit, better: "up"|"down", points: [{date, value}]} oldest first, copied from measurement_report.' },
    ],
    sample: { title: 'Your progress', verdict: 'Down 2.6 kg, mostly fat.', series: [{ key: 'weight', label: 'Weight', unit: 'kg', better: 'down', points: [{ date: '2026-08-12', value: 77.7 }, { date: '2026-09-17', value: 75.1 }] }] },
    hydrate: (d) =>
      clean({
        title: str(d.title),
        verdict: str(d.verdict, 240),
        series: rows(d.series, 4)
          .map((s) =>
            clean({
              key: str(s.key, 30),
              label: str(s.label, 40),
              unit: str(s.unit, 10),
              better: s.better === 'up' ? 'up' : s.better === 'down' ? 'down' : undefined,
              points: rows(s.points, 24)
                .map((p) => ({ date: str(p.date, 20) ?? '', value: num(p.value) }))
                .filter((p): p is { date: string; value: number } => p.value !== undefined),
            }),
          )
          .filter((s) => s.label && Array.isArray(s.points) && s.points.length > 0),
      }),
  }),
  hiro({
    name: 'hiro_body_composition',
    title: 'Hiro · Body composition',
    description: 'What the visitor’s weight is made of — muscle, fat, water, bone, protein — as one stacked bar with a legend.',
    widgetType: 'hiro_body_composition',
    emits: [
      { key: 'title', type: 'string', description: 'Heading.' },
      { key: 'total', type: 'number', description: 'Total weight in kg.' },
      { key: 'parts', type: 'array', required: true, description: 'Up to 6, each {key, label, kg}.' },
    ],
    sample: { title: 'What your 75.1 kg is made of', total: 75.1, parts: [{ key: 'muscle', label: 'Muscle', kg: 17.95 }, { key: 'fat', label: 'Fat', kg: 12.47 }] },
    hydrate: (d) =>
      clean({
        title: str(d.title),
        total: num(d.total),
        parts: rows(d.parts, 6)
          .map((p) => clean({ key: str(p.key, 30), label: str(p.label, 30), kg: num(p.kg) }))
          .filter((p) => p.label && (p.kg ?? 0) > 0),
      }),
  }),
  hiro({
    name: 'hiro_goal_progress',
    title: 'Hiro · Goal progress',
    description: 'Where the visitor stands against a goal (target weight, say): a progress bar and how much is left.',
    widgetType: 'hiro_goal_progress',
    emits: [
      { key: 'label', type: 'string', required: true, description: 'What the goal is, e.g. "Target weight".' },
      { key: 'current', type: 'number', required: true, description: 'Current value.' },
      { key: 'target', type: 'number', required: true, description: 'Goal value (target_weight).' },
      { key: 'start', type: 'number', description: 'The first reading, when the history has one.' },
      { key: 'unit', type: 'string', description: 'kg, %, …' },
      { key: 'note', type: 'string', description: 'One short line of encouragement or context.' },
    ],
    sample: { label: 'Target weight', current: 75.1, target: 72.8, start: 77.7, unit: 'kg' },
    hydrate: (d) =>
      clean({ label: str(d.label, 60), current: num(d.current), target: num(d.target), start: num(d.start), unit: str(d.unit, 10), note: str(d.note, 200) }),
  }),
  hiro({
    name: 'hiro_macro_targets',
    title: 'Hiro · Daily targets',
    description: 'A daily calorie target and its protein / carbs / fat split, as a ring and three bars.',
    widgetType: 'hiro_macro_targets',
    emits: [
      { key: 'title', type: 'string', description: 'Heading.' },
      { key: 'calories', type: 'number', required: true, description: 'kcal per day.' },
      { key: 'protein_g', type: 'number', required: true, description: 'grams' },
      { key: 'carbs_g', type: 'number', required: true, description: 'grams' },
      { key: 'fat_g', type: 'number', required: true, description: 'grams' },
      { key: 'note', type: 'string', description: 'How it was worked out, one line (e.g. "BMR 1,722 × activity, −300 for fat loss").' },
    ],
    sample: { title: 'Your daily targets', calories: 2100, protein_g: 150, carbs_g: 210, fat_g: 70 },
    hydrate: (d) =>
      clean({ title: str(d.title), calories: num(d.calories), protein_g: num(d.protein_g), carbs_g: num(d.carbs_g), fat_g: num(d.fat_g), note: str(d.note, 200) }),
  }),
  hiro({
    name: 'hiro_muscle_balance',
    title: 'Hiro · Muscle balance',
    description: 'Muscle by segment — left and right arms and legs — so imbalances stand out.',
    widgetType: 'hiro_muscle_balance',
    emits: [
      { key: 'title', type: 'string', description: 'Heading.' },
      { key: 'unit', type: 'string', description: 'kg' },
      { key: 'segments', type: 'array', required: true, description: 'Each {key: left_arm|right_arm|left_leg|right_leg|trunk, label, value}.' },
      { key: 'note', type: 'string', description: 'One line on what the balance means.' },
    ],
    sample: { title: 'Muscle balance', unit: 'kg', segments: [{ key: 'left_arm', label: 'Left arm', value: 3.65 }, { key: 'right_arm', label: 'Right arm', value: 3.62 }] },
    hydrate: (d) =>
      clean({
        title: str(d.title),
        unit: str(d.unit, 10),
        note: str(d.note, 200),
        segments: rows(d.segments, 6)
          .map((s) => clean({ key: str(s.key, 20), label: str(s.label, 30), value: num(s.value) }))
          .filter((s) => s.label && s.value !== undefined),
      }),
  }),
  hiro({
    name: 'hiro_meal_cards',
    title: 'Hiro · Meals',
    description: 'Meals from Hiro’s catalogue as cards with calories and macros.',
    widgetType: 'hiro_meal_cards',
    emits: [
      { key: 'title', type: 'string', description: 'Heading.' },
      { key: 'items', type: 'array', required: true, description: 'Up to 8, each {name, category, calories, protein_g, carbs_g, fat_g, image?} copied from the meals tool.' },
    ],
    sample: { title: 'High-protein dinners', items: [{ name: 'Baked Salmon with Sweet Potato', category: 'Dinner', calories: 520, protein_g: 38, carbs_g: 35, fat_g: 22 }] },
    hydrate: (d) => clean({ title: str(d.title), items: rows(d.items, 8).map(meal).filter((m) => m.name) }),
  }),
  hiro({
    name: 'hiro_meal_plan',
    title: 'Hiro · Meal plan',
    description: 'A meal plan: its goal, calorie target and the meals in it, with the day’s totals worked out here.',
    widgetType: 'hiro_meal_plan',
    emits: [
      { key: 'name', type: 'string', required: true, description: 'Plan name.' },
      { key: 'goal', type: 'string', description: 'weight_loss, muscle_gain…, shown in words.' },
      { key: 'target_calories', type: 'number', description: 'kcal' },
      { key: 'meals', type: 'array', required: true, description: 'Up to 8, each {name, category, calories, protein_g, carbs_g, fat_g}.' },
    ],
    sample: { name: 'Weight Loss Starter Plan', goal: 'Weight loss', target_calories: 1500, meals: [{ name: 'Chicken Salad', category: 'Lunch', calories: 380, protein_g: 32, carbs_g: 15, fat_g: 20 }] },
    hydrate: (d) => {
      const meals = rows(d.meals, 8).map(meal).filter((m) => m.name)
      const sum = (k: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g') => Math.round(meals.reduce((a, m) => a + ((m[k] as number | undefined) ?? 0), 0))
      return clean({
        name: str(d.name),
        goal: str(d.goal, 40),
        target_calories: num(d.target_calories),
        meals,
        totals: { calories: sum('calories'), protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') },
      })
    },
  }),
  hiro({
    name: 'hiro_workout_plan',
    title: 'Hiro · Workout plan',
    description: 'A workout plan: duration, difficulty, calories and its exercises grouped into blocks (warm-up, main, cool-down).',
    widgetType: 'hiro_workout_plan',
    emits: [
      { key: 'name', type: 'string', required: true, description: 'Plan name.' },
      { key: 'goal', type: 'string', description: 'In words.' },
      { key: 'difficulty', type: 'string', description: 'beginner / intermediate / advanced, in words.' },
      { key: 'duration_minutes', type: 'number', description: 'minutes' },
      { key: 'estimated_calories', type: 'number', description: 'kcal' },
      { key: 'muscles', type: 'array', description: 'Target muscle groups, in words.' },
      { key: 'blocks', type: 'array', required: true, description: 'Each {name, exercises: [{name, sets?, reps?, duration_seconds?, rest_seconds?}]}.' },
    ],
    sample: { name: 'Fat Burning HIIT Circuit', difficulty: 'Intermediate', duration_minutes: 30, estimated_calories: 400, blocks: [{ name: 'Main', exercises: [{ name: 'Burpees', sets: 3, reps: '12' }] }] },
    hydrate: (d) =>
      clean({
        name: str(d.name),
        goal: str(d.goal, 40),
        difficulty: str(d.difficulty, 30),
        duration_minutes: num(d.duration_minutes),
        estimated_calories: num(d.estimated_calories),
        muscles: strs(d.muscles, 6),
        blocks: rows(d.blocks, 5)
          .map((b) => ({ name: str(b.name, 40) ?? '', exercises: rows(b.exercises, 12).map(exercise).filter((e) => e.name) }))
          .filter((b) => b.exercises.length > 0),
      }),
  }),
  hiro({
    name: 'hiro_exercise_cards',
    title: 'Hiro · Exercises',
    description: 'Exercises as cards: target muscles, sets × reps, rest, and a one-line how-to.',
    widgetType: 'hiro_exercise_cards',
    emits: [
      { key: 'title', type: 'string', description: 'Heading.' },
      { key: 'items', type: 'array', required: true, description: 'Up to 8, each {name, muscles, sets, reps, rest_seconds, duration_seconds?, description, image?}.' },
    ],
    sample: { title: 'Leg day', items: [{ name: 'Squats', muscles: ['Quads', 'Glutes'], sets: 4, reps: '10-12', rest_seconds: 90 }] },
    hydrate: (d) => clean({ title: str(d.title), items: rows(d.items, 8).map(exercise).filter((e) => e.name) }),
  }),
  hiro({
    name: 'hiro_insight',
    title: 'Hiro · Key points',
    description: 'A short card of takeaways or next steps, tinted by tone (good news, worth watching, or neutral).',
    widgetType: 'hiro_insight',
    emits: [
      { key: 'title', type: 'string', required: true, description: 'Heading.' },
      { key: 'tone', type: 'string', description: 'good | watch | info' },
      { key: 'points', type: 'array', required: true, description: '2–5 short lines.' },
    ],
    sample: { title: 'What to focus on', tone: 'info', points: ['Keep protein near 150 g a day', 'Two strength sessions a week'] },
    hydrate: (d) =>
      clean({
        title: str(d.title, 80),
        tone: d.tone === 'good' || d.tone === 'watch' ? d.tone : 'info',
        points: (Array.isArray(d.points) ? d.points.map((p) => str(p, 160)) : []).filter((p): p is string => !!p).slice(0, 5),
      }),
  }),
]
