import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
// zod/v4, because that is the dialect the SDK's output-format helper speaks;
// the rest of the server is on the v3 surface of the same package.
import * as z from 'zod/v4'
import { env } from '../../config/env.js'
import { badRequest } from '../errors.js'
import { logger } from '../logger.js'
import { CUSTOM_CATEGORIES, sanitizeHtml } from './customTemplates.js'

/**
 * The studio's one model call: a design in, a template out.
 *
 * An operator arrives with a picture of a card, or markup a designer sent, or
 * a sentence describing what they want. All three end here, and all three
 * leave as the same thing — a name, the fields the agent may emit, and a body
 * with holes to put them in. Nothing else in the engine knows a model was
 * involved; what is saved is an ordinary studio template (customTemplates.ts).
 *
 * The model is asked for structured output rather than prose, so a bad answer
 * fails here, on the form, instead of being discovered later in a chat.
 */

const fieldSchema = z.object({
  key: z.string().describe('lowercase snake_case, the key the agent emits'),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean(),
  description: z.string().describe('what the agent should put here, in one line'),
})

const specSchema = z.object({
  name: z.string().describe('lowercase snake_case template name, e.g. flight_card'),
  title: z.string().describe('a short human title, e.g. "Flight card"'),
  description: z.string().describe('one sentence: what this card shows and when the agent should send it'),
  category: z.enum(CUSTOM_CATEGORIES),
  fields: z.array(fieldSchema),
  html: z.string().describe('the self-contained card body with {{field}} holes'),
  sample: z.string().describe('a JSON object of example values for every field, as a JSON string'),
})

export type StudioSpec = Omit<z.infer<typeof specSchema>, 'sample'> & { sample: Record<string, unknown> }

const SYSTEM = `You turn a card design into a chat-widget template.

A template has two halves: the fields an AI agent may fill in, and an HTML body with {{field}} holes for them.

Rules for the HTML body:
- One self-contained block: a single root element with all styling in a <style> tag or inline styles. No <html>, <head>, <body>, no scripts, no external stylesheets, no fonts, no network requests.
- It is rendered inside a chat bubble on a phone. Design for 280-420px wide, and let it grow vertically.
- Use these CSS variables where they fit, each with a fallback, so the operator's theme can drive the card: var(--accent, #1F6FB8), var(--surface, #ffffff), var(--border, #e6e8eb), var(--radius, 16px), var(--padding, 14px), var(--title-size, 15px).
- Support both directions: never use left/right, use the logical properties (inline-start/inline-end, margin-inline, text-align: start). The card is shown in Arabic (RTL) as often as English.
- Put every piece of content that changes into a hole. Static labels stay as text.
- Holes: {{field}} for a value. {{#each list}}...{{/each}} to repeat a block over an array field, with {{key}} inside it for the item's own keys and {{@index}} for its position. {{#if field}}...{{/if}} to drop a part of the card when a value is missing.
- Images: use the hole in src, e.g. <img src="{{image}}" alt="">. Never invent an image URL.
- Keep it compact and readable: real markup a front-end engineer would accept, not a wall of divs.

Rules for the fields:
- Only what the agent cannot know from the design itself: the data. Never make a field for a static label or a colour.
- Give an array field for anything the design repeats (rows, items, tags).
- Describe each field in one line, aimed at the agent that will fill it.

Name the template after what it shows, in snake_case, and never after a customer.`

let client: Anthropic | null = null
const anthropic = (): Anthropic => {
  if (!env.ANTHROPIC_API_KEY) {
    throw badRequest('The template studio needs ANTHROPIC_API_KEY to be set on the server.')
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  return client
}

export const studioReady = (): boolean => !!env.ANTHROPIC_API_KEY

export interface StudioRequest {
  /** A screenshot or mock-up of the card, base64 with its media type. */
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string }
  /** Markup a designer already wrote, to be turned into a template as-is. */
  html?: string
  /** What the operator wants, in their own words. */
  prompt?: string
  /** On a refine pass: the body the operator is looking at, and what to change about it. */
  previous?: { html: string; fields: Array<{ key: string; type: string; description: string }> }
}

/** Asks the model for a template, and returns it only if it is one we could save. */
export async function generateTemplate(input: StudioRequest): Promise<StudioSpec> {
  const parts: Anthropic.ContentBlockParam[] = []
  if (input.image) {
    parts.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data } })
  }
  const said: string[] = []
  if (input.image) said.push('The image above is the design to reproduce as closely as the rules allow.')
  if (input.html) said.push(`The designer's markup to turn into a template, verbatim where it is already fine:\n\n${input.html.slice(0, 40_000)}`)
  if (input.previous) {
    said.push(
      `This is the current template body, which you are revising rather than replacing:\n\n${input.previous.html.slice(0, 40_000)}\n\nIts fields: ${JSON.stringify(input.previous.fields)}`,
    )
  }
  if (input.prompt) said.push(`What the operator asked for: ${input.prompt}`)
  if (said.length === 0) throw badRequest('Give the studio a design: an image, some HTML, or a description.')
  parts.push({ type: 'text', text: said.join('\n\n') })

  const response = await anthropic().messages.parse({
    model: env.TEMPLATE_STUDIO_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: parts }],
    output_config: { format: zodOutputFormat(specSchema) },
  })

  const spec = response.parsed_output
  if (!spec) {
    logger.warn({ stop: response.stop_reason }, 'template studio returned nothing usable')
    throw badRequest('The model did not return a template. Try again, or describe the card in a sentence.')
  }

  let sample: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(spec.sample || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) sample = parsed as Record<string, unknown>
  } catch {
    /* a sample that will not parse costs the preview its example values, nothing more */
  }

  return {
    ...spec,
    name: spec.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '').slice(0, 40) || 'custom_card',
    html: sanitizeHtml(spec.html),
    sample,
  }
}
