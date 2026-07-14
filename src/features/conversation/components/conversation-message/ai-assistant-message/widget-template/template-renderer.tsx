import type { WidgetTemplate } from '@/features/conversation/types/message'
import { ProductComparison } from './product-comparison'
import { ProductCollectionSummary } from './product-collection-summary'
import { InformativeTemplate } from './informative-template'
import { OrderStatus } from './order-status'
import { ErrorCard } from './error-card'
import { WishlistProducts } from './wishlist-products'
import { OffersCarousel } from './offers-carousel'

interface TemplateRendererProps {
  widgetTemplate: WidgetTemplate
  sourceMessageUlid: string
}

export function TemplateRenderer({ widgetTemplate, sourceMessageUlid }: TemplateRendererProps) {
  switch (widgetTemplate.type) {
    case 'product_comparison':
      return <ProductComparison template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'product_collection_suggestions':
      return <ProductCollectionSummary template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'informative':
      return <InformativeTemplate template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'order_status':
      return <OrderStatus template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'error_card':
      return <ErrorCard template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'wishlist_products':
      return <WishlistProducts template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'carousel':
      return <OffersCarousel template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    default:
      return null
  }
}
