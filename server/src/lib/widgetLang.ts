import type { WidgetConfig } from '../services/pairApi.js'

/**
 * Server-side widget language switch, mirroring the builder's applyLanguage:
 * sets `locale` (which flips the widget RTL) and swaps every known copy string
 * with a bilingual dictionary. Unknown strings are left untouched.
 *
 * It exists on the server so the public test page can serve a whole config in
 * either language: the widget's beBaseUrl points at /lang/:lng/v1 and the
 * config arrives already translated.
 */

export type WidgetLang = 'en' | 'ar'

type Any = Record<string, any>

const deepGet = (o: unknown, path: string): any =>
  path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o)

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

/** Bilingual copy pairs (kept in sync with web/src/lib/builder.ts). */
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
]

const norm = (s: string) => s.replace(/’/g, "'").trim()
const EN_TO_AR = new Map(COPY_PAIRS.map(([e, a]) => [norm(e), a]))
const AR_TO_EN = new Map(COPY_PAIRS.map(([e, a]) => [norm(a), e]))

const FONT_STACKS: Record<WidgetLang, string> = {
  en: "'Jost', Futura, 'Century Gothic', sans-serif",
  ar: "'Noto Kufi Arabic', 'Jost', Futura, sans-serif",
}

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

/**
 * Fields the dashboard stores in both languages under `<path>.i18n.<lang>`.
 * Mirrors BILINGUAL_PATHS in web/src/lib/builder.ts.
 */
const BILINGUAL_PATHS = [
  'widget_v2_config.intro_screen.welcomeTitle',
  'widget_v2_config.intro_screen.welcomeSubtitle',
]

export function applyWidgetLanguage(config: WidgetConfig, lang: WidgetLang): WidgetConfig {
  const dict = lang === 'ar' ? EN_TO_AR : AR_TO_EN
  const swap = (s: unknown): unknown => (typeof s === 'string' && dict.has(norm(s)) ? dict.get(norm(s))! : s)

  let next = deepSet(config, 'locale', lang)
  // Copy the channel typed itself wins over the dictionary's guess.
  const translated = new Set<string>()
  for (const path of BILINGUAL_PATHS) {
    const stored = deepGet(config, `${path}.i18n.${lang}`)
    if (typeof stored !== 'string' || !stored) continue
    next = deepSet(next, `${path}.text`, stored)
    translated.add(`${path}.text`)
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
  const chips = deepGet(next, 'widget_v2_config.trending_prompts.promptChips')
  if (Array.isArray(chips)) {
    next = deepSet(next, 'widget_v2_config.trending_prompts.promptChips',
      chips.map((p: Any) => ({ ...p, text: swap(p.text) })))
  }
  const font = deepGet(next, 'styles.fontFamily')
  if (font === FONT_STACKS.en || font === FONT_STACKS.ar) next = deepSet(next, 'styles.fontFamily', FONT_STACKS[lang])
  return next
}
