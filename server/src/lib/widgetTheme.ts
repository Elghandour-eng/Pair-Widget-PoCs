import type { WidgetConfig } from '../services/pairApi.js'

/**
 * Server-side widget theme switch, mirroring the builder's applyTheme
 * (web/src/lib/builder.ts): one set of semantic tokens per theme, fanned out
 * onto the concrete config paths the widget reads.
 *
 * It exists on the server so the public test page can serve a whole config in
 * either theme: the widget's beBaseUrl points at /pv/:lng/:theme and the config
 * arrives already re-tokened, exactly like the language switch.
 */

export type WidgetTheme = 'dark' | 'light'

export const isWidgetTheme = (v: unknown): v is WidgetTheme => v === 'dark' || v === 'light'

type Any = Record<string, any>

function deepSet(o: WidgetConfig, path: string, val: unknown): WidgetConfig {
  const next = structuredClone(o) as Any
  const parts = path.split('.')
  let cur: Any = next
  for (const p of parts.slice(0, -1)) {
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
    cur = cur[p]
  }
  cur[parts.at(-1)!] = val
  return next
}

interface ThemeTokens {
  bg: string; surface: string; surface2: string; border: string; border2: string
  text: string; muted: string; faint: string
}

/** Semantic tokens straight from the Cinescape reference (§4.2); kept in sync with the builder. */
const THEME_TOKENS: Record<WidgetTheme, ThemeTokens> = {
  dark: { bg: '#000000', surface: '#141414', surface2: '#1C1C1E', border: '#2C2C2E', border2: '#3A3A3C', text: '#FFFFFF', muted: '#A1A1A6', faint: '#6E6E73' },
  light: { bg: '#FFFFFF', surface: '#F6F6F8', surface2: '#F0F0F3', border: '#E5E5EA', border2: '#D1D1D6', text: '#000000', muted: '#5E5E63', faint: '#8E8E93' },
}

/** Every token-driven path and the token it takes. Content and brand color are untouched. */
const THEME_PATHS: Array<[path: string, token: keyof ThemeTokens]> = [
  ['widget_v2_config.intro_screen.widgetBackground.background', 'bg'],
  ['widget_v2_config.header.background.color', 'bg'],
  ['widget_v2_config.header.iconStyle.backgroundColor', 'bg'],
  ['widget_v2_config.header.titleStyle.color', 'text'],
  ['widget_v2_config.header.subtitleStyle.color', 'muted'],
  ['widget_v2_config.intro_screen.welcomeTitle.styles.color', 'text'],
  ['widget_v2_config.intro_screen.welcomeSubtitle.styles.color', 'muted'],
  ['widget_v2_config.intro_screen.introTitle.styles.color', 'text'],
  ['widget_v2_config.quick_links.textStyle.color', 'text'],
  ['widget_v2_config.quick_links.cardStyle.background', 'surface'],
  ['widget_v2_config.trending_prompts.chipStyle.borderColor', 'border2'],
  ['widget_v2_config.trending_prompts.chipStyle.color', 'text'],
  ['widget_v2_config.trending_prompts.textStyle.color', 'text'],
  ['widget_v2_config.chat_input.styles.borderColor', 'border'],
  ['widget_v2_config.chat_input.styles.backgroundColor', 'surface2'],
  ['widget_v2_config.chat_input.placeholderText.styles.color', 'faint'],
  ['widget_v2_config.messages.aiMessages.CardStyles.backgroundColor', 'surface'],
  ['widget_v2_config.messages.aiMessages.CardStyles.borderColor', 'border'],
  ['widget_v2_config.messages.aiMessages.TextStyles.color', 'text'],
  ['widget_v2_config.messages.customerMessages.bubbleStyle.backgroundColor', 'surface2'],
  ['widget_v2_config.messages.customerMessages.bubbleStyle.borderColor', 'border'],
  ['widget_v2_config.messages.customerMessages.TextStyles.color', 'text'],
]

/**
 * The studio's design blocks are compiled into the served CSS *after* theming
 * (public.ts materializeChrome), so a theme that only wrote the legacy style
 * paths was overwritten by the design's own colours — a dark widget kept a
 * white composer, white cards and light chips. These paths re-token the design
 * itself. Each group only applies when that design block exists: writing into
 * a missing one would conjure a default design the channel never had.
 */
const DESIGN_THEME_PATHS: Array<[guard: string, paths: Array<[path: string, token: keyof ThemeTokens | null]>]> = [
  ['widget_v2_config.chat_input.design', [
    ['widget_v2_config.chat_input.design.field.background', 'surface2'],
    ['widget_v2_config.chat_input.design.field.borderColor', 'border'],
    ['widget_v2_config.chat_input.design.text.color', 'text'],
    ['widget_v2_config.chat_input.design.placeholder.color', 'faint'],
    ['widget_v2_config.chat_input.design.actions.iconColor', 'muted'],
    ['widget_v2_config.chat_input.design.actions.hoverBackground', 'surface'],
    // null = transparent: the composer strip sits on the widget background.
    ['widget_v2_config.chat_input.design.container.background', null],
  ]],
  ['widget_v2_config.quick_links.design', [
    ['widget_v2_config.quick_links.design.background', 'surface'],
    ['widget_v2_config.quick_links.design.borderColor', 'border'],
    ['widget_v2_config.quick_links.design.titleColor', 'text'],
    ['widget_v2_config.quick_links.design.subtitleColor', 'muted'],
  ]],
  ['widget_v2_config.trending_prompts.design', [
    ['widget_v2_config.trending_prompts.design.background', null],
    ['widget_v2_config.trending_prompts.design.borderColor', 'border2'],
    ['widget_v2_config.trending_prompts.design.textColor', 'text'],
    ['widget_v2_config.trending_prompts.design.titleColor', 'muted'],
  ]],
  ['widget_v2_config.pre_chat_form', [
    ['widget_v2_config.pre_chat_form.design.message.color', 'text'],
    ['widget_v2_config.pre_chat_form.design.labels.color', 'text'],
    ['widget_v2_config.pre_chat_form.design.field.background', 'surface2'],
    ['widget_v2_config.pre_chat_form.design.field.borderColor', 'border'],
    ['widget_v2_config.pre_chat_form.design.field.textColor', 'text'],
    ['widget_v2_config.pre_chat_form.design.field.placeholderColor', 'faint'],
    ['widget_v2_config.pre_chat_form.design.card.background', 'surface'],
    ['widget_v2_config.pre_chat_form.design.card.borderColor', 'border'],
  ]],
  ['widget_v2_config.messages.loadingOlder', [
    ['widget_v2_config.messages.loadingOlder.background', 'surface'],
    ['widget_v2_config.messages.loadingOlder.textColor', 'muted'],
  ]],
  ['widget_v2_config.csat', [
    ['widget_v2_config.csat.design.card.background', 'surface'],
    ['widget_v2_config.csat.design.card.borderColor', 'border'],
    ['widget_v2_config.csat.design.header.color', 'muted'],
    ['widget_v2_config.csat.design.body.color', 'text'],
    ['widget_v2_config.csat.design.dialog.background', 'surface'],
    ['widget_v2_config.csat.design.dialog.titleColor', 'text'],
    ['widget_v2_config.csat.design.dialog.dividerColor', 'border'],
    ['widget_v2_config.csat.design.chips.background', 'surface2'],
    ['widget_v2_config.csat.design.chips.borderColor', 'border2'],
    ['widget_v2_config.csat.design.chips.textColor', 'text'],
  ]],
  ['widget_v2_config.consent_screen', [
    ['widget_v2_config.consent_screen.design.card.background', 'surface'],
    ['widget_v2_config.consent_screen.design.title.color', 'text'],
    ['widget_v2_config.consent_screen.design.subtitle.color', 'muted'],
    ['widget_v2_config.consent_screen.design.points.textColor', 'text'],
    ['widget_v2_config.consent_screen.design.points.iconColor', 'muted'],
    ['widget_v2_config.consent_screen.design.footnote.color', 'faint'],
  ]],
]

const deepGet = (o: unknown, path: string): unknown =>
  path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o)

export function applyWidgetTheme(config: WidgetConfig, theme: WidgetTheme): WidgetConfig {
  const tokens = THEME_TOKENS[theme]
  let next = config
  for (const [path, token] of THEME_PATHS) next = deepSet(next, path, tokens[token])
  for (const [guard, paths] of DESIGN_THEME_PATHS) {
    if (deepGet(next, guard) === undefined) continue
    for (const [path, token] of paths) next = deepSet(next, path, token ? tokens[token] : 'transparent')
  }
  // Card borders live inside a CSS shorthand, so rebuild it with the theme's border color.
  next = deepSet(next, 'widget_v2_config.quick_links.cardStyle.border', `1px solid ${tokens.border}`)
  next = deepSet(next, 'widget_v2_config.trending_prompts.chipStyle.backgroundColor', 'transparent')
  return next
}
