import { z } from 'zod'
import type { Row } from '../dataSource.js'
import { badRequest, conflict, notFound } from '../errors.js'
import { keys, redis } from '../redis.js'
import { registerCustom, templateByName, unregisterCustom, type TemplateDef } from './registry.js'

/**
 * Studio templates — the ones an operator makes, rather than the ones we ship.
 *
 * A compiled template is a shape plus a renderer in the SDK, which means a new
 * card has always cost a deploy on both sides. A studio template is the same
 * contract expressed as markup: the fields the agent may emit, and an HTML
 * body with `{{field}}` holes to put them in. The server fills the holes and
 * sends finished markup, so the SDK needs exactly one renderer for all of them
 * (`custom_card`) and never learns what any particular card is.
 *
 * That is the whole trick, and it is what lets a design arrive as a picture or
 * a paste of HTML and leave as a template the agent can emit by name.
 *
 * Values are escaped on the way in and the markup is stripped of anything
 * executable on the way out, because the agent supplies the data and an
 * operator supplies the body: neither is allowed to become script in a page.
 */

export const CUSTOM_CATEGORIES = ['commerce', 'health', 'ticketing', 'cinema', 'media'] as const

export const customFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'A field key is lowercase letters, digits and underscores.'),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean().optional(),
  description: z.string().max(300).default(''),
})

export const customTemplateSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/, 'A template name is lowercase letters, digits and underscores.'),
  title: z.string().min(1).max(80),
  description: z.string().max(400).default(''),
  category: z.enum(CUSTOM_CATEGORIES).default('commerce'),
  fields: z.array(customFieldSchema).max(40).default([]),
  html: z.string().min(1).max(60_000),
  sample: z.record(z.unknown()).default({}),
})

export type CustomTemplateInput = z.infer<typeof customTemplateSchema>

export interface CustomTemplateDef extends CustomTemplateInput {
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

/** The knobs a studio card honours: the ones its CSS can read as variables. */
export const CUSTOM_DESIGN = ['accent', 'surface', 'border', 'radius', 'padding', 'titleSize']

const defs = new Map<string, CustomTemplateDef>()

/* --------------------------------- markup --------------------------------- */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escape = (v: unknown): string => {
  if (v === null || v === undefined || typeof v === 'object') return ''
  return String(v).replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * Strips what must never run inside a card: script, embedded frames and
 * objects, inline handlers, and javascript: targets. The widget renders this
 * in a sandboxed frame that cannot execute script anyway — this is the second
 * lock, so a studio body is still safe wherever else it is previewed.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
}

const lookup = (scope: Row, path: string): unknown => {
  if (path === '.' || path === 'this') return scope['.']
  let value: unknown = scope
  for (const part of path.replace(/^this\./, '').split('.')) {
    if (value === null || value === undefined || typeof value !== 'object') return undefined
    value = (value as Row)[part]
  }
  return value
}

const listAt = (scope: Row, path: string): Row[] => {
  const value = lookup(scope, path)
  return Array.isArray(value) ? value : []
}

const OPEN = /\{\{#(each|if)\s+([\w.@]+)\s*\}\}/g

/** The matching close for a block that opens at `from`, counting nested blocks of the same kind. */
function closeOf(body: string, from: number, kind: string): { inner: [number, number]; after: number } | null {
  const token = new RegExp(`\\{\\{(#${kind}\\s+[\\w.@]+\\s*|/${kind})\\}\\}`, 'g')
  token.lastIndex = from
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = token.exec(body))) {
    depth += m[1].startsWith('#') ? 1 : -1
    if (depth === 0) return { inner: [from, m.index], after: m.index + m[0].length }
  }
  return null
}

const fill = (text: string, scope: Row): string =>
  text.replace(/\{\{\s*([\w.@]+|\.)\s*\}\}/g, (_m, path: string) =>
    path === '@index' ? escape(scope['@index']) : escape(lookup(scope, path)),
  )

const falsy = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0)

/**
 * Fills a body from a scope: `{{field}}` for a value, `{{#each list}}…{{/each}}`
 * for a repeated block (with `{{.}}` for a bare item and `{{@index}}` for its
 * position), and `{{#if field}}…{{/if}}` so a card can drop a row it has no
 * value for instead of rendering an empty one. Anything unknown renders empty,
 * which is the behaviour a half-filled card needs: a missing price should cost
 * the price line, not the card.
 *
 * Blocks are matched by counting, not by the nearest close tag — an `{{#if}}`
 * inside an `{{#if}}` is ordinary in generated markup, and pairing the outer
 * open with the inner close leaves both stray tags printed on the card.
 */
export function render(body: string, scope: Row): string {
  let out = ''
  let i = 0
  while (i < body.length) {
    OPEN.lastIndex = i
    const open = OPEN.exec(body)
    if (!open) {
      out += fill(body.slice(i), scope)
      break
    }
    out += fill(body.slice(i, open.index), scope)
    const [tag, kind, path] = open
    const bodyStart = open.index + tag.length
    const close = closeOf(body, bodyStart, kind)
    if (!close) {
      // An unclosed block: render what follows as plain text rather than
      // printing the tag, which is the less confusing half-failure.
      out += fill(body.slice(bodyStart), scope)
      break
    }
    const inner = body.slice(close.inner[0], close.inner[1])
    if (kind === 'each') {
      out += listAt(scope, path)
        .map((item, index) =>
          render(inner, { ...scope, ...(item && typeof item === 'object' ? item : {}), '.': item, '@index': index }),
        )
        .join('')
    } else if (!falsy(lookup(scope, path))) {
      out += render(inner, scope)
    }
    i = close.after
  }
  return out
}

/* ------------------------------- the template ------------------------------ */

/**
 * A studio record, seen as the engine sees every other template. `rows` is the
 * bound data source's copy, so a studio card can iterate a live feed with
 * `{{#each rows}}` exactly as a compiled one reads it in code.
 */
export function toTemplateDef(def: CustomTemplateDef): TemplateDef {
  const body = sanitizeHtml(def.html)
  return {
    name: def.name,
    category: def.category,
    title: def.title,
    description: def.description,
    widgetType: 'custom_card',
    emits: def.fields.map((f) => ({ key: f.key, type: f.type, required: f.required, description: f.description })),
    sample: def.sample,
    seed: () => [],
    passthrough: true,
    design: CUSTOM_DESIGN,
    designDefaults: { radius: 16, padding: 14, titleSize: 15 },
    hydrate: (data, rows) => ({
      template: def.name,
      title: def.title,
      html: render(body, { ...data, rows }),
    }),
  }
}

/* --------------------------------- storage -------------------------------- */

export const listCustomTemplates = (): CustomTemplateDef[] =>
  [...defs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

export const getCustomTemplate = (name: string): CustomTemplateDef | undefined => defs.get(name)

function put(def: CustomTemplateDef): void {
  defs.set(def.name, def)
  unregisterCustom(def.name)
  registerCustom(toTemplateDef(def))
}

export async function createCustomTemplate(input: CustomTemplateInput, actor: string): Promise<CustomTemplateDef> {
  // A studio template may not shadow a compiled one: the agent emits a name,
  // and two templates answering to it is a card nobody can predict.
  if (templateByName(input.name)) throw conflict(`A template named "${input.name}" already exists.`)
  assertUsable(input)
  const now = new Date().toISOString()
  const def: CustomTemplateDef = { ...input, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor }
  await redis.multi().set(keys.customTemplate(def.name), JSON.stringify(def)).sadd(keys.customTemplates(), def.name).exec()
  put(def)
  return def
}

export async function updateCustomTemplate(
  name: string,
  patch: Partial<Omit<CustomTemplateInput, 'name'>>,
  actor: string,
): Promise<CustomTemplateDef> {
  const current = defs.get(name)
  if (!current) throw notFound(`Template "${name}" not found`)
  const next: CustomTemplateDef = {
    ...current,
    ...patch,
    name: current.name,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  }
  assertUsable(next)
  await redis.set(keys.customTemplate(name), JSON.stringify(next))
  put(next)
  return next
}

export async function deleteCustomTemplate(name: string): Promise<void> {
  if (!defs.has(name)) throw notFound(`Template "${name}" not found`)
  await redis.multi().del(keys.customTemplate(name)).srem(keys.customTemplates(), name).exec()
  defs.delete(name)
  unregisterCustom(name)
}

/** Rejects a body that would render to nothing, so the failure lands on the form and not in a chat. */
function assertUsable(input: CustomTemplateInput): void {
  if (!sanitizeHtml(input.html).trim()) throw badRequest('The HTML is empty once scripts are stripped.')
  // What a hole refers to is deliberately not checked: inside `{{#each items}}`
  // the keys belong to the item, not to the template, and an unknown hole
  // renders empty anyway — which is what a half-filled card should do.
}

/** Loads every studio template into the registry. Called once at boot, before the first request. */
export async function startCustomTemplates(): Promise<void> {
  const names = await redis.smembers(keys.customTemplates()).catch(() => [] as string[])
  for (const name of names) {
    try {
      const raw = await redis.get(keys.customTemplate(name))
      if (!raw) continue
      const def = JSON.parse(raw) as CustomTemplateDef
      if (templateByName(def.name) && !defs.has(def.name)) continue
      put(def)
    } catch {
      /* an unreadable record is skipped rather than taking the boot down with it */
    }
  }
}

/** Test seam: drops every studio template from memory and the registry. */
export function resetCustomTemplates(): void {
  for (const name of defs.keys()) unregisterCustom(name)
  defs.clear()
}
