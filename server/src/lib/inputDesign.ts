/**
 * The widget's chrome — chat input, launcher, loading state, toast and prompt
 * chips: the full set of values a channel can style.
 *
 * The widget already accepted a raw CSS blob for the composer, the placeholder
 * and the send button, and another for the launcher. That is powerful and
 * unusable: nobody discovers `boxShadow` in a text field, and half of what a
 * designer wants to change (the typing text, the action buttons, the launcher's
 * size and icon) was hardcoded in the widget and reachable by no CSS at all.
 *
 * So the values are named here instead, validated, and compiled two ways:
 *  - `inputCss` / `launcherCss` produce the CSS blobs the widget already reads,
 *    so most of this lands with no change to the widget at all;
 *  - the structured block travels alongside for the parts the widget had to be
 *    taught (see `chat_input.design` in its config types).
 *
 * MIRRORED FILE — server/src/lib/inputDesign.ts is a byte-identical copy (the
 * server workspace cannot import from web/). `npm test -w server` asserts that.
 */

/**
 * A plain style bag. Deliberately not React's `CSSProperties`: this module is
 * mirrored into the server workspace, which has no React types.
 */
export type CSSProperties = Record<string, string | number | undefined>

/* --------------------------------- choices -------------------------------- */

export const INPUT_LAYOUTS = ['floating_pill', 'full_width_bar', 'inset_card'] as const
export type InputLayout = (typeof INPUT_LAYOUTS)[number]

export const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'none'] as const
export type BorderStyle = (typeof BORDER_STYLES)[number]

export const BUTTON_SHAPES = ['circle', 'rounded', 'square'] as const
export type ButtonShape = (typeof BUTTON_SHAPES)[number]

export const FONT_WEIGHTS = ['400', '500', '600', '700', '800'] as const
export type FontWeight = (typeof FONT_WEIGHTS)[number]

export const SEND_POSITIONS = ['inside', 'outside'] as const
export type SendPosition = (typeof SEND_POSITIONS)[number]

export const LAUNCHER_ICONS = ['bubble', 'chat', 'spark', 'arrow', 'custom', 'none'] as const
export type LauncherIcon = (typeof LAUNCHER_ICONS)[number]

export const LAUNCHER_ENTRANCES = ['pop', 'slide', 'fade', 'none'] as const
export type LauncherEntrance = (typeof LAUNCHER_ENTRANCES)[number]

export const LAUNCHER_ATTENTION = ['none', 'pulse', 'bounce', 'wiggle'] as const
export type LauncherAttention = (typeof LAUNCHER_ATTENTION)[number]

export const LOADING_TYPES = ['shimmer', 'spinner', 'dots', 'pulse'] as const
export type LoadingType = (typeof LOADING_TYPES)[number]

export const CHIP_LAYOUTS = ['wrap', 'stack', 'scroll'] as const
export type ChipLayout = (typeof CHIP_LAYOUTS)[number]

export const ICON_POSITIONS = ['start', 'end'] as const
export type IconPosition = (typeof ICON_POSITIONS)[number]

export const TEXT_ALIGNS = ['start', 'center', 'end'] as const
export type TextAlign = (typeof TEXT_ALIGNS)[number]

export const TOAST_POSITIONS = [
  'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right',
] as const
export type ToastPosition = (typeof TOAST_POSITIONS)[number]

/** `#brand` follows the channel's colour wherever a colour is read. */
export const BRAND_TOKEN = '#brand'

/* ---------------------------------- types --------------------------------- */

export interface Shadow {
  /** 0 disables the shadow entirely. */
  size: number
  y: number
  blur: number
  color: string
  opacity: number
}

export interface InputFieldDesign {
  background: string
  borderWidth: number
  borderColor: string
  borderStyle: BorderStyle
  radius: number
  paddingX: number
  paddingY: number
  minHeight: number
  /** Space between the field's own controls. */
  gap: number
  shadow: Shadow
  focusBorderColor: string
  focusRingWidth: number
  focusRingColor: string
  focusRingOpacity: number
}

export interface InputTextDesign {
  fontFamily: string
  size: number
  weight: FontWeight
  color: string
  lineHeight: number
}

export interface InputPlaceholderDesign {
  text: string
  color: string
  size: number
  weight: FontWeight
  italic: boolean
}

export interface SendButtonDesign {
  shape: ButtonShape
  size: number
  radius: number
  background: string
  iconColor: string
  iconSize: number
  hoverBackground: string
  disabledOpacity: number
  position: SendPosition
  shadow: Shadow
  /** Which drawn glyph, or a custom image. `icon`/`url` mirror the widget's own field. */
  icon: string
  url: string
}

export interface InputActionsDesign {
  voice: boolean
  attach: boolean
  emoji: boolean
  /** Each action's glyph, or `custom` with the matching upload. */
  voiceIcon: string
  voiceUrl: string
  attachIcon: string
  attachUrl: string
  emojiIcon: string
  emojiUrl: string
  size: number
  shape: ButtonShape
  radius: number
  background: string
  iconColor: string
  iconSize: number
  hoverBackground: string
  gap: number
}

export interface InputContainerDesign {
  background: string
  paddingX: number
  paddingTop: number
  paddingBottom: number
}

export interface ChatInputDesign {
  layout: InputLayout
  /** 'auto' follows the widget's language. */
  direction: 'auto' | 'ltr' | 'rtl'
  field: InputFieldDesign
  text: InputTextDesign
  placeholder: InputPlaceholderDesign
  send: SendButtonDesign
  actions: InputActionsDesign
  container: InputContainerDesign
}

export interface LauncherLabelDesign {
  show: boolean
  text: string
  color: string
  fontFamily: string
  size: number
  weight: FontWeight
}

export interface LauncherDesign {
  type: 'standard' | 'expanded_bubble' | 'chat_icon' | 'icon_only'
  position: 'left' | 'right'
  offsetX: number
  offsetY: number
  size: number
  radius: number
  background: string
  gradientTo: string
  useGradient: boolean
  gradientAngle: number
  borderWidth: number
  borderColor: string
  iconColor: string
  icon: LauncherIcon
  iconUrl: string
  iconSize: number
  shadow: Shadow
  label: LauncherLabelDesign
  entrance: LauncherEntrance
  attention: LauncherAttention
  hoverScale: number
}

/**
 * The placeholder shown while the first reply is still loading. The widget drew
 * a fixed skeleton — three bars and three cards in a fixed grey — so none of it
 * could follow a brand.
 */
export interface LoadingDesign {
  type: LoadingType
  baseColor: string
  highlightColor: string
  speedMs: number
  radius: number
  /** Skeleton shape: text bars above, cards below. */
  lines: number
  lineHeight: number
  cards: number
  cardHeight: number
  spinnerColor: string
  spinnerSize: number
  spinnerThickness: number
  labelShow: boolean
  labelText: string
  labelColor: string
  labelSize: number
}

/**
 * The confirmation that slides in after an action ("Thanks for your feedback").
 * It was pinned top-centre in a fixed green, over the conversation.
 */
export interface ToastDesign {
  position: ToastPosition
  offset: number
  durationMs: number
  background: string
  textColor: string
  borderColor: string
  borderWidth: number
  radius: number
  paddingX: number
  paddingY: number
  fontSize: number
  fontWeight: FontWeight
  shadow: Shadow
  showIcon: boolean
  iconColor: string
  fullWidth: boolean
}

/**
 * Trending prompt chips: the section heading, the chip surface, its text and
 * the icon in front of it. The widget drew a fixed bordered pill with no icon
 * at all, so none of this could follow a brand.
 */
export interface PromptsDesign {
  showTitle: boolean
  titleColor: string
  titleSize: number
  titleWeight: FontWeight
  titleFont: string
  layout: ChipLayout
  gap: number
  align: TextAlign
  background: string
  borderWidth: number
  borderColor: string
  borderStyle: BorderStyle
  radius: number
  paddingX: number
  paddingY: number
  shadow: Shadow
  hoverBackground: string
  hoverBorderColor: string
  textColor: string
  textSize: number
  textWeight: FontWeight
  textFont: string
  /** The default glyph in front of a chip; a chip may override it. */
  showIcon: boolean
  icon: string
  iconUrl: string
  iconColor: string
  iconSize: number
  iconPosition: IconPosition
}

/* ------------------------------- normalising ------------------------------ */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
/** A short, safe subset: hex, the brand token, `transparent`, or a plain font stack. */
const SAFE_TEXT = /^[\w\s,'"-]{0,120}$/

export const isBrand = (v: unknown): boolean => v === BRAND_TOKEN

/** Colours become attribute and style values, so only literal hex (or the token) is accepted. */
export const color = (v: unknown, fallback: string): string => {
  if (typeof v !== 'string') return fallback
  const s = v.trim()
  if (s === BRAND_TOKEN || s === 'transparent' || HEX.test(s)) return s
  return fallback
}

/** Resolves a stored colour against the channel's brand colour. */
export const resolve = (v: string, brand: string): string => (v === BRAND_TOKEN ? brand : v)

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

const str = (v: unknown, fallback: string, max = 160): string => (typeof v === 'string' ? v.slice(0, max) : fallback)

/** A font stack reaches a `style` attribute, so it is kept to name-ish characters. */
const font = (v: unknown, fallback: string): string =>
  typeof v === 'string' && SAFE_TEXT.test(v) ? v.trim() || fallback : fallback

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

const shadow = (v: unknown, d: Shadow): Shadow => {
  const r = (v ?? {}) as Record<string, unknown>
  return {
    size: num(r.size, d.size, 0, 80),
    y: num(r.y, d.y, -40, 40),
    blur: num(r.blur, d.blur, 0, 80),
    color: color(r.color, d.color),
    opacity: num(r.opacity, d.opacity, 0, 1),
  }
}

export const CHAT_INPUT_DEFAULTS: ChatInputDesign = {
  layout: 'floating_pill',
  direction: 'auto',
  field: {
    background: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECED',
    borderStyle: 'solid',
    radius: 999,
    paddingX: 5,
    paddingY: 5,
    minHeight: 46,
    gap: 8,
    shadow: { size: 16, y: 8, blur: 16, color: '#030712', opacity: 0.08 },
    focusBorderColor: BRAND_TOKEN,
    focusRingWidth: 3,
    focusRingColor: BRAND_TOKEN,
    focusRingOpacity: 0.18,
  },
  text: { fontFamily: '', size: 14, weight: '400', color: '#1A1A1A', lineHeight: 1.5 },
  placeholder: { text: '', color: '#8E8E93', size: 14, weight: '400', italic: false },
  send: {
    shape: 'circle',
    size: 36,
    radius: 999,
    background: BRAND_TOKEN,
    iconColor: '#FFFFFF',
    iconSize: 14,
    hoverBackground: '',
    disabledOpacity: 0.4,
    position: 'inside',
    shadow: { size: 0, y: 0, blur: 0, color: '#000000', opacity: 0 },
    icon: 'default',
    url: '',
  },
  actions: {
    voice: true,
    attach: true,
    emoji: false,
    voiceIcon: 'mic',
    voiceUrl: '',
    attachIcon: 'paperclip',
    attachUrl: '',
    emojiIcon: 'smile',
    emojiUrl: '',
    size: 36,
    shape: 'circle',
    radius: 999,
    background: 'transparent',
    iconColor: '#626A6A',
    iconSize: 16,
    hoverBackground: '#F2F2F3',
    gap: 2,
  },
  container: { background: 'transparent', paddingX: 16, paddingTop: 16, paddingBottom: 24 },
}

export const LAUNCHER_DEFAULTS: LauncherDesign = {
  type: 'standard',
  position: 'right',
  offsetX: 20,
  offsetY: 20,
  size: 56,
  radius: 999,
  background: BRAND_TOKEN,
  gradientTo: '#000000',
  useGradient: false,
  gradientAngle: 135,
  borderWidth: 0,
  borderColor: '#FFFFFF',
  iconColor: '#FFFFFF',
  icon: 'bubble',
  iconUrl: '',
  iconSize: 22,
  shadow: { size: 24, y: 8, blur: 24, color: '#000000', opacity: 0.22 },
  label: { show: true, text: '', color: '#FFFFFF', fontFamily: '', size: 14, weight: '500' },
  entrance: 'pop',
  attention: 'none',
  hoverScale: 1.04,
}

export const LOADING_DEFAULTS: LoadingDesign = {
  type: 'shimmer',
  baseColor: '#ECECEE',
  highlightColor: '#F7F7F8',
  speedMs: 1600,
  radius: 12,
  lines: 3,
  lineHeight: 10,
  cards: 3,
  cardHeight: 220,
  spinnerColor: BRAND_TOKEN,
  spinnerSize: 22,
  spinnerThickness: 2.5,
  labelShow: false,
  labelText: '',
  labelColor: '#8E8E93',
  labelSize: 12,
}

export function normalizeLoading(raw: unknown): LoadingDesign {
  const r = (raw ?? {}) as Record<string, any>
  const d = LOADING_DEFAULTS
  return {
    type: pick(r.type, LOADING_TYPES, d.type),
    baseColor: color(r.baseColor, d.baseColor),
    highlightColor: color(r.highlightColor, d.highlightColor),
    speedMs: num(r.speedMs, d.speedMs, 300, 6000),
    radius: num(r.radius, d.radius, 0, 60),
    lines: num(r.lines, d.lines, 0, 8),
    lineHeight: num(r.lineHeight, d.lineHeight, 2, 40),
    cards: num(r.cards, d.cards, 0, 6),
    cardHeight: num(r.cardHeight, d.cardHeight, 20, 400),
    spinnerColor: color(r.spinnerColor, d.spinnerColor),
    spinnerSize: num(r.spinnerSize, d.spinnerSize, 8, 72),
    spinnerThickness: num(r.spinnerThickness, d.spinnerThickness, 1, 10),
    labelShow: bool(r.labelShow, d.labelShow),
    labelText: str(r.labelText, d.labelText, 60),
    labelColor: color(r.labelColor, d.labelColor),
    labelSize: num(r.labelSize, d.labelSize, 8, 24),
  }
}

export const TOAST_DEFAULTS: ToastDesign = {
  position: 'bottom-center',
  offset: 16,
  durationMs: 3000,
  background: '#1E1E1E',
  textColor: '#FFFFFF',
  borderColor: '#1E1E1E',
  borderWidth: 0,
  radius: 12,
  paddingX: 14,
  paddingY: 10,
  fontSize: 13,
  fontWeight: '500',
  shadow: { size: 20, y: 6, blur: 20, color: '#000000', opacity: 0.18 },
  showIcon: true,
  iconColor: BRAND_TOKEN,
  fullWidth: false,
}

export function normalizeToast(raw: unknown): ToastDesign {
  const r = (raw ?? {}) as Record<string, any>
  const d = TOAST_DEFAULTS
  return {
    position: pick(r.position, TOAST_POSITIONS, d.position),
    offset: num(r.offset, d.offset, 0, 80),
    durationMs: num(r.durationMs, d.durationMs, 800, 15000),
    background: color(r.background, d.background),
    textColor: color(r.textColor, d.textColor),
    borderColor: color(r.borderColor, d.borderColor),
    borderWidth: num(r.borderWidth, d.borderWidth, 0, 8),
    radius: num(r.radius, d.radius, 0, 999),
    paddingX: num(r.paddingX, d.paddingX, 0, 40),
    paddingY: num(r.paddingY, d.paddingY, 0, 40),
    fontSize: num(r.fontSize, d.fontSize, 9, 24),
    fontWeight: pick(String(r.fontWeight), FONT_WEIGHTS, d.fontWeight),
    shadow: shadow(r.shadow, d.shadow),
    showIcon: bool(r.showIcon, d.showIcon),
    iconColor: color(r.iconColor, d.iconColor),
    fullWidth: bool(r.fullWidth, d.fullWidth),
  }
}

export const PROMPTS_DEFAULTS: PromptsDesign = {
  showTitle: true,
  titleColor: '#1A1A1A',
  titleSize: 12,
  titleWeight: '700',
  titleFont: '',
  layout: 'wrap',
  gap: 8,
  align: 'start',
  background: 'transparent',
  borderWidth: 1,
  borderColor: '#D1D1D6',
  borderStyle: 'solid',
  radius: 20,
  paddingX: 12,
  paddingY: 7,
  shadow: { size: 0, y: 0, blur: 0, color: '#000000', opacity: 0 },
  hoverBackground: '',
  hoverBorderColor: '',
  textColor: '#1E1E1E',
  textSize: 12,
  textWeight: '400',
  textFont: '',
  showIcon: false,
  icon: 'spark',
  iconUrl: '',
  iconColor: BRAND_TOKEN,
  iconSize: 13,
  iconPosition: 'start',
}

export function normalizePrompts(raw: unknown): PromptsDesign {
  const r = (raw ?? {}) as Record<string, any>
  const d = PROMPTS_DEFAULTS
  return {
    showTitle: bool(r.showTitle, d.showTitle),
    titleColor: color(r.titleColor, d.titleColor),
    titleSize: num(r.titleSize, d.titleSize, 8, 28),
    titleWeight: pick(String(r.titleWeight), FONT_WEIGHTS, d.titleWeight),
    titleFont: font(r.titleFont, d.titleFont),
    layout: pick(r.layout, CHIP_LAYOUTS, d.layout),
    gap: num(r.gap, d.gap, 0, 32),
    align: pick(r.align, TEXT_ALIGNS, d.align),
    background: color(r.background, d.background),
    borderWidth: num(r.borderWidth, d.borderWidth, 0, 8),
    borderColor: color(r.borderColor, d.borderColor),
    borderStyle: pick(r.borderStyle, BORDER_STYLES, d.borderStyle),
    radius: num(r.radius, d.radius, 0, 999),
    paddingX: num(r.paddingX, d.paddingX, 0, 40),
    paddingY: num(r.paddingY, d.paddingY, 0, 40),
    shadow: shadow(r.shadow, d.shadow),
    hoverBackground: r.hoverBackground ? color(r.hoverBackground, '') : '',
    hoverBorderColor: r.hoverBorderColor ? color(r.hoverBorderColor, '') : '',
    textColor: color(r.textColor, d.textColor),
    textSize: num(r.textSize, d.textSize, 8, 28),
    textWeight: pick(String(r.textWeight), FONT_WEIGHTS, d.textWeight),
    textFont: font(r.textFont, d.textFont),
    showIcon: bool(r.showIcon, d.showIcon),
    icon: str(r.icon, d.icon, 40),
    iconUrl: str(r.iconUrl, d.iconUrl, 400),
    iconColor: color(r.iconColor, d.iconColor),
    iconSize: num(r.iconSize, d.iconSize, 6, 40),
    iconPosition: pick(r.iconPosition, ICON_POSITIONS, d.iconPosition),
  }
}

export function normalizeChatInput(raw: unknown): ChatInputDesign {
  const r = (raw ?? {}) as Record<string, any>
  const d = CHAT_INPUT_DEFAULTS
  const f = (r.field ?? {}) as Record<string, any>
  const t = (r.text ?? {}) as Record<string, any>
  const p = (r.placeholder ?? {}) as Record<string, any>
  const s = (r.send ?? {}) as Record<string, any>
  const a = (r.actions ?? {}) as Record<string, any>
  const c = (r.container ?? {}) as Record<string, any>
  return {
    layout: pick(r.layout, INPUT_LAYOUTS, d.layout),
    direction: pick(r.direction, ['auto', 'ltr', 'rtl'] as const, d.direction),
    field: {
      background: color(f.background, d.field.background),
      borderWidth: num(f.borderWidth, d.field.borderWidth, 0, 12),
      borderColor: color(f.borderColor, d.field.borderColor),
      borderStyle: pick(f.borderStyle, BORDER_STYLES, d.field.borderStyle),
      radius: num(f.radius, d.field.radius, 0, 999),
      paddingX: num(f.paddingX, d.field.paddingX, 0, 40),
      paddingY: num(f.paddingY, d.field.paddingY, 0, 40),
      minHeight: num(f.minHeight, d.field.minHeight, 28, 120),
      gap: num(f.gap, d.field.gap, 0, 32),
      shadow: shadow(f.shadow, d.field.shadow),
      focusBorderColor: color(f.focusBorderColor, d.field.focusBorderColor),
      focusRingWidth: num(f.focusRingWidth, d.field.focusRingWidth, 0, 12),
      focusRingColor: color(f.focusRingColor, d.field.focusRingColor),
      focusRingOpacity: num(f.focusRingOpacity, d.field.focusRingOpacity, 0, 1),
    },
    text: {
      fontFamily: font(t.fontFamily, d.text.fontFamily),
      size: num(t.size, d.text.size, 9, 28),
      weight: pick(String(t.weight), FONT_WEIGHTS, d.text.weight),
      color: color(t.color, d.text.color),
      lineHeight: num(t.lineHeight, d.text.lineHeight, 1, 2.4),
    },
    placeholder: {
      text: str(p.text, d.placeholder.text),
      color: color(p.color, d.placeholder.color),
      size: num(p.size, d.placeholder.size, 9, 28),
      weight: pick(String(p.weight), FONT_WEIGHTS, d.placeholder.weight),
      italic: bool(p.italic, d.placeholder.italic),
    },
    send: {
      shape: pick(s.shape, BUTTON_SHAPES, d.send.shape),
      size: num(s.size, d.send.size, 20, 72),
      radius: num(s.radius, d.send.radius, 0, 999),
      background: color(s.background, d.send.background),
      iconColor: color(s.iconColor, d.send.iconColor),
      iconSize: num(s.iconSize, d.send.iconSize, 6, 40),
      hoverBackground: s.hoverBackground ? color(s.hoverBackground, d.send.hoverBackground) : '',
      disabledOpacity: num(s.disabledOpacity, d.send.disabledOpacity, 0, 1),
      position: pick(s.position, SEND_POSITIONS, d.send.position),
      shadow: shadow(s.shadow, d.send.shadow),
      icon: str(s.icon, d.send.icon, 40),
      url: str(s.url, d.send.url, 400),
    },
    actions: {
      voice: bool(a.voice, d.actions.voice),
      attach: bool(a.attach, d.actions.attach),
      emoji: bool(a.emoji, d.actions.emoji),
      voiceIcon: str(a.voiceIcon, d.actions.voiceIcon, 40),
      voiceUrl: str(a.voiceUrl, d.actions.voiceUrl, 400),
      attachIcon: str(a.attachIcon, d.actions.attachIcon, 40),
      attachUrl: str(a.attachUrl, d.actions.attachUrl, 400),
      emojiIcon: str(a.emojiIcon, d.actions.emojiIcon, 40),
      emojiUrl: str(a.emojiUrl, d.actions.emojiUrl, 400),
      size: num(a.size, d.actions.size, 20, 72),
      shape: pick(a.shape, BUTTON_SHAPES, d.actions.shape),
      radius: num(a.radius, d.actions.radius, 0, 999),
      background: color(a.background, d.actions.background),
      iconColor: color(a.iconColor, d.actions.iconColor),
      iconSize: num(a.iconSize, d.actions.iconSize, 6, 40),
      hoverBackground: color(a.hoverBackground, d.actions.hoverBackground),
      gap: num(a.gap, d.actions.gap, 0, 24),
    },
    container: {
      background: color(c.background, d.container.background),
      paddingX: num(c.paddingX, d.container.paddingX, 0, 48),
      paddingTop: num(c.paddingTop, d.container.paddingTop, 0, 48),
      paddingBottom: num(c.paddingBottom, d.container.paddingBottom, 0, 48),
    },
  }
}

export function normalizeLauncher(raw: unknown): LauncherDesign {
  const r = (raw ?? {}) as Record<string, any>
  const d = LAUNCHER_DEFAULTS
  const l = (r.label ?? {}) as Record<string, any>
  return {
    type: pick(r.type, ['standard', 'expanded_bubble', 'chat_icon', 'icon_only'] as const, d.type),
    position: pick(r.position, ['left', 'right'] as const, d.position),
    offsetX: num(r.offsetX, d.offsetX, 0, 120),
    offsetY: num(r.offsetY, d.offsetY, 0, 120),
    size: num(r.size, d.size, 32, 96),
    radius: num(r.radius, d.radius, 0, 999),
    background: color(r.background, d.background),
    gradientTo: color(r.gradientTo, d.gradientTo),
    useGradient: bool(r.useGradient, d.useGradient),
    gradientAngle: num(r.gradientAngle, d.gradientAngle, 0, 360),
    borderWidth: num(r.borderWidth, d.borderWidth, 0, 12),
    borderColor: color(r.borderColor, d.borderColor),
    iconColor: color(r.iconColor, d.iconColor),
    icon: pick(r.icon, LAUNCHER_ICONS, d.icon),
    iconUrl: str(r.iconUrl, d.iconUrl, 400),
    iconSize: num(r.iconSize, d.iconSize, 8, 64),
    shadow: shadow(r.shadow, d.shadow),
    label: {
      show: bool(l.show, d.label.show),
      text: str(l.text, d.label.text, 60),
      color: color(l.color, d.label.color),
      fontFamily: font(l.fontFamily, d.label.fontFamily),
      size: num(l.size, d.label.size, 9, 24),
      weight: pick(String(l.weight), FONT_WEIGHTS, d.label.weight),
    },
    entrance: pick(r.entrance, LAUNCHER_ENTRANCES, d.entrance),
    attention: pick(r.attention, LAUNCHER_ATTENTION, d.attention),
    hoverScale: num(r.hoverScale, d.hoverScale, 1, 1.3),
  }
}

/* -------------------------------- compiling ------------------------------- */

/** An 8-digit hex carries its own alpha, so opacity is folded into the value. */
const withAlpha = (hex: string, opacity: number): string => {
  if (hex === 'transparent') return hex
  const base = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7)
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${base}${a}`
}

export const shadowCss = (s: Shadow, brand: string): string =>
  s.size <= 0 && s.blur <= 0 ? 'none' : `0 ${s.y}px ${s.blur}px 0 ${withAlpha(resolve(s.color, brand), s.opacity)}`

const radiusOf = (shape: ButtonShape, radius: number): number =>
  shape === 'circle' ? 999 : shape === 'square' ? 0 : radius

/** The composer's own box, as the CSS blob the widget already spreads onto it. */
export function inputCss(d: ChatInputDesign, brand: string): CSSProperties {
  return {
    backgroundColor: resolve(d.field.background, brand),
    borderWidth: `${d.field.borderWidth}px`,
    borderColor: resolve(d.field.borderColor, brand),
    borderStyle: d.field.borderStyle,
    borderRadius: `${d.field.radius}px`,
    padding: `${d.field.paddingY}px ${d.field.paddingX}px`,
    minHeight: `${d.field.minHeight}px`,
    gap: `${d.field.gap}px`,
    boxShadow: shadowCss(d.field.shadow, brand),
  }
}

/** The `::placeholder` rule the widget injects verbatim. */
export function placeholderCss(d: ChatInputDesign, brand: string): CSSProperties {
  return {
    color: resolve(d.placeholder.color, brand),
    fontSize: `${d.placeholder.size}px`,
    fontWeight: d.placeholder.weight,
    fontStyle: d.placeholder.italic ? 'italic' : 'normal',
  }
}

/** The send button. `iconColor` is the widget's own extra key, not real CSS. */
export function sendCss(d: ChatInputDesign, brand: string): CSSProperties & { iconColor?: string } {
  return {
    backgroundColor: resolve(d.send.background, brand),
    width: `${d.send.size}px`,
    height: `${d.send.size}px`,
    borderRadius: `${radiusOf(d.send.shape, d.send.radius)}px`,
    boxShadow: shadowCss(d.send.shadow, brand),
    iconColor: resolve(d.send.iconColor, brand),
  }
}

/** Action buttons (attach, voice, emoji). */
export function actionCss(d: ChatInputDesign, brand: string): CSSProperties {
  return {
    backgroundColor: resolve(d.actions.background, brand),
    width: `${d.actions.size}px`,
    height: `${d.actions.size}px`,
    borderRadius: `${radiusOf(d.actions.shape, d.actions.radius)}px`,
    color: resolve(d.actions.iconColor, brand),
  }
}

/** The typing text itself. */
export function textCss(d: ChatInputDesign, brand: string): CSSProperties {
  return {
    fontFamily: d.text.fontFamily || undefined,
    fontSize: `${d.text.size}px`,
    fontWeight: d.text.weight,
    color: resolve(d.text.color, brand),
    lineHeight: String(d.text.lineHeight),
  }
}

/** The launcher button, as the CSS blob the widget already spreads onto it. */
export function launcherCss(d: LauncherDesign, brand: string): CSSProperties {
  const bg = resolve(d.background, brand)
  return {
    background: d.useGradient ? `linear-gradient(${d.gradientAngle}deg, ${bg}, ${resolve(d.gradientTo, brand)})` : bg,
    width: `${d.size}px`,
    height: `${d.size}px`,
    borderRadius: `${d.radius}px`,
    borderWidth: `${d.borderWidth}px`,
    borderStyle: d.borderWidth > 0 ? 'solid' : undefined,
    borderColor: resolve(d.borderColor, brand),
    color: resolve(d.iconColor, brand),
    boxShadow: shadowCss(d.shadow, brand),
    fontFamily: d.label.fontFamily || undefined,
    fontWeight: d.label.weight,
  }
}

/** The focus state, which needs a rule rather than inline styles. */
export function focusCss(d: ChatInputDesign, brand: string, selector: string): string {
  const { focusRingWidth, focusRingColor, focusRingOpacity, focusBorderColor } = d.field
  const ring =
    focusRingWidth > 0
      ? `box-shadow:0 0 0 ${focusRingWidth}px ${withAlpha(resolve(focusRingColor, brand), focusRingOpacity)};`
      : ''
  return `${selector}:focus-within,${selector}:focus{border-color:${resolve(focusBorderColor, brand)};${ring}}`
}

/**
 * Hover states, which likewise need rules rather than inline styles. Without
 * these, choosing a hover colour would change nothing anybody could see.
 */
export function hoverCss(d: ChatInputDesign, brand: string, sendSel: string, actionSel: string): string {
  const out: string[] = []
  if (d.send.hoverBackground) out.push(`${sendSel}:hover{background-color:${resolve(d.send.hoverBackground, brand)}}`)
  if (d.actions.hoverBackground && d.actions.hoverBackground !== 'transparent') {
    out.push(`${actionSel}:hover{background-color:${resolve(d.actions.hoverBackground, brand)}}`)
  }
  return out.join('')
}

/**
 * The loading placeholder, as custom properties. The sweep itself stays in the
 * stylesheet — only the colours, the speed and the radius come from here, which
 * keeps one keyframe rather than one per channel.
 */
export function loadingCss(d: LoadingDesign, brand: string): CSSProperties {
  return {
    '--pair-skel-base': resolve(d.baseColor, brand),
    '--pair-skel-hi': resolve(d.highlightColor, brand),
    '--pair-skel-speed': `${d.speedMs}ms`,
    '--pair-skel-radius': `${d.radius}px`,
  }
}

/** One prompt chip's surface and text. */
export function chipCss(d: PromptsDesign, brand: string): CSSProperties {
  return {
    background: d.background === 'transparent' ? 'transparent' : resolve(d.background, brand),
    borderWidth: `${d.borderWidth}px`,
    borderStyle: d.borderWidth > 0 ? d.borderStyle : undefined,
    borderColor: resolve(d.borderColor, brand),
    borderRadius: `${d.radius}px`,
    padding: `${d.paddingY}px ${d.paddingX}px`,
    color: resolve(d.textColor, brand),
    fontSize: `${d.textSize}px`,
    fontWeight: d.textWeight,
    fontFamily: d.textFont || undefined,
    boxShadow: shadowCss(d.shadow, brand),
    textAlign: d.align,
  }
}

/** The chip hover, which needs a rule rather than an inline style. */
export function chipHoverCss(d: PromptsDesign, brand: string, selector: string): string {
  const parts: string[] = []
  if (d.hoverBackground) parts.push(`background-color:${resolve(d.hoverBackground, brand)}`)
  if (d.hoverBorderColor) parts.push(`border-color:${resolve(d.hoverBorderColor, brand)}`)
  return parts.length ? `${selector}:hover{${parts.join(';')}}` : ''
}

/** The toast's own box, as the style sonner puts on each toast. */
export function toastCss(d: ToastDesign, brand: string): CSSProperties {
  return {
    background: resolve(d.background, brand),
    color: resolve(d.textColor, brand),
    borderWidth: `${d.borderWidth}px`,
    borderStyle: d.borderWidth > 0 ? 'solid' : undefined,
    borderColor: resolve(d.borderColor, brand),
    borderRadius: `${d.radius}px`,
    padding: `${d.paddingY}px ${d.paddingX}px`,
    fontSize: `${d.fontSize}px`,
    fontWeight: d.fontWeight,
    boxShadow: shadowCss(d.shadow, brand),
    width: d.fullWidth ? '100%' : undefined,
  }
}

/** The launcher's hover growth, as a rule so it responds to a real pointer. */
export function launcherHoverCss(d: LauncherDesign, selector: string): string {
  if (d.hoverScale <= 1) return ''
  return `${selector}{transition:transform .2s ease}${selector}:hover{transform:scale(${d.hoverScale})}`
}
