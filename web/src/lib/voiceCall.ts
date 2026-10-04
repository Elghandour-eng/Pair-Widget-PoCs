/**
 * Voice calls: the widget's phone button and the call screen it opens.
 *
 * The visitor talks to a voice agent over LiveKit, inside the widget. The
 * studio stores the design under `widget_v2_config.voice_call`; this module
 * fills in every field the builder leaves blank, so the widget and the
 * builder's preview read one complete object.
 *
 * Kept identical in server/src/lib and web/src/lib, like inputDesign.ts.
 */

export const VOICE_CALL_ICONS = ['phone', 'phone-call', 'headset', 'mic', 'audio-lines', 'custom'] as const
export const VOICE_CALL_VISUALIZERS = ['orb', 'bars', 'wave', 'none'] as const
export const VOICE_CALL_LANGUAGES = ['widget', 'en', 'ar'] as const

export type VoiceCallIcon = (typeof VOICE_CALL_ICONS)[number]
export type VoiceCallVisualizer = (typeof VOICE_CALL_VISUALIZERS)[number]
export type VoiceCallLanguage = (typeof VOICE_CALL_LANGUAGES)[number]

/** Every line of copy the call shows. Each is typed per language in the builder. */
export interface VoiceCallTexts {
  headerButton: string
  introButton: string
  title: string
  subtitle: string
  confirmTitle: string
  confirmBody: string
  startButton: string
  cancelButton: string
  connecting: string
  listening: string
  thinking: string
  speaking: string
  ended: string
  failed: string
  micDenied: string
  unavailable: string
  timeLimit: string
  endButton: string
  mute: string
  unmute: string
  closeButton: string
  callAgain: string
}

export interface VoiceCallDesign {
  background: string
  gradientTo: string
  useGradient: boolean
  gradientAngle: number
  textColor: string
  mutedColor: string
  accent: string
  visualizer: VoiceCallVisualizer
  showAvatar: boolean
  avatarUrl: string
  avatarSize: number
  avatarRadius: number
  controlBackground: string
  controlColor: string
  controlSize: number
  endBackground: string
  endColor: string
  captionBackground: string
  captionColor: string
  captionSize: number
  titleSize: number
  fontFamily: string
}

export interface VoiceCall {
  enabled: boolean
  /** A Solef agent's id (its slug): sent as the caller's `prolife.agent_id`, which is how the Solef worker picks the agent. */
  agentId: string
  /** The voice agent's number: the Pair voice agent looks its configuration up by it. */
  agentNumber: string
  /** Set to dispatch a named agent explicitly; blank uses automatic dispatch. */
  agentName: string
  /** Where the call can be started from. */
  entry: { header: boolean; intro: boolean }
  icon: VoiceCallIcon
  iconUrl: string
  /** Ask before dialling, so a stray tap does not open the microphone. */
  confirm: boolean
  /** The call ends by itself after this long. 0 means no limit. */
  maxDurationSec: number
  /** The language the agent is told to speak: the widget's, or a fixed one. */
  language: VoiceCallLanguage
  /** Closing the panel leaves the call running; off, closing the panel ends it. */
  keepAliveWhenClosed: boolean
  showTimer: boolean
  showMute: boolean
  showCaptions: boolean
  texts: VoiceCallTexts
  design: VoiceCallDesign
}

export const BRAND = '#brand'

const TEXTS_EN: VoiceCallTexts = {
  headerButton: 'Call us',
  introButton: 'Talk to us',
  title: 'Voice assistant',
  subtitle: 'Talk to us — we are listening',
  confirmTitle: 'Start a voice call?',
  confirmBody: 'Your microphone will be used for this call. You can end it at any time.',
  startButton: 'Start call',
  cancelButton: 'Not now',
  connecting: 'Connecting…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  ended: 'Call ended',
  failed: 'The call could not connect. Please try again.',
  micDenied: 'Microphone access is blocked. Allow it in your browser and try again.',
  unavailable: 'Voice calls are not available right now.',
  timeLimit: 'The call reached its time limit.',
  endButton: 'End call',
  mute: 'Mute',
  unmute: 'Unmute',
  closeButton: 'Back to chat',
  callAgain: 'Call again',
}

const TEXTS_AR: VoiceCallTexts = {
  headerButton: 'اتصل بنا',
  introButton: 'كلّمنا',
  title: 'المساعد الصوتي',
  subtitle: 'اتكلم معانا — احنا سامعينك',
  confirmTitle: 'تبدأ مكالمة صوتية؟',
  confirmBody: 'هنستخدم الميكروفون في المكالمة دي، وتقدر تنهيها في أي وقت.',
  startButton: 'ابدأ المكالمة',
  cancelButton: 'مش دلوقتي',
  connecting: 'جاري الاتصال…',
  listening: 'بسمعك',
  thinking: 'بفكّر…',
  speaking: 'بتكلم',
  ended: 'انتهت المكالمة',
  failed: 'المكالمة ما اتصلتش. حاول تاني.',
  micDenied: 'الميكروفون مقفول. اسمح بيه من المتصفح وحاول تاني.',
  unavailable: 'المكالمات الصوتية مش متاحة دلوقتي.',
  timeLimit: 'المكالمة وصلت للحد الأقصى للمدة.',
  endButton: 'إنهاء المكالمة',
  mute: 'كتم',
  unmute: 'إلغاء الكتم',
  closeButton: 'رجوع للشات',
  callAgain: 'اتصل تاني',
}

/** The stock copy for a language, for blank fields and the builder's placeholders. */
export function voiceCallTextDefaults(lang: string | undefined): VoiceCallTexts {
  return /^ar/i.test(lang ?? '') ? TEXTS_AR : TEXTS_EN
}

export const VOICE_CALL_TEXT_KEYS = Object.keys(TEXTS_EN) as Array<keyof VoiceCallTexts>

export const VOICE_CALL_DESIGN_DEFAULTS: VoiceCallDesign = {
  background: '#0F1115',
  gradientTo: BRAND,
  useGradient: true,
  gradientAngle: 160,
  textColor: '#FFFFFF',
  mutedColor: '#B4B8C2',
  accent: BRAND,
  visualizer: 'orb',
  showAvatar: true,
  avatarUrl: '',
  avatarSize: 88,
  avatarRadius: 999,
  controlBackground: '#FFFFFF26',
  controlColor: '#FFFFFF',
  controlSize: 56,
  endBackground: '#E5484D',
  endColor: '#FFFFFF',
  captionBackground: '#FFFFFF1A',
  captionColor: '#FFFFFF',
  captionSize: 14,
  titleSize: 20,
  fontFamily: '',
}

export const VOICE_CALL_DEFAULTS: Omit<VoiceCall, 'texts'> = {
  enabled: false,
  agentId: '',
  agentNumber: '',
  agentName: '',
  entry: { header: true, intro: false },
  icon: 'phone',
  iconUrl: '',
  confirm: true,
  maxDurationSec: 600,
  language: 'widget',
  keepAliveWhenClosed: true,
  showTimer: true,
  showMute: true,
  showCaptions: true,
  design: VOICE_CALL_DESIGN_DEFAULTS,
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const color = (v: unknown, d: string): string =>
  typeof v === 'string' && (v === BRAND || v === 'transparent' || HEX.test(v.trim())) ? v.trim() : d
const num = (v: unknown, d: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const str = (v: unknown, d: string, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : d)
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d)
/** A font stack reaches a style attribute, so it is kept to name-ish characters. */
const font = (v: unknown): string => (typeof v === 'string' && /^[\w\s,'"-]*$/.test(v) ? v.trim() : '')
/** Only http(s) and the studio's own upload paths can be drawn. */
const url = (v: unknown): string =>
  typeof v === 'string' && /^(https?:\/\/|\/)[^\s"'<>]*$/i.test(v.trim()) ? v.trim().slice(0, 400) : ''
/** The routing number: digits with an optional leading +, nothing a room name cannot carry. */
const number = (v: unknown): string => (typeof v === 'string' ? v.replace(/[^\d+]/g, '').slice(0, 20) : '')
/** An agent id or a dispatch name: letters, digits, `_`, `.`, `-`. */
const agentName = (v: unknown): string => (typeof v === 'string' ? v.replace(/[^\w.-]/g, '').slice(0, 64) : '')

/**
 * The complete call design. `lang` picks the stock copy for any line the
 * builder left blank; typed copy is already in the config's language by the
 * time it gets here (the language switch handles `<text>_i18n`).
 */
export function normalizeVoiceCall(raw: unknown, lang?: string): VoiceCall {
  const r = (raw ?? {}) as Record<string, any>
  const d = VOICE_CALL_DEFAULTS
  const e = (r.entry ?? {}) as Record<string, unknown>
  const t = (r.texts ?? {}) as Record<string, unknown>
  const g = (r.design ?? {}) as Record<string, unknown>
  const dd = VOICE_CALL_DESIGN_DEFAULTS
  const stock = voiceCallTextDefaults(lang)
  const texts = {} as VoiceCallTexts
  for (const k of VOICE_CALL_TEXT_KEYS) {
    const typed = typeof t[k] === 'string' ? (t[k] as string).trim().slice(0, 240) : ''
    texts[k] = typed || stock[k]
  }
  return {
    enabled: bool(r.enabled, d.enabled),
    agentId: agentName(r.agentId),
    agentNumber: number(r.agentNumber),
    agentName: agentName(r.agentName),
    entry: { header: bool(e.header, d.entry.header), intro: bool(e.intro, d.entry.intro) },
    icon: pick(r.icon, VOICE_CALL_ICONS, d.icon),
    iconUrl: url(r.iconUrl),
    confirm: bool(r.confirm, d.confirm),
    maxDurationSec: num(r.maxDurationSec, d.maxDurationSec, 0, 3600),
    language: pick(r.language, VOICE_CALL_LANGUAGES, d.language),
    keepAliveWhenClosed: bool(r.keepAliveWhenClosed, d.keepAliveWhenClosed),
    showTimer: bool(r.showTimer, d.showTimer),
    showMute: bool(r.showMute, d.showMute),
    showCaptions: bool(r.showCaptions, d.showCaptions),
    texts,
    design: {
      background: color(g.background, dd.background),
      gradientTo: color(g.gradientTo, dd.gradientTo),
      useGradient: bool(g.useGradient, dd.useGradient),
      gradientAngle: num(g.gradientAngle, dd.gradientAngle, 0, 360),
      textColor: color(g.textColor, dd.textColor),
      mutedColor: color(g.mutedColor, dd.mutedColor),
      accent: color(g.accent, dd.accent),
      visualizer: pick(g.visualizer, VOICE_CALL_VISUALIZERS, dd.visualizer),
      showAvatar: bool(g.showAvatar, dd.showAvatar),
      avatarUrl: url(g.avatarUrl),
      avatarSize: num(g.avatarSize, dd.avatarSize, 40, 160),
      avatarRadius: num(g.avatarRadius, dd.avatarRadius, 0, 999),
      controlBackground: color(g.controlBackground, dd.controlBackground),
      controlColor: color(g.controlColor, dd.controlColor),
      controlSize: num(g.controlSize, dd.controlSize, 40, 80),
      endBackground: color(g.endBackground, dd.endBackground),
      endColor: color(g.endColor, dd.endColor),
      captionBackground: color(g.captionBackground, dd.captionBackground),
      captionColor: color(g.captionColor, dd.captionColor),
      captionSize: num(g.captionSize, dd.captionSize, 10, 22),
      titleSize: num(g.titleSize, dd.titleSize, 14, 32),
      fontFamily: font(g.fontFamily),
    },
  }
}

/** A call has somewhere to go: a Solef agent, or a number the Pair voice agent routes by. */
export function voiceCallHasAgent(call: Pick<VoiceCall, 'agentId' | 'agentNumber'>): boolean {
  return !!(call.agentId || call.agentNumber)
}

/** `#brand` swapped for the widget's colour, everywhere it can appear. */
export function resolveVoiceCallColors(call: VoiceCall, brand: string): VoiceCall {
  const rs = (v: string) => (v === BRAND ? brand : v)
  const design = { ...call.design }
  for (const k of Object.keys(design) as Array<keyof VoiceCallDesign>) {
    if (typeof design[k] === 'string') (design as Record<string, unknown>)[k] = rs(design[k] as string)
  }
  return { ...call, design }
}
