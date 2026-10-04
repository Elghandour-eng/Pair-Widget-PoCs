import type { OffersCarouselTemplate, WidgetTemplate } from '@/features/conversation/types/message'
import { ProductComparison } from './product-comparison'
import { ProductCollectionSummary } from './product-collection-summary'
import { InformativeTemplate } from './informative-template'
import { OrderStatus } from './order-status'
import { ErrorCard } from './error-card'
import { WishlistProducts } from './wishlist-products'
import { OffersCarousel } from './offers-carousel'
import { ProductsCarousel } from './products-carousel'
import { ProductSlots } from './product-slots'
import { LocationCards } from './location-cards'
import { PriceList } from './price-list'
import { ExperiencesList } from './experiences-list'
import { AppLinks } from './app-links'
import { MenuCards } from './menu-cards'
import { MovieCards } from './movie-cards'
import { MenuCategories } from './menu-categories'
import { ImageCard, LinkCard, TicketCard, TicketList } from './pair-plugin-cards'

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
      if (widgetTemplate.carousel_type === 'products') {
        return <ProductsCarousel template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
      }
      return (
        <OffersCarousel template={widgetTemplate as OffersCarouselTemplate} sourceMessageUlid={sourceMessageUlid} />
      )
    case 'product_slots':
      return <ProductSlots template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'location_cards':
      return <LocationCards template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'price_list':
      return <PriceList template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'experiences_list':
      return <ExperiencesList template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'app_links':
      return <AppLinks template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'menu_cards':
      return <MenuCards template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'movie_cards':
      return <MovieCards template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'menu_categories':
      return <MenuCategories template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'ticket_card':
      return <TicketCard template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'ticket_list':
      return <TicketList template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'link_card':
      return <LinkCard template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    case 'image_card':
      return <ImageCard template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    default:
      return null
  }
}
