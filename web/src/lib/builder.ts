import type { WidgetConfig } from '@/lib/api'

/**
 * Builder engine: everything the visual builder needs that is not UI.
 *
 * - The postMessage protocol between the builder and the preview frame.
 *   The frame renders whatever config it is posted, exactly like an embedded
 *   widget receiving live design updates from a host page.
 * - Theme presets: one set of semantic tokens per theme, fanned out onto the
 *   concrete config paths the widget reads. A config stores a single theme,
 *   so "dark/light" is a one-click rewrite of those token-driven fields.
 * - Language switching: sets `locale` (which flips the widget to RTL) and
 *   swaps every known copy string using a bilingual dictionary, so EN⇄AR is
 *   also one click. Unknown strings are left alone for the user to edit.
 */

/* ------------------------------- postMessage ------------------------------ */

export const PREVIEW_FRAME_PATH = '/preview-frame'

export type PreviewConfigMsg = { type: 'pws:config'; config: WidgetConfig | null; dark: boolean }
/**
 * A pushed event: the frame applies it on top of whatever config it holds,
 * the way a host page would drive an embedded widget at runtime
 * (`postMessage({type:'pws:event', name:'set-language', value:'ar'})`).
 */
export type PreviewEventMsg =
  | { type: 'pws:event'; name: 'set-language'; value: WidgetLang }
  | { type: 'pws:event'; name: 'set-theme'; value: ThemeName }
export type PreviewInMsg = PreviewConfigMsg | PreviewEventMsg
export type PreviewOutMsg = { type: 'pws:ready' }

export const isPreviewInMsg = (d: unknown): d is PreviewConfigMsg =>
  !!d && typeof d === 'object' && (d as { type?: unknown }).type === 'pws:config'
export const isPreviewEventMsg = (d: unknown): d is PreviewEventMsg =>
  !!d && typeof d === 'object' && (d as { type?: unknown }).type === 'pws:event'
export const isPreviewOutMsg = (d: unknown): d is PreviewOutMsg =>
  !!d && typeof d === 'object' && (d as { type?: unknown }).type === 'pws:ready'

/* ------------------------------ path helpers ------------------------------ */

type Any = Record<string, any>

export const deepGet = (o: unknown, path: string): any =>
  path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o)

/** Immutable set: returns a clone with `path` set to `val`, creating objects on the way. */
export function deepSet(o: WidgetConfig, path: string, val: unknown): WidgetConfig {
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

/* ------------------------------ theme presets ----------------------------- */

export type ThemeName = 'dark' | 'light'

interface ThemeTokens {
  bg: string; surface: string; surface2: string; border: string; border2: string
  text: string; muted: string; faint: string
}

/** Semantic tokens straight from the Cinescape reference (§4.2); they work for any brand. */
export const THEME_TOKENS: Record<ThemeName, ThemeTokens> = {
  dark: { bg: '#000000', surface: '#141414', surface2: '#1C1C1E', border: '#2C2C2E', border2: '#3A3A3C', text: '#FFFFFF', muted: '#A1A1A6', faint: '#6E6E73' },
  light: { bg: '#FFFFFF', surface: '#F6F6F8', surface2: '#F0F0F3', border: '#E5E5EA', border2: '#D1D1D6', text: '#000000', muted: '#5E5E63', faint: '#8E8E93' },
}

/** Which theme the config currently looks like (by its background). */
export function currentTheme(config: WidgetConfig | null): ThemeName {
  const bg = String(deepGet(config, 'widget_v2_config.intro_screen.widgetBackground.background') ?? '#ffffff')
  const m = /#([0-9a-f]{6})/i.exec(bg)
  if (!m) return /black|#000/i.test(bg) ? 'dark' : 'light'
  const n = parseInt(m[1], 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128 ? 'dark' : 'light'
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

export function applyTheme(config: WidgetConfig, theme: ThemeName): WidgetConfig {
  const tokens = THEME_TOKENS[theme]
  let next = config
  for (const [path, token] of THEME_PATHS) next = deepSet(next, path, tokens[token])
  // Card borders live inside a CSS shorthand, so rebuild it with the theme's border color.
  next = deepSet(next, 'widget_v2_config.quick_links.cardStyle.border', `1px solid ${tokens.border}`)
  next = deepSet(next, 'widget_v2_config.trending_prompts.chipStyle.backgroundColor', 'transparent')
  return next
}

/* ---------------------------- language switching --------------------------- */

export type WidgetLang = 'en' | 'ar'

export const currentLang = (config: WidgetConfig | null): WidgetLang =>
  /^ar/i.test(String(deepGet(config, 'locale') ?? 'en')) ? 'ar' : 'en'

/**
 * Bilingual copy pairs. Sourced from the Cinescape reference (§13.3) plus a few
 * generic strings; the dictionary swaps in both directions and leaves anything
 * it does not know untouched.
 */
const COPY_PAIRS: Array<[en: string, ar: string]> = [
  ['Your cinema, one message away', 'سينماك على بُعد رسالة'],
  ['Films, food, cinemas and help, all in one chat.', 'الأفلام والأكل والفروع والمساعدة، كلها في محادثة واحدة.'],
  ['What I can help with', 'كيف أقدر أساعدك'],
  ['Now showing', 'المعروض الآن'],
  ["Films, showtimes and what's new", 'الأفلام والمواعيد والجديد'],
  ['Food & menu', 'الأكل والمنيو'],
  ['Combos, popcorn, hot food and drinks', 'كومبو، فشار، وجبات ساخنة ومشروبات'],
  ['Our cinemas', 'فروعنا'],
  ['Locations, hours and parking', 'المواقع والمواعيد والمواقف'],
  ['Guest care', 'خدمة العملاء'],
  ['How to reach our team', 'كيف تتواصل مع فريقنا'],
  ['Ticket status', 'حالة التذكرة'],
  ['Where your complaint stands', 'آخر تحديث على شكواك'],
  ['Try asking', 'جرّب تسأل'],
  ["What's new this week?", 'ما الجديد هذا الأسبوع؟'],
  ['Is there a vegetarian combo?', 'هل يوجد كومبو نباتي؟'],
  ['Which cinema is closest to me?', 'أي فرع أقرب لي؟'],
  ['Ask me anything…', 'اسألني عن أي شيء…'],
  // Designed hero slides (the preset copy)
  ['What’s showing tonight?', 'إيه المعروض الليلة؟'],
  ['Ask me for films, times and formats.', 'اسألني عن الأفلام والمواعيد والصيغ.'],
  // Styled hero slides (Sadu Night / Triple Arrow / Arrow Window defaults)
  ['Hungry? Ask about the menu', 'جوعان؟ اسأل عن المنيو'],
  ['Combos, popcorn, hot food and drinks.', 'كومبو وفشار ووجبات ساخنة ومشروبات.'],
  ["We're here to help", 'نحن هنا لمساعدتك'],
  ['Reach guest care or check a complaint.', 'تواصل مع خدمة العملاء أو تابع شكواك.'],
  ['How can we help?', 'كيف نقدر نساعدك؟'],
  ['Trending prompts', 'أسئلة شائعة'],
  ['Chat with us!', 'تحدث معنا!'],
]

/** Curly vs straight apostrophes must not break a lookup. */
const norm = (s: string) => s.replace(/’/g, "'").trim()
const EN_TO_AR = new Map(COPY_PAIRS.map(([e, a]) => [norm(e), a]))
const AR_TO_EN = new Map(COPY_PAIRS.map(([e, a]) => [norm(a), e]))

const FONT_STACKS: Record<WidgetLang, string> = {
  en: "'Jost', Futura, 'Century Gothic', sans-serif",
  ar: "'Noto Kufi Arabic', 'Jost', Futura, sans-serif",
}

/** Single text fields that carry visitor-facing copy. */
const TEXT_PATHS = [
  'welcome_title',
  'welcome_tagline',
  'widget_v2_config.header.content.title',
  'widget_v2_config.header.content.subtitle',
  'widget_v2_config.intro_screen.welcomeTitle.text',
  'widget_v2_config.intro_screen.welcomeSubtitle.text',
  'widget_v2_config.intro_screen.introTitle.text',
  'widget_v2_config.quick_links.displaySettings.sectionTitle',
  'widget_v2_config.trending_prompts.displaySettings.sectionTitle',
  'widget_v2_config.chat_input.placeholderText.text',
  'launcher_title',
]

export function applyLanguage(config: WidgetConfig, lang: WidgetLang): WidgetConfig {
  const dict = lang === 'ar' ? EN_TO_AR : AR_TO_EN
  const swap = (s: unknown): unknown => (typeof s === 'string' && dict.has(norm(s)) ? dict.get(norm(s))! : s)

  let next = deepSet(config, 'locale', lang)
  for (const path of TEXT_PATHS) {
    const v = deepGet(next, path)
    const swapped = swap(v)
    if (swapped !== v) next = deepSet(next, path, swapped)
  }
  const cards = deepGet(next, 'widget_v2_config.quick_links.quickLinkCards')
  if (Array.isArray(cards)) {
    next = deepSet(next, 'widget_v2_config.quick_links.quickLinkCards',
      cards.map((c: Any) => ({ ...c, title: swap(c.title), subtitle: swap(c.subtitle) })))
  }
  // A designed hero slide carries its own copy, so it follows the switch too.
  // The badge is a brand name and is deliberately left alone.
  const slides = deepGet(next, 'widget_v2_config.intro_screen.heroSection.heroImages')
  if (Array.isArray(slides)) {
    next = deepSet(next, 'widget_v2_config.intro_screen.heroSection.heroImages',
      slides.map((s: unknown) => {
        const design = (s as Any)?.design
        if (!design || typeof design !== 'object') return s
        const copy = (k: 'title' | 'subtitle') =>
          typeof design[k]?.text === 'string' ? { [k]: { ...design[k], text: swap(design[k].text) } } : {}
        return { ...(s as Any), design: { ...design, ...copy('title'), ...copy('subtitle') } }
      }))
  }
  const chips = deepGet(next, 'widget_v2_config.trending_prompts.promptChips')
  if (Array.isArray(chips)) {
    next = deepSet(next, 'widget_v2_config.trending_prompts.promptChips',
      chips.map((p: Any) => ({ ...p, text: swap(p.text) })))
  }
  // Swap the widget font only when it is one of the two known stacks; a custom font stays.
  const font = deepGet(next, 'styles.fontFamily')
  if (font === FONT_STACKS.en || font === FONT_STACKS.ar) next = deepSet(next, 'styles.fontFamily', FONT_STACKS[lang])
  return next
}
