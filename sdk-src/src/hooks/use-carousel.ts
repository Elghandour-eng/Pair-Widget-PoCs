import { useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'

interface UseCarouselProps {
  itemCount: number
  active: boolean
  loop?: boolean
  autoplay?: boolean
  autoplayInterval?: number
  minCardWidth?: number // in pixels
  gap?: number // in pixels
  /** Right-to-left layout, from the widget's own locale — not the document,
   *  which is only updated after the switched config has already rendered. */
  rtl?: boolean
}

export function useCarousel({
  itemCount,
  active,
  loop = false,
  autoplay = false,
  autoplayInterval = 3000,
  minCardWidth = 5.71 * 16, // approx 91.36px
  gap = 8,
  rtl = false,
}: UseCarouselProps) {
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate slides per view based on container width
  const maxItemsPerView = containerWidth ? Math.floor((containerWidth + gap) / (minCardWidth + gap)) : 3
  const itemsPerView = Math.max(1, Math.min(maxItemsPerView, itemCount))
  const basisPercentage = 100 / itemsPerView

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop,
    align: 'start',
    active,
    // Without this an RTL track measures its snaps backwards: autoplay then
    // scrolls past the cards and holds on blank space.
    direction: rtl ? 'rtl' : 'ltr',
    // Never offer a snap that shows trailing empty track.
    containScroll: 'trimSnaps',
  })

  // Re-initialize Embla when slide sizes change
  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit()
    }
  }, [emblaApi, itemsPerView])

  // Autoplay effect
  useEffect(() => {
    if (!emblaApi || !autoplay || !active) return
    // A visitor who asked for reduced motion still swipes the track by hand;
    // it just never moves on its own.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let intervalId: NodeJS.Timeout

    const startAutoplay = () => {
      intervalId = setInterval(() => {
        if (!emblaApi) return
        // Off the end (loop off or not engaged), wrap to the start rather
        // than pushing into blank track.
        if (emblaApi.canScrollNext()) emblaApi.scrollNext()
        else emblaApi.scrollTo(0)
      }, autoplayInterval)
    }

    const stopAutoplay = () => {
      clearInterval(intervalId)
    }

    startAutoplay()

    emblaApi.on('pointerDown', stopAutoplay)
    emblaApi.on('pointerUp', startAutoplay)

    return () => {
      clearInterval(intervalId)
      emblaApi.off('pointerDown', stopAutoplay)
      emblaApi.off('pointerUp', startAutoplay)
    }
  }, [emblaApi, autoplay, active, autoplayInterval])

  return {
    containerRef,
    emblaRef,
    emblaApi,
    basisPercentage,
    itemsPerView,
  }
}
