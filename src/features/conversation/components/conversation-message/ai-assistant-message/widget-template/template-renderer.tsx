import type { WidgetTemplate } from '@/features/conversation/types/message'
import { ProductCollectionSummary } from './product-collection-summary'

interface TemplateRendererProps {
  widgetTemplate: WidgetTemplate
  sourceMessageUlid: string
}

export function TemplateRenderer({ widgetTemplate, sourceMessageUlid }: TemplateRendererProps) {
  switch (widgetTemplate.type) {
    case 'product_collection_suggestions':
      return <ProductCollectionSummary template={widgetTemplate} sourceMessageUlid={sourceMessageUlid} />
    default:
      return null
  }
}
