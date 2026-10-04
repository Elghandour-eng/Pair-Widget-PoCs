import { describe, expect, it } from 'vitest'

// The registry pulls in Redis-backed modules, which validate the env on import.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-1234'

const { componentsToTemplate, hydrateComponents } = await import('./hydrate.js')

type Row = Record<string, unknown>
const comp = (template: string, data: Row = {}) => ({ type: 'template', template, data })
const hydrate = (list: unknown[]) => hydrateComponents(list) as Row[]

describe('Hiro cards', () => {
  it('stack in the order the agent sent them', () => {
    const comps = hydrate([
      comp('hiro_progress_trend', { title: 'Progress', series: [{ label: 'Weight', unit: 'kg', better: 'down', points: [{ date: '2026-07-02', value: 78.1 }, { date: '2026-09-17', value: 75.1 }] }] }),
      comp('hiro_insight', { title: 'Next', tone: 'good', points: ['Keep protein up'] }),
    ])
    const t = componentsToTemplate(comps, 'You lost 3 kg') as { type: string; content: { lang: string; items: Array<{ type: string }> } }
    expect(t.type).toBe('stack')
    expect(t.content.lang).toBe('en')
    expect(t.content.items.map((i) => i.type)).toEqual(['hiro_progress_trend', 'hiro_insight'])
  })

  it('a single Hiro card is sent on its own, in the reply language', () => {
    const t = componentsToTemplate(hydrate([comp('hiro_insight', { title: 'نصيحة', points: ['بروتين'] })]), 'أهلاً') as { type: string; content: Row }
    expect(t.type).toBe('hiro_insight')
    expect(t.content.lang).toBe('ar')
  })

  it('leaves Cinescape on one card per reply', () => {
    const t = componentsToTemplate(hydrate([comp('app_links'), comp('price_list')]), 'hi') as { type: string }
    expect(t.type).not.toBe('stack')
  })

  it('tidies the agent data: drops unknown fields and unusable rows, never invents values', () => {
    const [card] = hydrate([
      comp('hiro_body_snapshot', {
        title: 'Scan',
        injected: '<script>',
        items: [
          { key: 'weight', label: 'Weight', value: '75.12', unit: 'kg', min: 57.3, max: 77.5 },
          { key: 'muscle', label: 'Muscle', value: 58.4, unit: 'kg', better: 'up' },
          { label: 'No value' },
          { key: 'x', label: 'Bad better', value: 1, better: 'sideways' },
        ],
      }),
    ])
    const data = card.data as { injected?: unknown; items: Row[] }
    expect(data.injected).toBeUndefined()
    expect(data.items.map((i) => i.label)).toEqual(['Weight', 'Muscle', 'Bad better'])
    expect(data.items[0].value).toBe(75.12)
    expect(data.items[1].better).toBe('up')
    expect(data.items[2].better).toBeUndefined()
  })

  it('works out a meal plan’s day totals from its meals', () => {
    const [card] = hydrate([
      comp('hiro_meal_plan', {
        name: 'Plan',
        meals: [
          { name: 'A', calories: '380', protein_g: 32, carbs_g: 15, fat_g: 20 },
          { name: 'B', calories: 400, protein_g: 30, carbs_g: 12, fat_g: 24 },
        ],
      }),
    ])
    expect((card.data as { totals: Row }).totals).toEqual({ calories: 780, protein_g: 62, carbs_g: 27, fat_g: 44 })
  })
})

describe('the card the model left out', async () => {
  const { hiroCardFromTool } = await import('./hiro.js')
  const exercises = JSON.stringify({ data: { exercises: { items: [{ exercise_name: 'Squats', target_muscle_groups: ['quads'], default_sets: 4, default_reps: '10-12', default_rest_seconds: 90, images: [{ image_path: 'uploads/ex/squat.jpg' }], videos: [] }] } } })

  it('draws exercise cards from the exercises tool, in the reply language, with Hiro media links', () => {
    const card = hiroCardFromTool('hiro_exercises', exercises, 'ar') as { template: string; data: { title: string; items: Row[] } }
    expect(card.template).toBe('hiro_exercise_cards')
    expect(card.data.title).toBe('تمارين مقترحة')
    const [hydrated] = hydrate([card]) as Array<{ data: { items: Row[] } }>
    expect(hydrated.data.items[0]).toMatchObject({ name: 'Squats', sets: 4, reps: '10-12', rest_seconds: 90 })
    expect(hydrated.data.items[0].image).toBe('https://hiro-backend.dev.k8s.trypair.ai/api/v2/uploads/ex/squat.jpg')
  })

  it('draws nothing from a cut-off result or an unknown tool', () => {
    expect(hiroCardFromTool('hiro_exercises', exercises.slice(0, 40), 'en')).toBeUndefined()
    expect(hiroCardFromTool('hiro_body_metrics', exercises, 'en')).toBeUndefined()
  })
})
