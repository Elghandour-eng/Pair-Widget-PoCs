import { describe, expect, it } from 'vitest'
import { componentsToTemplate, hydrateComponents } from './hydrate.js'
import { componentFromTool, questionFromButtons } from './pairPlugin.js'

describe('pair plugin components', () => {
  it('turns a ticket call into a ticket card carrying the id Pair returned', () => {
    const comp = componentFromTool(
      'pair_create_ticket',
      JSON.stringify({ title: 'Refund', description: 'Charged twice', priority: 'HIGH' }),
      JSON.stringify({ data: { ulid: '01TICKET', number: 'TCK-7' } }),
    )
    const [hydrated] = hydrateComponents([comp]) as Array<{ data: Record<string, unknown> }>
    expect(hydrated.data).toMatchObject({ ticket_id: 'TCK-7', title: 'Refund', priority: 'high', status: 'open' })
    expect(componentsToTemplate([hydrated as never], 'تم فتح تذكرة')?.type).toBe('ticket_card')
  })

  it('shows a ticket whose call returned no id as pending, never as open', () => {
    const comp = componentFromTool('pair_create_ticket', '{"title":"Lost item","description":"x"}', 'error: conversation not found')
    expect((comp!.data as { status: string; ticket_id: string })).toMatchObject({ status: 'pending', ticket_id: '' })
  })

  it('wins its place over a card the agent emitted in the same reply', () => {
    const ticket = componentFromTool('pair_create_ticket', '{"title":"T","description":"d"}', '{"id":"9"}')
    const comps = hydrateComponents([ticket, { type: 'template', template: 'price_list', data: {} }]) as never[]
    expect(componentsToTemplate(comps, 'hello')?.type).toBe('ticket_card')
  })

  it('renders a link and an image from their send calls, and drops a non-http url', () => {
    const link = componentFromTool('pair_send_link', '{"text":"Pay","cta_text":"Pay now","url":"https://x.test/p"}', 'sent')
    const [l] = hydrateComponents([link]) as Array<{ data: Record<string, unknown> }>
    expect(l.data).toMatchObject({ url: 'https://x.test/p', cta_text: 'Pay now' })
    const bad = componentFromTool('pair_send_image', '{"url":"javascript:alert(1)"}', 'sent')
    const [b] = hydrateComponents([bad]) as Array<{ data: Record<string, unknown> }>
    expect(b.data.url).toBe('')
  })

  it('lists tickets from the tool result and ignores tools that are not the plugin\'s', () => {
    const list = componentFromTool('pair_list_tickets', '{}', JSON.stringify({ data: [{ ulid: 'A', title: 'One', status: 'resolved' }] }))
    const [h] = hydrateComponents([list]) as Array<{ data: { items: unknown[] } }>
    expect(h.data.items).toEqual([{ ticket_id: 'A', title: 'One', status: 'resolved', priority: '' }])
    expect(componentFromTool('cinescape_locations', '{}', '{}')).toBeNull()
    expect(componentFromTool('pair_list_tickets', '{}', '[]')).toBeNull()
  })

  it('maps buttons onto the single-choice question, and needs at least two', () => {
    expect(questionFromButtons('pair_send_buttons', '{"text":"Which?","buttons":["A","B"]}')).toMatchObject({ type: 'question', select: 'single', options: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }] })
    expect(questionFromButtons('pair_send_buttons', '{"text":"Which?","buttons":["A"]}')).toBeNull()
  })
})
