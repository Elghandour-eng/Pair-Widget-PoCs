import { describe, expect, it } from 'vitest'
import { render, sanitizeHtml, toTemplateDef, type CustomTemplateDef } from './customTemplates.js'

/**
 * The two rules a studio template lives by: the holes are filled from the data
 * and nothing else, and what an operator (or a model) wrote can style a card
 * and can do nothing else.
 */

const def = (over: Partial<CustomTemplateDef> = {}): CustomTemplateDef => ({
  name: 'order_card',
  title: 'Order',
  description: '',
  category: 'commerce',
  fields: [],
  html: '',
  sample: {},
  createdAt: '', createdBy: '', updatedAt: '', updatedBy: '',
  ...over,
})

describe('render', () => {
  it('fills a hole with a value', () => {
    expect(render('<b>{{name}}</b>', { name: 'Taha' })).toBe('<b>Taha</b>')
  })

  it('escapes what it fills in, so data can never become markup', () => {
    expect(render('<b>{{name}}</b>', { name: '<script>alert(1)</script>' })).toBe(
      '<b>&lt;script&gt;alert(1)&lt;/script&gt;</b>',
    )
  })

  it('renders an unknown field as nothing rather than leaving the hole', () => {
    expect(render('<b>{{missing}}</b>', {})).toBe('<b></b>')
  })

  it('repeats a block over an array, with the item in scope', () => {
    const out = render('{{#each items}}<li>{{label}} · {{@index}}</li>{{/each}}', {
      items: [{ label: 'Tea' }, { label: 'Cake' }],
    })
    expect(out).toBe('<li>Tea · 0</li><li>Cake · 1</li>')
  })

  it('repeats over bare values with {{.}}', () => {
    expect(render('{{#each tags}}<i>{{.}}</i>{{/each}}', { tags: ['a', 'b'] })).toBe('<i>a</i><i>b</i>')
  })

  it('drops a conditional block when the value is missing or empty', () => {
    expect(render('{{#if gate}}<b>{{gate}}</b>{{/if}}', { gate: '' })).toBe('')
    expect(render('{{#if gate}}<b>{{gate}}</b>{{/if}}', { gate: 'B12' })).toBe('<b>B12</b>')
    expect(render('{{#if list}}x{{/if}}', { list: [] })).toBe('')
  })

  it('pairs a block with its own close tag, not the nearest one', () => {
    const body = '{{#if rider}}<b>{{rider}}</b>{{#if phone}}<a>{{phone}}</a>{{/if}}{{/if}}'
    expect(render(body, { rider: 'Omar', phone: '050' })).toBe('<b>Omar</b><a>050</a>')
    expect(render(body, { rider: 'Omar', phone: '' })).toBe('<b>Omar</b>')
    expect(render(body, { rider: '', phone: '050' })).toBe('')
  })

  it('nests a repeat inside a condition', () => {
    const body = '{{#if items}}<ul>{{#each items}}<li>{{name}}</li>{{/each}}</ul>{{/if}}'
    expect(render(body, { items: [{ name: 'a' }, { name: 'b' }] })).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(render(body, { items: [] })).toBe('')
  })

  it('renders an unclosed block as text rather than printing the tag', () => {
    expect(render('{{#if a}}<b>{{a}}</b>', { a: 'x' })).toBe('<b>x</b>')
  })

  it('reads a nested value by path', () => {
    expect(render('{{customer.name}}', { customer: { name: 'Mona' } })).toBe('Mona')
  })
})

describe('sanitizeHtml', () => {
  it('strips script, frames and inline handlers', () => {
    const dirty = `<div onclick="steal()"><script>fetch('/x')</script><iframe src="http://x"></iframe><p>ok</p></div>`
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('iframe')
    expect(clean).toContain('<p>ok</p>')
  })

  it('defuses a javascript: link', () => {
    expect(sanitizeHtml(`<a href="javascript:alert(1)">go</a>`)).toBe('<a href="#">go</a>')
  })
})

describe('toTemplateDef', () => {
  it('hydrates into a card the SDK can draw, with the body already filled in', () => {
    const t = toTemplateDef(def({ html: '<b>{{title}}</b>', fields: [{ key: 'title', type: 'string', description: '' }] }))
    expect(t.widgetType).toBe('custom_card')
    expect(t.hydrate({ title: 'Hello' }, [])).toMatchObject({ template: 'order_card', html: '<b>Hello</b>' })
  })

  it('gives the body the bound source rows as `rows`', () => {
    const t = toTemplateDef(def({ html: '{{#each rows}}<li>{{name}}</li>{{/each}}' }))
    expect(t.hydrate({}, [{ name: 'One' }, { name: 'Two' }]).html).toBe('<li>One</li><li>Two</li>')
  })

  it('strips script out of the stored body once, not on every render', () => {
    const t = toTemplateDef(def({ html: '<script>x()</script><b>{{a}}</b>' }))
    expect(t.hydrate({ a: '1' }, []).html).toBe('<b>1</b>')
  })
})
