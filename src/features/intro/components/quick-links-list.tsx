import { useEffect, useRef, useState } from 'react'

import useEmblaCarousel from 'embla-carousel-react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { QuickLinkItem } from '@/features/intro/components/quick-link-item'

export function QuickLinksList() {
  const { widgetConfig } = useWidgetConfigContext()
  const config = widgetConfig.quickLinks

  // Hide the component if config doesn't exist or show.value is false
  if (!config || !config.show.value) {
    return null
  }

  // Sort the links by displayOrder
  const sortedLinks = [...(config.links || [])].sort((a, b) => {
    const orderA = a.displayOrder ?? 9999
    const orderB = b.displayOrder ?? 9999
    return orderA - orderB
  })

  // Measure container width
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
  const minCardWidth = 5.71 * 16 // 5.71rem in pixels (approx 91.36px)
  const gap = 8 // gap-2 is 8px
  const maxItemsPerView = containerWidth ? Math.floor((containerWidth + gap) / (minCardWidth + gap)) : 3 // Default fallback before container size is measured

  const itemsPerView = Math.max(1, Math.min(maxItemsPerView, sortedLinks.length))
  const basisPercentage = 100 / itemsPerView

  // Initialize Embla Carousel for 'row' layout
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: config.carouselLoop,
    align: 'start',
    active: config.cardStyle.layout === 'row',
  })

  // Re-initialize Embla when slide sizes change
  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit()
    }
  }, [emblaApi, itemsPerView])

  // Autoplay effect when carouselLoop is enabled
  useEffect(() => {
    if (!emblaApi || !config.carouselLoop || config.cardStyle.layout !== 'row') return

    let intervalId: NodeJS.Timeout

    const startAutoplay = () => {
      intervalId = setInterval(() => {
        if (emblaApi) {
          emblaApi.scrollNext()
        }
      }, 3000)
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
  }, [emblaApi, config.carouselLoop, config.cardStyle.layout])

  return (
    <div ref={containerRef} className="w-full">
      {config.cardStyle.layout === 'row' ? (
        <div className="w-full cursor-grab overflow-hidden active:cursor-grabbing" ref={emblaRef}>
          <div className="-ms-2 flex">
            {sortedLinks.map((item) => (
              <div key={item.id} className="flex min-w-0 ps-2" style={{ flex: `0 0 ${basisPercentage}%` }}>
                <QuickLinkItem item={item} config={config} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {sortedLinks.map((item) => (
            <QuickLinkItem key={item.id} item={item} config={config} />
          ))}
        </div>
      )}
    </div>
  )
}
