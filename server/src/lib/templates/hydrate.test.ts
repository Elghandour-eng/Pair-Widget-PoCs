import { describe, expect, it } from 'vitest'

// The registry pulls in Redis-backed modules, which validate the env on import.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-1234'

const { resetDataSources, seedSource } = await import('../dataSource.js')
type DataSourceDef = import('../dataSource.js').DataSourceDef
const { ALL_TEMPLATES, componentsToTemplate, hydrateComponents } = await import('./hydrate.js')
type TemplateBinding = import('./hydrate.js').TemplateBinding

const comp = (template: string, data: Record<string, unknown> = {}) => ({ type: 'template', template, data })
const hydrated = (list: unknown[], binding: TemplateBinding = ALL_TEMPLATES) =>
  hydrateComponents(list, binding) as Array<{ template?: string; data?: Record<string, unknown> }>

const defOf = (id: string): DataSourceDef => ({
  id, name: id, kind: 'inline', ttlMs: 0, config: {},
  createdAt: '', createdBy: '', updatedAt: '', updatedBy: '',
})

describe('hydrateComponents', () => {
  it('expands a branch id into the full card and lets the model keep its own fields', () => {
    const [card] = hydrated([comp('location_card', { id: '1', distance_km: 3.2 })])
    expect(card.data?.name).toBe('Cinescape 360')
    expect(card.data?.maps_url).toContain('maps.google.com')
    // the model computed this one; the source must not overwrite it
    expect(card.data?.distance_km).toBe(3.2)
  })

  it('passes an unknown branch id through rather than inventing a card', () => {
    const [card] = hydrated([comp('location_card', { id: 'nope' })])
    // the design always rides along; nothing else is added to an unresolved reference
    const { design, ...rest } = card.data as Record<string, unknown>
    expect(rest).toEqual({ id: 'nope' })
    expect(design).toBeTruthy()
  })

  it('renders the whole price list when the model sends none, and just the subset when it does', () => {
    const [all] = hydrated([comp('price_list')])
    expect((all.data?.items as unknown[]).length).toBeGreaterThan(5)
    const [some] = hydrated([comp('price_list', { items: [{ label: 'VIP', price: '8.000' }] })])
    expect(some.data?.items).toHaveLength(1)
    expect(some.data?.currency).toBe('د.ك')
  })

  it('leaves non-template components and unregistered template names untouched', () => {
    const out = hydrated([{ type: 'suggestions', items: ['a'] }, comp('something_new', { x: 1 })])
    expect(out[0]).toEqual({ type: 'suggestions', items: ['a'] })
    expect(out[1].data).toEqual({ x: 1 })
  })

  it('drops a template the widget has not enabled', () => {
    const binding: TemplateBinding = { enabled: new Set(['price_list']), sources: {} }
    expect(hydrated([comp('app_links'), comp('price_list')], binding)).toHaveLength(1)
  })

  it('prefers a bound data source over the compiled seed', () => {
    resetDataSources()
    seedSource(defOf('branches'), [{ id: '1', name: 'Somewhere Else', lat: 1, lng: 2 }])
    const binding: TemplateBinding = { enabled: null, sources: { location_card: 'branches' } }
    const [card] = hydrated([comp('location_card', { id: '1' })], binding)
    expect(card.data?.name).toBe('Somewhere Else')
    resetDataSources()
  })

  it('falls back to the seed when the bound source has produced nothing', () => {
    resetDataSources()
    const binding: TemplateBinding = { enabled: null, sources: { location_card: 'never-loaded' } }
    const [card] = hydrated([comp('location_card', { id: '1' })], binding)
    expect(card.data?.name).toBe('Cinescape 360')
  })
})

describe('design', () => {
  it('sends the template\u2019s defaults when the widget has customised nothing', () => {
    const [card] = hydrated([comp('price_list')])
    expect(card.data?.design).toMatchObject({ radius: 16, padding: 16, divider: 'dashed' })
  })

  it('lets a widget override one knob and keeps the rest', () => {
    const binding: TemplateBinding = { enabled: null, sources: {}, designs: { price_list: { radius: 4, accent: '#0aa' } } }
    const [card] = hydrated([comp('price_list')], binding)
    expect(card.data?.design).toMatchObject({ radius: 4, accent: '#0aa', divider: 'dashed' })
  })

  it('drops a knob the template does not honour', () => {
    // price_list has no columns control, so a stray value must not reach the renderer
    const binding: TemplateBinding = { enabled: null, sources: {}, designs: { price_list: { columns: 3 } } }
    const [card] = hydrated([comp('price_list')], binding)
    expect((card.data?.design as Record<string, unknown>).columns).toBeUndefined()
  })

  it('clamps a number to the field\u2019s range and rejects a bad colour', () => {
    const binding: TemplateBinding = { enabled: null, sources: {}, designs: { price_list: { radius: 999, accent: 'red' } } }
    const [card] = hydrated([comp('price_list')], binding)
    const design = card.data?.design as Record<string, unknown>
    expect(design.radius).toBe(32)
    expect(design.accent).toBeUndefined()
  })
})

describe('componentsToTemplate', () => {
  it('collects several branch cards into one card list and follows the reply language', () => {
    const comps = hydrated([comp('location_card', { id: '1' }), comp('location_card', { id: '8' })])
    const t = componentsToTemplate(comps as Array<Record<string, unknown>>, 'هذي أقرب سينمات')
    expect(t?.type).toBe('location_cards')
    expect((t?.content as { lang: string; cards: unknown[] }).lang).toBe('ar')
    expect((t?.content as { cards: unknown[] }).cards).toHaveLength(2)
  })

  it('sends the menu as a price list when its items carry no photos', () => {
    const comps = [{ type: 'template', template: 'menu_list', data: { items: [{ label: 'Water', price: '0.250' }] } }]
    expect(componentsToTemplate(comps, 'here you go')?.type).toBe('price_list')
  })

  it('sends the menu as photo cards as soon as one item has an image', () => {
    const comps = [{ type: 'template', template: 'menu_list', data: { items: [{ label: 'Water', price: '0.250', image: '/a.jpg' }] } }]
    expect(componentsToTemplate(comps, 'here you go')?.type).toBe('menu_cards')
  })

  it('sends nothing when the reply carries no template', () => {
    expect(componentsToTemplate([{ type: 'suggestions', items: ['a'] }], 'hi')).toBeUndefined()
  })
})
