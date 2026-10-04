import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'

/**
 * Resolves the design a template card is drawn with.
 *
 * The server sends a `design` object alongside the card data: the template's
 * own defaults with this widget's overrides merged on top. Anything it leaves
 * unset falls through to the widget's theme here, so a card that nobody has
 * customised looks exactly as it did before designs existed.
 *
 * Every renderer takes its surfaces, accent, radius and text colours from this
 * one place, which is why two widgets can render the same registered template
 * and not look alike.
 */

export type TemplateDesign = Record<string, string | number | boolean | undefined>

const RATIOS: Record<string, string> = { '1:1': '1 / 1', '4:3': '4 / 3', '16:9': '16 / 9', '2:3': '2 / 3' }

export interface ResolvedDesign {
  accent: string
  surface: string
  border: string
  radius: number
  padding: number
  titleSize: number
  divider: 'dashed' | 'solid' | 'none'
  columns: number
  /** Ready for `aspect-ratio`. */
  aspect: string
  showImage: boolean
  buttonStyle: 'filled' | 'outline'
  /** Derived from the theme, never customised: a card must stay readable. */
  text: string
  muted: string
  isDark: boolean
  isArabic: boolean
  /** The card's own box, so every renderer opens the same way. */
  cardStyle: { background: string; border: string; borderRadius: number }
}

export function useTemplateDesign(content?: { lang?: string; design?: TemplateDesign }): ResolvedDesign {
  const { widgetConfig, view } = useWidgetConfigContext()
  const d = content?.design ?? {}
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  // the reply's own language (set server-side from the message text) wins over the view setting
  const isArabic = content?.lang ? content.lang === 'ar' : /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')

  const str = (k: string, fallback: string): string => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : fallback)
  const num = (k: string, fallback: number): number => (typeof d[k] === 'number' ? (d[k] as number) : fallback)

  const accent = str('accent', widgetConfig.primaryColor || '#B3202C')
  const surface = str('surface', isDark ? '#181c28' : '#ffffff')
  const border = str('border', isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')
  const radius = num('radius', 16)

  return {
    accent,
    surface,
    border,
    radius,
    padding: num('padding', 16),
    titleSize: num('titleSize', 14),
    divider: str('divider', 'dashed') as ResolvedDesign['divider'],
    columns: num('columns', 2),
    aspect: RATIOS[str('imageRatio', '1:1')] ?? '1 / 1',
    showImage: typeof d.showImage === 'boolean' ? d.showImage : true,
    buttonStyle: str('buttonStyle', 'filled') as ResolvedDesign['buttonStyle'],
    text: isDark ? '#e8eaf2' : '#26272c',
    muted: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    isDark,
    isArabic,
    cardStyle: { background: surface, border: `1px solid ${border}`, borderRadius: radius },
  }
}
