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

  // Carousel is active when layout is NOT column (i.e. flexDirection !== 'column')
  const isCarousel = quickLinksConfig.cardStyles?.flexDirection !== 'column'

  const { containerRef, emblaRef, basisPercentage } = useCarousel({
    itemCount: sortedLinks.length,
    active: isCarousel,
    loop: quickLinksConfig.carouselLoop,
    autoplay: quickLinksConfig.carouselLoop,
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
