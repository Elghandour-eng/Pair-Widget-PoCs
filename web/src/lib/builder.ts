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

/**
 * `focus` is the builder section being edited. The frame uses it to show the
 * part of the widget being worked on — the launcher, for instance, is only
 * visible while the widget is closed, so editing it would otherwise change
 * nothing on screen.
 */
export type PreviewConfigMsg = { type: 'pws:config'; config: WidgetConfig | null; dark: boolean; focus?: string }
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

/**
 * The studio's design blocks are compiled into the served CSS after theming,
 * so a theme that only wrote the legacy style paths was overwritten by the
 * design's own colours. These paths re-token the design itself — mirrored in
 * server/src/lib/widgetTheme.ts, which does the same for the served config.
 * Each group only applies when that block exists, so a theme never conjures a
 * design the channel never had.
 */
const DESIGN_THEME_PATHS: Array<[guard: string, paths: Array<[path: string, token: keyof ThemeTokens | null]>]> = [
  ['widget_v2_config.chat_input.design', [
    ['widget_v2_config.chat_input.design.field.background', 'surface2'],
    ['widget_v2_config.chat_input.design.field.borderColor', 'border'],
    ['widget_v2_config.chat_input.design.text.color', 'text'],
    ['widget_v2_config.chat_input.design.placeholder.color', 'faint'],
    ['widget_v2_config.chat_input.design.actions.iconColor', 'muted'],
    ['widget_v2_config.chat_input.design.actions.hoverBackground', 'surface'],
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

export function applyTheme(config: WidgetConfig, theme: ThemeName): WidgetConfig {
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
  // Cinescape Mesh preset copy
  ['Book in a few taps', 'احجز بكم ضغطة'],
  ['Seats, snacks and showtimes in one chat.', 'المقاعد والسناكس والمواعيد في محادثة واحدة.'],
  ['Trending prompts', 'أسئلة شائعة'],
  ['Chat with us!', 'تحدث معنا!'],
  // Pre-chat form defaults
  ['Share your queries or comments here.', 'اكتب استفسارك أو تعليقك هنا.'],
  ['Email Id', 'البريد الإلكتروني'],
  ['Full name', 'الاسم الكامل'],
  ['Phone number', 'رقم الهاتف'],
  ['Message', 'الرسالة'],
  ['Type your message here...', 'اكتب رسالتك هنا...'],
  ['Start Chat', 'ابدأ المحادثة'],
  // Consent gate defaults
  ['Welcome to your AI Assistant', 'أهلاً بك في مساعدك الذكي'],
  ['A few things to keep in mind', 'أشياء بسيطة خليك واخد بالك منها'],
  ['Agree & Continue', 'موافق ومتابعة'],
  ['By continuing, you agree to our Terms of Use and Privacy Policy', 'بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية'],
  ['By continuing, you agree to our', 'بمتابعتك أنت توافق على'],
  ['Terms of Use', 'شروط الاستخدام'],
  ['Privacy Policy', 'سياسة الخصوصية'],
  // CSAT rating defaults
  ['Customer Satisfaction Survey', 'استبيان رضا العملاء'],
  ['How was your experience?', 'كيف كانت تجربتك؟'],
  ['Rate Experience', 'قيّم تجربتك'],
  ['Change Rating', 'تغيير التقييم'],
  ['Submit Feedback', 'إرسال التقييم'],
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
  'widget_v2_config.pre_chat_form.message',
  'widget_v2_config.pre_chat_form.design.messageLabel',
  'widget_v2_config.pre_chat_form.design.messagePlaceholder',
  'widget_v2_config.pre_chat_form.design.buttonText',
  'widget_v2_config.consent_screen.title',
  'widget_v2_config.consent_screen.subtitle',
  'widget_v2_config.consent_screen.footnote',
  'widget_v2_config.consent_screen.buttonText',
  'widget_v2_config.consent_screen.links.terms.label',
  'widget_v2_config.consent_screen.links.privacy.label',
  'widget_v2_config.messages.loadingOlder.text',
  'widget_v2_config.csat.header',
  'widget_v2_config.csat.body',
  'widget_v2_config.csat.buttonText',
  'widget_v2_config.csat.submitText',
]

/**
 * Fields that carry a stored translation beside the copy itself: the widget
 * keeps reading `<path>.text`, while `<path>.i18n.en` / `.i18n.ar` remember
 * what the channel typed in each language so switching the widget language
 * never loses hand-written copy the dictionary below has never seen.
 */
export const BILINGUAL_PATHS = [
  'widget_v2_config.intro_screen.welcomeTitle',
  'widget_v2_config.intro_screen.welcomeSubtitle',
] as const

/**
 * Plain string fields with a hand-typed translation stored beside them at
 * `<path>_i18n.<lang>` — the widget keeps reading the plain path. Mirrored in
 * server/src/lib/widgetLang.ts.
 */
export const PLAIN_BILINGUAL_PATHS = [
  'widget_v2_config.pre_chat_form.message',
  'widget_v2_config.pre_chat_form.design.buttonText',
  'widget_v2_config.pre_chat_form.design.messageLabel',
  'widget_v2_config.pre_chat_form.design.messagePlaceholder',
  'widget_v2_config.consent_screen.title',
  'widget_v2_config.consent_screen.subtitle',
  'widget_v2_config.consent_screen.footnote',
  'widget_v2_config.consent_screen.buttonText',
  'widget_v2_config.consent_screen.links.terms.label',
  'widget_v2_config.consent_screen.links.privacy.label',
  'widget_v2_config.messages.loadingOlder.text',
  'widget_v2_config.csat.header',
  'widget_v2_config.csat.body',
  'widget_v2_config.csat.buttonText',
  'widget_v2_config.csat.submitText',
] as const

/** What a plain bilingual field shows for one language (see BILINGUAL_PATHS). */
export function plainBilingualText(config: WidgetConfig | null, path: string, lang: WidgetLang): string {
  const stored = deepGet(config, `${path}_i18n.${lang}`)
  if (typeof stored === 'string') return stored
  const live = deepGet(config, path)
  if (typeof live !== 'string') return ''
  return currentLang(config) === lang ? live : (translate(live, lang) ?? '')
}

/** Writes one language of a plain bilingual field; the live path follows the active language. */
export function setPlainBilingualText(config: WidgetConfig, path: string, lang: WidgetLang, value: string): WidgetConfig {
  let next = deepSet(config, `${path}_i18n.${lang}`, value)
  if (currentLang(config) === lang) next = deepSet(next, path, value)
  return next
}

/** The dictionary's translation of a string, or undefined when it does not know it. */
export function translate(text: unknown, to: WidgetLang): string | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined
  return (to === 'ar' ? EN_TO_AR : AR_TO_EN).get(norm(text))
}

/**
 * What a bilingual field shows for one language: the stored translation first,
 * then the live text when that language is the active one, and finally the
 * dictionary — so an untouched preset still shows both languages filled in.
 */
export function bilingualText(config: WidgetConfig | null, path: string, lang: WidgetLang): string {
  const stored = deepGet(config, `${path}.i18n.${lang}`)
  if (typeof stored === 'string') return stored
  const text = deepGet(config, `${path}.text`)
  if (typeof text !== 'string') return ''
  return currentLang(config) === lang ? text : (translate(text, lang) ?? '')
}

/**
 * Writes one language of a bilingual field. The widget-facing `.text` only
 * moves when the edited language is the one the widget is currently in.
 */
export function setBilingualText(config: WidgetConfig, path: string, lang: WidgetLang, value: string): WidgetConfig {
  let next = deepSet(config, `${path}.i18n.${lang}`, value)
  if (currentLang(config) === lang) next = deepSet(next, `${path}.text`, value)
  return next
}

export function applyLanguage(config: WidgetConfig, lang: WidgetLang): WidgetConfig {
  const dict = lang === 'ar' ? EN_TO_AR : AR_TO_EN
  const swap = (s: unknown): unknown => (typeof s === 'string' && dict.has(norm(s)) ? dict.get(norm(s))! : s)

  let next = deepSet(config, 'locale', lang)
  // A stored translation beats the dictionary: it is what the channel typed.
  const translated = new Set<string>()
  for (const path of BILINGUAL_PATHS) {
    const stored = bilingualText(config, path, lang)
    if (!stored) continue
    next = deepSet(next, `${path}.text`, stored)
    translated.add(`${path}.text`)
  }
  for (const path of PLAIN_BILINGUAL_PATHS) {
    const stored = deepGet(next, `${path}_i18n.${lang}`)
    if (typeof stored !== 'string' || !stored.trim()) continue
    next = deepSet(next, path, stored)
    translated.add(path)
  }
  for (const path of TEXT_PATHS) {
    if (translated.has(path)) continue
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
  const pcFields = deepGet(next, 'widget_v2_config.pre_chat_form.fields')
  if (Array.isArray(pcFields)) {
    next = deepSet(next, 'widget_v2_config.pre_chat_form.fields',
      pcFields.map((f: Any) => ({
        ...f,
        label: (typeof f.i18n?.[lang]?.label === 'string' && f.i18n[lang].label.trim()) ? f.i18n[lang].label : swap(f.label),
        placeholder: (typeof f.i18n?.[lang]?.placeholder === 'string' && f.i18n[lang].placeholder.trim()) ? f.i18n[lang].placeholder : swap(f.placeholder),
      })))
  }
  const consentPoints = deepGet(next, 'widget_v2_config.consent_screen.points')
  if (Array.isArray(consentPoints)) {
    next = deepSet(next, 'widget_v2_config.consent_screen.points',
      consentPoints.map((pt: Any) => ({
        ...pt,
        text: (typeof pt.i18n?.[lang]?.text === 'string' && pt.i18n[lang].text.trim()) ? pt.i18n[lang].text : swap(pt.text),
      })))
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
