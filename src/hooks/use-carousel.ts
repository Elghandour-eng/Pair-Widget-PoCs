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
}

export function useCarousel({
  itemCount,
  active,
  loop = false,
  autoplay = false,
  autoplayInterval = 3000,
  minCardWidth = 5.71 * 16, // approx 91.36px
  gap = 8,
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

    let intervalId: NodeJS.Timeout

    const startAutoplay = () => {
      intervalId = setInterval(() => {
        if (emblaApi) {
          emblaApi.scrollNext()
        }
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
