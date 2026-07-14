import { Spinner } from '@/components/ui/spinner'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { ProductCollectionSuggestionsTemplate } from '@/features/conversation/types/message'
import { ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ProductCollectionSummaryProps {
  template: ProductCollectionSuggestionsTemplate
  sourceMessageUlid: string
}

export function ProductCollectionSummary({ template, sourceMessageUlid }: ProductCollectionSummaryProps) {
  const { content } = template
  const { collection } = content
  const { title, icon, subtitle, description, savings_banner, products, summary_rows, collection_total, actions } =
    collection

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()
  const [loadingAction, setLoadingAction] = useState(false)

  const handleAction = async (action: any) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }
    setLoadingAction(true)
    try {
      const res = await dispatchActionMutation({
        conversationId,
        actionUlid: action.action_ulid || '',
        sourceMessageUlid,
        parameters: action.payload || {},
      })
      if (res.success) {
        toast.success(action.label ? `${action.label} completed!` : 'Action succeeded')
      } else {
        toast.error(res.error_message || 'Action failed')
      }
    } catch (err) {
      toast.error('Failed to execute action')
    } finally {
      setLoadingAction(false)
    }
  }

  const productCount = products.length

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <h2 className="mb-5 flex items-center gap-2 text-[18px] leading-6.75 font-semibold text-[#1A1A1A]">
        {icon && <span className="text-lg leading-none">{icon}</span>}
        {title}
      </h2>
      <section className="flex w-full min-w-0 flex-col gap-4 overflow-hidden rounded-xl border-[1.5px] border-[#E5E4E1] bg-[#F9F8F4] p-[20px_16px] font-sans transition-all duration-300">
        {/* Savings Banner */}
        {savings_banner && savings_banner.title && (
          <div className="flex items-start justify-between gap-3 self-stretch rounded-xl border border-[#E5E4E1] bg-[#ECE6F2] p-2">
            <div className="shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 17 17" fill="none">
                <path
                  d="M6.20594 3.48672C6.05915 3.34031 5.87785 3.23324 5.67876 3.17537C5.47968 3.11751 5.26922 3.11072 5.06682 3.15564C4.86443 3.20056 4.6766 3.29573 4.52068 3.43238C4.36476 3.56902 4.24577 3.74274 4.17469 3.9375L0.0739113 15.2172C0.00654532 15.4032 -0.0152147 15.6026 0.0104577 15.7988C0.0361302 15.995 0.108486 16.1821 0.221451 16.3445C0.334416 16.5069 0.484694 16.6399 0.659669 16.7322C0.834645 16.8245 1.02921 16.8735 1.22704 16.875C1.37269 16.874 1.51705 16.8476 1.6536 16.7969L12.9325 12.6953C13.1273 12.6243 13.3011 12.5054 13.4378 12.3495C13.5746 12.1936 13.6698 12.0058 13.7148 11.8034C13.7598 11.601 13.7531 11.3905 13.6953 11.1914C13.6375 10.9923 13.5305 10.8109 13.3841 10.6641L6.20594 3.48672ZM5.55516 14.05L2.82079 11.3156L3.84891 8.48672L8.38407 13.0219L5.55516 14.05ZM1.25829 15.6125L2.35204 12.6117L4.26219 14.5219L1.25829 15.6125ZM9.68329 12.55L4.32079 7.1875L5.33641 4.38516L12.4794 11.5281L9.68329 12.55ZM9.99579 5C10.0075 4.57748 10.1098 4.1624 10.2958 3.78281C10.7098 2.95547 11.4911 2.5 12.4958 2.5C13.0192 2.5 13.3552 2.32109 13.5622 1.93672C13.6712 1.72168 13.7338 1.48611 13.7458 1.24531C13.7464 1.07955 13.8129 0.920828 13.9305 0.804057C14.0482 0.687287 14.2074 0.622035 14.3731 0.622656C14.5389 0.623278 14.6976 0.689722 14.8144 0.807372C14.9312 0.925022 14.9964 1.08424 14.9958 1.25C14.9958 2.25469 14.3302 3.75 12.4958 3.75C11.9723 3.75 11.6364 3.92891 11.4294 4.31328C11.3204 4.52832 11.2578 4.76389 11.2458 5.00469C11.2455 5.08676 11.229 5.16798 11.1973 5.24369C11.1656 5.3194 11.1193 5.38812 11.0611 5.44594C11.0028 5.50376 10.9337 5.54954 10.8578 5.58067C10.7819 5.61179 10.7005 5.62765 10.6184 5.62734C10.5364 5.62704 10.4552 5.61056 10.3794 5.57887C10.3037 5.54718 10.235 5.50088 10.1772 5.44263C10.1194 5.38437 10.0736 5.3153 10.0425 5.23936C10.0113 5.16341 9.99548 5.08208 9.99579 5ZM8.12079 2.5V0.625C8.12079 0.45924 8.18663 0.300268 8.30384 0.183058C8.42105 0.065848 8.58003 0 8.74579 0C8.91155 0 9.07052 0.065848 9.18773 0.183058C9.30494 0.300268 9.37079 0.45924 9.37079 0.625V2.5C9.37079 2.66576 9.30494 2.82473 9.18773 2.94194C9.07052 3.05915 8.91155 3.125 8.74579 3.125C8.58003 3.125 8.42105 3.05915 8.30384 2.94194C8.18663 2.82473 8.12079 2.66576 8.12079 2.5ZM16.063 8.93281C16.121 8.99088 16.167 9.05981 16.1984 9.13566C16.2298 9.21151 16.2459 9.2928 16.2459 9.37489C16.2458 9.45697 16.2296 9.53825 16.1982 9.61407C16.1667 9.68989 16.1207 9.75878 16.0626 9.8168C16.0045 9.87481 15.9356 9.92083 15.8597 9.95221C15.7839 9.98358 15.7026 9.99972 15.6205 9.99968C15.5384 9.99964 15.4571 9.98344 15.3813 9.95199C15.3055 9.92055 15.2366 9.87447 15.1786 9.81641L13.9286 8.56641C13.8113 8.44913 13.7454 8.29007 13.7454 8.12422C13.7454 7.95837 13.8113 7.79931 13.9286 7.68203C14.0459 7.56476 14.2049 7.49887 14.3708 7.49887C14.5366 7.49887 14.6957 7.56476 14.813 7.68203L16.063 8.93281ZM16.4434 5.59297L14.5684 6.21797C14.4112 6.27039 14.2395 6.25819 14.0913 6.18406C13.943 6.10992 13.8302 5.97992 13.7778 5.82266C13.7254 5.66539 13.7376 5.49374 13.8117 5.34547C13.8859 5.1972 14.0159 5.08445 14.1731 5.03203L16.0481 4.40703C16.2054 4.35461 16.377 4.36681 16.5253 4.44094C16.6736 4.51508 16.7863 4.64508 16.8388 4.80234C16.8912 4.95961 16.879 5.13126 16.8048 5.27953C16.7307 5.4278 16.6007 5.54055 16.4434 5.59297Z"
                  fill="#530D99"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <strong className="font-sans text-[14px] leading-5.25 font-semibold text-[#530D99]">
                {savings_banner.title}
              </strong>
              {savings_banner.description && (
                <p className="font-sans text-[12px] leading-4.5 font-normal text-[#1A1A1A]">
                  {savings_banner.description}
                </p>
              )}
              {savings_banner.coupon_code && (
                <span className="mt-1 w-fit rounded border border-[#530D99]/10 bg-[#530D99]/5 px-1.5 py-0.5 text-xs font-medium text-[#530D99]">
                  Code: {savings_banner.coupon_code}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-2 self-stretch">
          <div>
            {subtitle && <p className="font-sans text-[18px] leading-6.75 font-semibold text-[#1A1A1A]">{subtitle}</p>}
            {description && <p className="mt-1 text-xs leading-relaxed text-[#616161]">{description}</p>}
          </div>
          {productCount > 0 && (
            <span className="shrink-0 font-sans text-[12px] leading-4.5 font-bold tracking-[0.24px] text-[#999] uppercase">
              {productCount} {productCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {/* Products list wrapped in a white premium block */}
        <div className="flex flex-col gap-2">
          {products.map((product) => {
            const isFree = product.price_display?.type === 'free'
            const formattedPrice = isFree
              ? 'FREE'
              : product.price_display?.label ||
                product.price.formatted ||
                `${product.price.value} ${product.price.currency}`

            let priceValue = formattedPrice
            let priceCurrency = ''
            if (!isFree) {
              const currencyMatch = formattedPrice.match(/\s*(KWD|KD|AED|SAR|QAR|BHD|OMR|\$|£|€)\s*$/i)
              if (currencyMatch) {
                const matchedStr = currencyMatch[0]
                priceCurrency = matchedStr
                priceValue = formattedPrice.substring(0, formattedPrice.length - matchedStr.length).trim()
              }
            }

            const hasOldPrice = !!(product.old_price?.formatted || product.old_price?.value)
            const formattedOldPrice =
              product.price_display?.old_label ||
              product.old_price?.formatted ||
              (product.old_price ? `${product.old_price.value} ${product.old_price.currency}` : '')

            let oldPriceValue = formattedOldPrice
            let oldPriceCurrency = ''
            if (hasOldPrice) {
              const currencyMatch = formattedOldPrice.match(/\s*(KWD|KD|AED|SAR|QAR|BHD|OMR|\$|£|€)\s*$/i)
              if (currencyMatch) {
                const matchedStr = currencyMatch[0]
                oldPriceCurrency = matchedStr
                oldPriceValue = formattedOldPrice.substring(0, formattedOldPrice.length - matchedStr.length).trim()
              }
            }
            const isOutOfStock =
              product.availability?.toLowerCase() === 'out_of_stock' ||
              product.availability?.toLowerCase() === 'out of stock'

            return (
              <div
                key={product.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E4E1] bg-[#FFF] px-2 py-3 transition-colors hover:bg-slate-50/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {product.image?.url ? (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-[0.5px] border-solid border-(--Strokes-Primary,#E5E4E1) bg-[#FCEFE8]">
                      <img src={product.image.url} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-[0.5px] border-solid border-(--Strokes-Primary,#E5E4E1) bg-[#FCEFE8] text-xs text-gray-400">
                      N/A
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {product.brand && (
                      <span className="truncate font-sans text-[14px] leading-5.25 font-semibold text-[#1A1A1A]">
                        {product.brand}
                      </span>
                    )}
                    <p
                      className="truncate font-sans text-[12px] leading-4.5 font-normal text-[#616161]"
                      title={product.name}
                    >
                      {product.name}
                    </p>
                    {product.specs && (
                      <span className="mt-0.5 truncate text-[11px] text-[#999999]">{product.specs}</span>
                    )}
                    {product.quantity && product.quantity > 1 && (
                      <span className="text-[11px] text-[#999999]">Qty: {product.quantity}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 pl-2">
                  {isFree ? (
                    <span className="font-sans text-[12px] leading-4.5 font-bold tracking-[0.24px] text-[#197F4C] uppercase">
                      FREE
                    </span>
                  ) : priceCurrency ? (
                    <span className="flex items-baseline gap-1">
                      <span className="font-sans text-[14px] leading-5.25 font-semibold text-[#1A1A1A]">
                        {priceValue}
                      </span>
                      <span className="font-sans text-[12px] leading-4.5 font-normal text-[#757575]">
                        {priceCurrency}
                      </span>
                    </span>
                  ) : (
                    <span className="font-sans text-[14px] leading-5.25 font-semibold text-[#1A1A1A]">
                      {formattedPrice}
                    </span>
                  )}

                  {hasOldPrice &&
                    (oldPriceCurrency ? (
                      <span className="flex items-baseline gap-0.5">
                        <span className="font-sans text-[14px] leading-[18.2px] font-normal text-[#757575] line-through">
                          {oldPriceValue}
                        </span>
                        <span className="font-sans text-[12px] leading-4.5 font-normal text-[#757575] line-through">
                          {oldPriceCurrency}
                        </span>
                      </span>
                    ) : (
                      <span className="font-sans text-[14px] leading-[18.2px] font-normal text-[#757575] line-through">
                        {formattedOldPrice}
                      </span>
                    ))}
                  {isOutOfStock ? (
                    <span className="mt-0.5 rounded-full bg-[#F2EEE6] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#474747] uppercase">
                      out of stock
                    </span>
                  ) : product.availability ? (
                    <span className="text-[11px] font-medium text-emerald-600">{product.availability}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary Rows */}
        {summary_rows && summary_rows.length > 0 && (
          <div className="flex flex-col gap-2 px-1 text-xs">
            {summary_rows.map((row, idx) => {
              const formattedVal = row.value.formatted
              let valStr = formattedVal
              let curStr = ''
              const currencyMatch = formattedVal.match(/\s*(KWD|KD|AED|SAR|QAR|BHD|OMR|\$|£|€)\s*$/i)
              if (currencyMatch) {
                const matchedStr = currencyMatch[0]
                curStr = matchedStr
                valStr = formattedVal.substring(0, formattedVal.length - matchedStr.length).trim()
              }

              return (
                <div key={row.id || idx} className="flex items-center justify-between">
                  <span className="font-sans text-[14px] leading-[18.2px] font-normal text-[#616161]">{row.label}</span>
                  {curStr ? (
                    <span className="flex items-baseline gap-1">
                      <span className="font-sans text-[14px] leading-5.25 font-semibold text-[#1A1A1A]">{valStr}</span>
                      <span className="font-sans text-[12px] leading-4.5 font-normal text-[#757575]">{curStr}</span>
                    </span>
                  ) : (
                    <span className="font-sans text-[14px] leading-5.25 font-semibold text-[#1A1A1A]">
                      {formattedVal}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Total Bundle Price */}
        {collection_total && (
          <div className="mt-1 flex items-center justify-between border-t border-[#E5E4E1] px-1 pt-3">
            <span className="font-sans text-[16px] leading-6 font-normal text-[#616161]">
              {collection_total.label || 'Total Bundle Price'}
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-base font-bold text-[#1A1A1A]">
                {collection_total.formatted
                  ? collection_total.formatted.replace(/\s*KWD/i, '')
                  : collection_total.value}
              </span>
              <span className="text-xs font-normal text-[#757575]">
                {collection_total.currency || (collection_total.formatted?.includes('KWD') ? ' KWD' : '')}
              </span>
            </div>
          </div>
        )}

        {/* Main CTA Action */}
        {actions &&
          actions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loadingAction}
              onClick={() => handleAction(action)}
              className="mt-2 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-3 py-2 font-sans text-[14px] leading-[18.2px] font-normal text-white transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {loadingAction ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <ShoppingCart className="h-4 w-4 stroke-2" />
              )}
              <span>{action.label || 'Add Collection to Cart'}</span>
            </button>
          ))}
      </section>
    </div>
  )
}
