import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { IntroHeroCarousel } from '@/config/types/widget-config'
import { cn } from '@/lib/utils'

/**
 * The intro hero.
 *
 * A hero is a list of slides, and how it behaves — how long a slide is held,
 * how slides change, whether there are dots and what they look like — comes
 * from the widget config rather than being fixed here, so each channel styles
 * its own. With a single slide this renders exactly what it always did: one
 * image, no timer, no dots.
 *
 * Autoplay stops while the hero is off screen or the tab is hidden, and is not
 * started at all for a visitor who asked for reduced motion.
 */
export function HeroCarousel({
  slides,
  carousel,
  className,
  style,
  containerStyle,
  centered,
}: {
  slides: string[]
  carousel: IntroHeroCarousel
  className?: string
  style?: CSSProperties
  containerStyle?: CSSProperties
  centered?: boolean
}) {
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(true)
  const hostRef = useRef<HTMLDivElement>(null)
  const count = slides.length

  // Paying for a timer, and for decoding slides nobody is looking at, is waste.
  useEffect(() => {
    if (count < 2) return
    const host = hostRef.current
    if (!host) return
    const onVisibility = () => setRunning(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    const observer = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting && !document.hidden), {
      threshold: 0.1,
    })
    observer.observe(host)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
    }
  }, [count])

  useEffect(() => {
    if (count < 2 || !carousel.autoplay || !running) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), carousel.intervalMs)
    return () => window.clearInterval(id)
  }, [count, carousel.autoplay, carousel.intervalMs, running])

  useEffect(() => {
    setIndex((i) => (i < count ? i : 0))
  }, [count])

  if (!count) return null

  const active = index % count
  const dots = carousel.dots
  const showDots = count > 1 && dots.show

  const image = (src: string, i: number) => (
    <img
      key={i}
      src={src}
      alt=""
      // Only the cover blocks first paint; the rest are fetched as they are needed.
      loading={i === 0 ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={i === 0 ? 'high' : 'low'}
      className={cn('w-full rounded object-cover', className)}
      style={style}
    />
  )

  return (
    <div ref={hostRef} className={cn('w-full', centered && 'flex flex-col items-center')} style={containerStyle}>
      {count === 1 ? (
        image(slides[0], 0)
      ) : (
        <div className="relative w-full overflow-hidden rounded">
          {carousel.transition === 'slide' ? (
            <div
              className="flex w-full transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              {slides.map((src, i) => (
                <div key={i} className="w-full shrink-0">
                  {image(src, i)}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* An invisible copy of the cover holds the box's height; every real
                  slide then crossfades in the same absolute position, so no other
                  slide is ever visible through a crossfade. */}
              <div className="invisible" aria-hidden>
                {image(slides[0], 0)}
              </div>
              {slides.map((src, i) => (
                <div
                  key={i}
                  className="absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none"
                  style={{ opacity: active === i ? 1 : 0 }}
                  aria-hidden={active !== i}
                >
                  {image(src, i)}
                </div>
              ))}
            </>
          )}

          {showDots && dots.position === 'overlay' && (
            <HeroDots
              dots={dots}
              count={count}
              active={active}
              onPick={setIndex}
              className="absolute inset-x-0 bottom-2"
            />
          )}
        </div>
      )}

      {showDots && dots.position === 'below' && (
        <HeroDots dots={dots} count={count} active={active} onPick={setIndex} className="mt-2" />
      )}
    </div>
  )
}

/** Carousel dots. Shape, size, spacing and both colours come from the config. */
function HeroDots({
  dots,
  count,
  active,
  onPick,
  className,
}: {
  dots: IntroHeroCarousel['dots']
  count: number
  active: number
  onPick: (i: number) => void
  className?: string
}) {
  const height = dots.shape === 'bar' ? Math.max(2, dots.size * 0.6) : dots.size

  return (
    <div className={cn('flex items-center justify-center', className)} style={{ gap: dots.gap }}>
      {Array.from({ length: count }, (_, i) => {
        const on = i === active
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Slide ${i + 1} of ${count}`}
            aria-current={on}
            className="cursor-pointer border-0 p-0 transition-all duration-300 motion-reduce:transition-none"
            style={{
              width: dots.shape === 'dot' ? dots.size : on ? dots.activeWidth : dots.size,
              height,
              borderRadius: dots.shape === 'bar' ? 2 : 999,
              background: on ? dots.activeColor : dots.inactiveColor,
              opacity: on ? 1 : dots.inactiveOpacity,
            }}
          />
        )
      })}
    </div>
  )
}
