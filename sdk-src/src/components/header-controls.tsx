import {
  BookA,
  Captions,
  Contrast,
  Earth,
  Eclipse,
  Globe,
  Languages,
  Lightbulb,
  Moon,
  MoonStar,
  Palette,
  Speech,
  Sun,
  SunDim,
  SunMoon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'

/**
 * The header's language and theme switches.
 *
 * Both work by refetching the config from the backend's /pv view base — the
 * language arrives fully translated (and right-to-left when it should be), the
 * theme fully re-coloured, exactly as the studio's own preview switches them.
 * The glyph on each button is the studio's to choose, from the sets below or
 * an uploaded image.
 */

/** Every glyph a header control can wear, by the name the studio stores. */
const CONTROL_GLYPHS = {
  // language
  globe: Globe,
  languages: Languages,
  earth: Earth,
  speech: Speech,
  captions: Captions,
  'book-a': BookA,
  // theme
  moon: Moon,
  sun: Sun,
  'sun-moon': SunMoon,
  'moon-star': MoonStar,
  eclipse: Eclipse,
  contrast: Contrast,
  'sun-dim': SunDim,
  lightbulb: Lightbulb,
  palette: Palette,
} as const

/**
 * Ghost buttons hover/focus with the app's own light accent tokens, which on a
 * dark header is a white chip behind a white glyph. These states follow
 * currentColor instead, so they read on any header the studio designs.
 */
const CONTROL_BTN =
  'hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] hover:text-current focus-visible:ring-[color-mix(in_srgb,currentColor_30%,transparent)]'

function ControlGlyph({ name, url, fallback }: { name?: string; url?: string; fallback: keyof typeof CONTROL_GLYPHS }) {
  if (name === 'custom' && url) {
    return <img src={url} alt="" className="size-4 object-contain" />
  }
  const Glyph = CONTROL_GLYPHS[name as keyof typeof CONTROL_GLYPHS] ?? CONTROL_GLYPHS[fallback]
  return <Glyph className="size-4" />
}

export function HeaderControls() {
  const { widgetConfig, view, setView } = useWidgetConfigContext()
  const controls = widgetConfig.headerConfig?.controls
  if (!controls || (!controls.lang.show && !controls.theme.show)) return null

  const isArabic = /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)

  return (
    <>
      {controls.lang.show && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={CONTROL_BTN}
          aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
          title={isArabic ? 'English' : 'عربي'}
          onClick={() => setView({ ...view, lang: isArabic ? 'en' : 'ar' })}
        >
          {controls.lang.icon === 'badge' ? (
            // The badge names the language a tap brings, the way the studio
            // previews it: عربي while English is showing, EN while Arabic is.
            <span
              className="rounded-sm px-1 py-0.5 text-[11px] leading-none font-bold"
              style={{ background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
            >
              {isArabic ? 'EN' : 'عربي'}
            </span>
          ) : (
            <ControlGlyph name={controls.lang.icon} url={controls.lang.iconUrl} fallback="globe" />
          )}
        </Button>
      )}
      {controls.theme.show && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={CONTROL_BTN}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Light' : 'Dark'}
          onClick={() => setView({ ...view, theme: isDark ? 'light' : 'dark' })}
        >
          {/* The theme button flips to the sun once the view is dark, so it
              always shows what a tap will bring — unless the studio pinned a
              specific glyph other than the default moon. */}
          {controls.theme.icon === 'moon' && isDark ? (
            <Sun className="size-4" />
          ) : (
            <ControlGlyph name={controls.theme.icon} url={controls.theme.iconUrl} fallback="moon" />
          )}
        </Button>
      )}
    </>
  )
}
