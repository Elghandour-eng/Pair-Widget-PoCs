import { memo, useEffect, useState, type ReactNode } from 'react'
import { dotColor, type HeroCarousel as HeroCarouselCfg, type HeroSlide } from '@/lib/heroDesign'
import { HeroDesignSlide } from './HeroDesign'

/**
 * The hero carousel, exactly as the widget config describes it: how long a
 * slide is held, how slides change, and how the dots look. Nothing here is a
 * constant a channel cannot change.
 *
 * Inactive slides have their animations paused rather than being unmounted (see
 * `.hero-slide` in styles.css) — a drifting pattern is the one thing on this
 * screen that costs anything per frame, and a hero with five slides should not
 * pay for five of them.
 */

export const HeroCarousel = memo(function HeroCarousel({
  slides,
  carousel,
  brand,
  rtl,
  overlay,
}: {
  slides: HeroSlide[]
  carousel: HeroCarouselCfg
  brand: string
  rtl: boolean
  /** The widget's own welcome copy, drawn over a slide that carries none of its own. */
  overlay?: (slide: HeroSlide) => ReactNode
}) {
  const n = slides.length
  const [idx, setIdx] = useState(0)

  // Slides can be removed from under the index while the builder is open.
  useEffect(() => {
    setIdx((i) => (i < n ? i : 0))
  }, [n])

  useEffect(() => {
    if (n < 2 || !carousel.autoplay) return
    const id = setInterval(() => setIdx((i) => (i + 1) % n), carousel.intervalMs)
    return () => clearInterval(id)
  }, [n, carousel.autoplay, carousel.intervalMs])

  if (!n) return null
  const active = idx % n
  const sliding = carousel.transition === 'slide'
  // The track travels towards the reading direction, so RTL slides the other way.
  const shift = `translateX(${(rtl ? active : -active) * 100}%)`

  return (
    <div className="relative">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl">
        <div
          className={sliding ? 'flex size-full transition-transform duration-500 ease-out' : 'contents'}
          style={sliding ? { transform: shift } : undefined}
        >
          {slides.map((slide, i) => {
            const isActive = i === active
            return (
              <div
                key={i}
                className={
                  sliding
                    ? 'hero-slide relative size-full shrink-0'
                    : `hero-slide absolute inset-0 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`
                }
                data-active={isActive}
              >
                {slide.type === 'image' ? (
                  <img
                    src={slide.url}
                    alt=""
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <HeroDesignSlide design={slide.design} brand={brand} rtl={rtl} uid={`hs${i}`} />
                )}
                {overlay?.(slide)}
              </div>
            )
          })}
        </div>

        {n > 1 && carousel.dots.show && carousel.dots.position === 'overlay' && (
          <Dots carousel={carousel} brand={brand} n={n} active={active} onPick={setIdx} inset />
        )}
      </div>

      {n > 1 && carousel.dots.show && carousel.dots.position === 'below' && (
        <Dots carousel={carousel} brand={brand} n={n} active={active} onPick={setIdx} />
      )}
    </div>
  )
})

/** Carousel dots. Shape, size, gap and both colours come from the config. */
function Dots({
  carousel,
  brand,
  n,
  active,
  onPick,
  inset,
}: {
  carousel: HeroCarouselCfg
  brand: string
  n: number
  active: number
  onPick: (i: number) => void
  inset?: boolean
}) {
  const d = carousel.dots
  const activeColor = dotColor(d.activeColor, brand, '#E30613')
  const inactiveColor = dotColor(d.inactiveColor, brand, '#A1A1A6')
  // `pill` stretches the active dot; `bar` is a track of equal segments; `dot` stays round.
  const height = d.shape === 'bar' ? Math.max(2, d.size * 0.6) : d.size
  const radius = d.shape === 'bar' ? 2 : 999

  return (
    <div
      className={`flex items-center justify-center ${inset ? 'absolute inset-x-0 bottom-2' : 'mt-2'}`}
      style={{ gap: d.gap }}
    >
      {Array.from({ length: n }, (_, i) => {
        const on = i === active
        return (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1} / ${n}`}
            aria-current={on}
            onClick={() => onPick(i)}
            className="cursor-pointer border-0 p-0 transition-all duration-300"
            style={{
              width: d.shape === 'dot' ? d.size : on ? d.activeWidth : d.size,
              height,
              borderRadius: radius,
              background: on ? activeColor : inactiveColor,
              opacity: on ? 1 : d.inactiveOpacity,
            }}
          />
        )
      })}
    </div>
  )
}
