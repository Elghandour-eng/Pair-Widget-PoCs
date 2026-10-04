/**
 * Per-template design tokens.
 *
 * A template describes a card's *shape*; these describe how that shape looks.
 * They are the third thing a widget can customise, next to which templates it
 * renders and where their rows come from — so two widgets can render the same
 * registered template and not look alike.
 *
 * The knobs are deliberately few and declarative. Anything a renderer can
 * decide for itself from the widget's own theme (light/dark surfaces, text
 * colour, direction) stays the renderer's job; what is here is what an operator
 * would otherwise ask an engineer to change.
 *
 * Every value is optional at every level. A card falls back to the template's
 * defaults, and those fall back to the widget's own theme — so a widget that
 * has never been designed looks exactly as it did before this existed.
 */

export type DesignFieldType = 'color' | 'number' | 'choice' | 'boolean'

export interface DesignField {
  key: string
  label: string
  type: DesignFieldType
  /** `choice` only. */
  options?: string[]
  /** `number` only, in px unless the field says otherwise. */
  min?: number
  max?: number
  step?: number
  description: string
}

/**
 * The full catalog. A template lists the keys it honours; a knob a template
 * does not list is never shown for it, because an operator moving a slider
 * that changes nothing is worse than no slider.
 */
export const DESIGN_FIELDS: Record<string, DesignField> = {
  accent: {
    key: 'accent', label: 'Accent', type: 'color',
    description: 'Headings, prices and emphasis. Falls back to the widget’s primary colour.',
  },
  surface: {
    key: 'surface', label: 'Card background', type: 'color',
    description: 'The card’s own background. Falls back to the widget’s light or dark surface.',
  },
  border: {
    key: 'border', label: 'Border', type: 'color',
    description: 'The hairline around the card.',
  },
  radius: {
    key: 'radius', label: 'Corner radius', type: 'number', min: 0, max: 32, step: 1,
    description: 'How round the card’s corners are, in px.',
  },
  padding: {
    key: 'padding', label: 'Padding', type: 'number', min: 4, max: 32, step: 1,
    description: 'Space between the card’s edge and its contents, in px.',
  },
  titleSize: {
    key: 'titleSize', label: 'Title size', type: 'number', min: 11, max: 22, step: 1,
    description: 'The heading’s font size, in px.',
  },
  divider: {
    key: 'divider', label: 'Row divider', type: 'choice', options: ['dashed', 'solid', 'none'],
    description: 'The line between rows in a list.',
  },
  columns: {
    key: 'columns', label: 'Columns', type: 'number', min: 1, max: 3, step: 1,
    description: 'How many cards sit side by side.',
  },
  imageRatio: {
    key: 'imageRatio', label: 'Image shape', type: 'choice', options: ['1:1', '4:3', '16:9', '2:3'],
    description: 'The aspect ratio each photo is cropped to.',
  },
  showImage: {
    key: 'showImage', label: 'Show photos', type: 'boolean',
    description: 'Turn photos off for a denser, text-only card.',
  },
  buttonStyle: {
    key: 'buttonStyle', label: 'Button style', type: 'choice', options: ['filled', 'outline'],
    description: 'How the store buttons are drawn.',
  },
}

export type TemplateDesign = Record<string, string | number | boolean>

/** Drops unknown keys and anything the template does not honour, then clamps what is left. */
export function cleanDesign(design: unknown, allowed: string[]): TemplateDesign {
  if (!design || typeof design !== 'object') return {}
  const out: TemplateDesign = {}
  for (const [key, value] of Object.entries(design as Record<string, unknown>)) {
    if (!allowed.includes(key)) continue
    const field = DESIGN_FIELDS[key]
    if (!field) continue
    if (field.type === 'color' && typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value)) out[key] = value
    if (field.type === 'boolean' && typeof value === 'boolean') out[key] = value
    if (field.type === 'choice' && typeof value === 'string' && field.options?.includes(value)) out[key] = value
    if (field.type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.min(field.max ?? value, Math.max(field.min ?? value, Math.round(value)))
    }
  }
  return out
}
