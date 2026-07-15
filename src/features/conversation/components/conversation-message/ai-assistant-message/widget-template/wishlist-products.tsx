import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { WishlistProductsTemplate } from '@/features/conversation/types/message'
import { ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface WishlistProductsProps {
  template: WishlistProductsTemplate
  sourceMessageUlid: string
}

type StatusBadgeValue = 'out_of_stock' | 'low_stock' | 'price_drop' | 'on_sale' | string

function StatusBadge({ label, value }: { label: string; value?: StatusBadgeValue }) {
  let colorClasses = 'bg-[#F1F1F1] text-[#555555]'
  if (value === 'out_of_stock') colorClasses = 'bg-[#F1F1F1] text-[#555555]'
  else if (value === 'low_stock') colorClasses = 'bg-[#FFE8E8] text-[#C0392B]'
  else if (value === 'price_drop') colorClasses = 'bg-[#E4F5E4] text-[#1E7E34]'
  else if (value === 'on_sale') colorClasses = 'bg-[#FFF3E0] text-[#B07D20]'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${colorClasses}`}
    >
      {label}
    </span>
  )
}

interface ProductRowProps {
  product: WishlistProductsTemplate['content']['wishlist']['products'][number]
  withCard?: boolean
  showDivider?: boolean
}

function ProductRow({ product, withCard = false, showDivider = false }: ProductRowProps) {
  const priceFormatted = product.price
    ? (product.price.formatted ?? `${product.price.value} ${product.price.currency}`)
    : null

  // Split price at the decimal for the bold/light styling
  const priceParts = priceFormatted ? priceFormatted.split(' ') : null
  const priceValue = priceParts?.[0] ?? ''
  const priceCurrency = priceParts?.slice(1).join(' ') ?? ''

  return (
    <>
      <div
        className={`flex items-center gap-3 ${withCard ? 'rounded-xl border border-[#E5E5E5] bg-white p-3' : 'py-3'}`}
      >
        {/* Product image */}
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-16 w-16 shrink-0 rounded-lg border-[0.5px] border-solid border-(--Strokes-Primary,#E5E4E1) bg-[#F5F5F5] object-cover"
          />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-lg border-[0.5px] border-solid border-(--Strokes-Primary,#E5E4E1) bg-[#F5F5F5]" />
        )}

        {/* Name + subtitle */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {product.brand && <span className="text-[13px] leading-4.5 font-medium text-[#1F1F1F]">{product.brand}</span>}
          <span className="text-[12px] leading-4 text-[#6F6F6F]">{product.name}</span>
          {product.subtitle && <span className="text-[12px] leading-4 text-[#6F6F6F]">{product.subtitle}</span>}
        </div>

        {/* Price + badge */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {priceFormatted && (
            <span className="text-right text-[13px] leading-4.5 text-[#1F1F1F]">
              <span className="font-semibold">{priceValue}</span>
              {priceCurrency && <span className="ml-1 font-normal text-[#8A8A8A]">{priceCurrency}</span>}
            </span>
          )}
          {product.status_badge && (
            <StatusBadge label={product.status_badge.label} value={product.status_badge.value} />
          )}
        </div>
      </div>

      {/* Divider (for drawer view) */}
      {showDivider && <div className="h-px bg-[#EEEEEE]" />}
    </>
  )
}

export function WishlistProducts({ template, sourceMessageUlid }: WishlistProductsProps) {
  const { content } = template
  const { intro_text, closing_text, wishlist } = content
  const { title, items_count, products, actions } = wishlist

  const [drawerOpen, setDrawerOpen] = useState(false)

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()
  const [loadingAction, setLoadingAction] = useState(false)

  const totalCount = items_count ?? products.length

  const handleAction = async (act: any) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }
    setLoadingAction(true)
    try {
      const res = await dispatchActionMutation({
        conversationId,
        actionUlid: act.id || act.action_ulid || '',
        sourceMessageUlid,
        parameters: act.payload || {},
      })
      if (res.success) {
        toast.success(act.label ? `${act.label} completed!` : 'Action succeeded')
      } else {
        toast.error(res.error_message || 'Action failed')
      }
    } catch (err) {
      toast.error('Failed to execute action')
    } finally {
      setLoadingAction(false)
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        {/* Intro text */}
        {intro_text && <p className="text-[14px] leading-4.5 text-[#1F1F1F]">{intro_text}</p>}

        {/* Wishlist Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-[#F7F7F5]">
          {/* Card header */}
          <div className="flex items-center justify-between px-3 pt-4 pb-3">
            <h2 className="text-[18px] leading-6 font-semibold text-[#1F1F1F]">{title || 'Your Wishlist'}</h2>
            {totalCount > 0 && (
              <span className="text-[12px] font-semibold tracking-wider text-[#8A8A8A] uppercase">
                {totalCount} Items
              </span>
            )}
          </div>

          {/* Product list */}
          <div className="flex flex-col gap-2 px-3 pb-3">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} withCard />
            ))}
          </div>

          {/* View All link */}
          {(actions && actions.length > 0) || totalCount > products.length ? (
            <div className="border-t border-[#E5E5E5] px-3 py-3">
              <button
                type="button"
                disabled={loadingAction}
                onClick={() => (actions && actions.length > 0 ? handleAction(actions[0]) : setDrawerOpen(true))}
                className="flex items-center gap-1.5 text-[14px] font-medium text-[#0066CC] underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                {actions?.[0]?.label || 'View All'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Closing text */}
        {closing_text && <p className="text-[14px] leading-4.5 text-[#1F1F1F]">{closing_text}</p>}
      </section>

      {/* Full-screen Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />

          {/* Drawer panel */}
          <div className="relative z-10 flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E5E5E5] bg-white px-4 py-4">
              <h2 className="text-[18px] leading-6 font-semibold text-[#1F1F1F]">{title || 'Your Wishlist'}</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#555555] transition-colors hover:bg-[#F5F5F5]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Subtitle */}
            <div className="px-4 pt-3 pb-1">
              <p className="text-[14px] leading-4.5 text-[#777777]">Showing {products.length} products</p>
            </div>

            {/* Scrollable product list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {products.map((product, idx) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  withCard={false}
                  showDivider={idx < products.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
