import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { QuickLinkItem } from '@/features/intro/components/quick-link-item'
import { useCarousel } from '@/hooks/use-carousel'
import { isDarkBackground } from '@/lib/utils'

export function QuickLinksList() {
  const { widgetConfig } = useWidgetConfigContext()
  const quickLinksConfig = widgetConfig.quickLinks

  if (!quickLinksConfig || !quickLinksConfig.show) {
    return null
  }

  // Sort the links by displayOrder
  const sortedLinks = quickLinksConfig.links
    .filter((l) => l.active)
    .sort((a, b) => {
      const orderA = a.displayOrder ?? 9999
      const orderB = b.displayOrder ?? 9999
      return orderA - orderB
    })

  // The studio names the layout outright; without one, a column card style is
  // still how a stacked list used to be expressed.
  const design = quickLinksConfig.design
  const layout = design?.layout ?? (quickLinksConfig.cardStyles?.flexDirection !== 'column' ? 'carousel' : 'stack')
  const isCarousel = layout === 'carousel'

  const rtl = /^(ar|he|fa|ur)/i.test(widgetConfig.locale ?? 'en')
  const { containerRef, emblaRef, basisPercentage } = useCarousel({
    itemCount: sortedLinks.length,
    active: isCarousel,
    rtl,
    loop: design?.loop ?? quickLinksConfig.carouselLoop,
    // Auto-scroll is its own choice now, rather than riding on looping.
    autoplay: design ? design.autoScroll === true : quickLinksConfig.carouselLoop,
    autoplayInterval: design?.intervalMs,
    minCardWidth: design?.cardWidth,
    gap: design?.gap,
  })

  if (sortedLinks.length === 0) {
    return null
  }

  const itemProps = {
    cardStyles: quickLinksConfig.cardStyles,
    textStyle: quickLinksConfig.textStyle,
    subtitleStyle: quickLinksConfig.subtitleStyle,
    showTitle: quickLinksConfig.showTitle,
    showSubtitle: quickLinksConfig.showSubtitle,
    design,
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* The channel's own heading over the cards, led by a brand chevron —
          the same row the studio's preview draws. */}
      {quickLinksConfig.title && (
        <p
          className="mb-2 flex items-center gap-1 text-[0.875rem] leading-[150%] font-bold"
          // The heading sits straight on the widget background, so its colour
          // follows that background's own lightness — a dark theme keeps it visible.
          style={{ color: isDarkBackground(widgetConfig.widgetBgColor) ? '#F5F5F7' : '#1E1E1E' }}
        >
          <span className="rtl:-scale-x-100" style={{ color: widgetConfig.primaryColor }}>
            ‹
          </span>
          {quickLinksConfig.title}
        </p>
      )}
      {isCarousel ? (
        // Keyed on direction: flipping the widget language re-mounts embla,
        // whose snap positions otherwise go stale and leave blank track.
        <div
          key={rtl ? 'rtl' : 'ltr'}
          className="w-full cursor-grab overflow-hidden active:cursor-grabbing"
          ref={emblaRef}
        >
          <div className="-ms-2 flex">
            {sortedLinks.map((item) => (
              <div key={item.id} className="flex min-w-0 ps-2" style={{ flex: `0 0 ${basisPercentage}%` }}>
                <QuickLinkItem item={item} {...itemProps} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className={layout === 'grid' ? 'grid w-full grid-cols-2' : 'flex w-full flex-col'}
          style={{ gap: design?.gap ?? 8 }}
        >
          {sortedLinks.map((item) => (
            <QuickLinkItem key={item.id} item={item} {...itemProps} />
          ))}
        </div>
      )}
    </div>
  )
}
