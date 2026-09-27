import { memo, useMemo } from 'react'
import { buildHeroSvg, type HeroDesign } from '@/lib/heroDesign'

/**
 * A designed hero slide in the dashboard.
 *
 * The composition itself lives in `@/lib/heroDesign`, which builds it as an SVG
 * string — the same builder the server uses for the real widget, so the preview
 * and the shipped image cannot drift. That also means the slide costs one
 * string build per config change and nothing at all per frame: no measuring, no
 * ResizeObserver, no React nodes per shape. The viewBox does the scaling and
 * the animations are CSS inside the SVG.
 *
 * The markup is inlined, which is safe because every value reaching it is either
 * escaped or validated down to a literal (see `normalizeHeroDesign`).
 */

/** The dashboard can fetch the tile, so it takes the sharper 2x copy by URL. */
const patternHref = (file: string) => `/hero-patterns/${file}.webp`

export const HeroDesignSlide = memo(function HeroDesignSlide({
  design,
  brand,
  rtl,
  uid,
}: {
  design: HeroDesign
  brand: string
  rtl: boolean
  uid: string
}) {
  const svg = useMemo(() => buildHeroSvg(design, { uid, patternHref, rtl, brand }), [design, uid, rtl, brand])
  return (
    <div
      className="absolute inset-0 [&>svg]:block [&>svg]:size-full"
      // Built from validated values only; see the note above.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
})
