import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { QuickLinkItem } from '@/features/intro/components/quick-link-item'
import { useCarousel } from '@/hooks/use-carousel'

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
  const isCarousel = design ? design.layout === 'carousel' : quickLinksConfig.cardStyles?.flexDirection !== 'column'

  const { containerRef, emblaRef, basisPercentage } = useCarousel({
    itemCount: sortedLinks.length,
    active: isCarousel,
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

  return (
    <div ref={containerRef} className="w-full">
      {isCarousel ? (
        <div className="w-full cursor-grab overflow-hidden active:cursor-grabbing" ref={emblaRef}>
          <div className="-ms-2 flex">
            {sortedLinks.map((item) => (
              <div key={item.id} className="flex min-w-0 ps-2" style={{ flex: `0 0 ${basisPercentage}%` }}>
                <QuickLinkItem
                  item={item}
                  cardStyles={quickLinksConfig.cardStyles}
                  textStyle={quickLinksConfig.textStyle}
                  showTitle={quickLinksConfig.showTitle}
                  showSubtitle={quickLinksConfig.showSubtitle}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {sortedLinks.map((item) => (
            <QuickLinkItem
              key={item.id}
              item={item}
              cardStyles={quickLinksConfig.cardStyles}
              textStyle={quickLinksConfig.textStyle}
              showTitle={quickLinksConfig.showTitle}
              showSubtitle={quickLinksConfig.showSubtitle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
