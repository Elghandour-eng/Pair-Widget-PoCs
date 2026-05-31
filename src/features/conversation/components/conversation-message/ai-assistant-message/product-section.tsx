import type { ProductCardSet } from '@/features/conversation/types/message'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronRight, Heart, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ProductSectionProps {
  productSet: ProductCardSet
}

const getDiscountPercentage = (oldPriceStr?: string, currentPriceStr?: string) => {
  if (!oldPriceStr || !currentPriceStr) return null
  const oldVal = parseFloat(oldPriceStr.replace(/[^0-9.]/g, ''))
  const currVal = parseFloat(currentPriceStr.replace(/[^0-9.]/g, ''))
  if (oldVal > 0 && currVal > 0 && oldVal > currVal) {
    return Math.round(((oldVal - currVal) / oldVal) * 100)
  }
  return null
}

export function ProductSection({ productSet }: ProductSectionProps) {
  const title = productSet.header?.title || 'Recommended Products'
  const hasViewAll = !!productSet.view_all
  const viewAllText = productSet.header?.action_text || 'View all'
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})

  // Initialize Embla Carousel
  const [emblaRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
  })

  const handleAddToCart = (productId: string, quantity: number, productTitle: string) => {
    console.log('Adding to cart:', { productId, quantity })
    toast.success(`Added ${productTitle} to cart!`)
  }

  const toggleFavorite = (productId: string, productTitle: string) => {
    const isFav = !favorites[productId]
    setFavorites((prev) => ({ ...prev, [productId]: isFav }))
    if (isFav) {
      toast.success(`Added ${productTitle} to wishlist!`)
    } else {
      toast.success(`Removed ${productTitle} from wishlist!`)
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 self-stretch">
      {/* Header Container */}
      <div className="flex items-end justify-between gap-4 self-stretch">
        <h4 className="text-[16px] leading-[150%] font-semibold text-[#1A1A1A]">{title}</h4>
        {hasViewAll && (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 text-[14px] leading-[130%] font-normal text-[#0D4DA4] hover:underline focus:outline-none"
          >
            <span>{viewAllText}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Embla Carousel viewport */}
      <div className="w-full cursor-grab overflow-hidden active:cursor-grabbing" ref={emblaRef}>
        <div className="flex gap-3.5">
          {productSet.cards.map((card, idx) => {
            const mainButton = card.buttons?.[0]
            const productId = (mainButton?.parameters?.product_id as string) || `product-${idx}`
            const isFavorite = !!favorites[productId]
            const discountPercent = getDiscountPercentage(card.old_price, card.current_price)

            return (
              <div key={idx} className="flex w-36.25 shrink-0 flex-col items-start justify-end gap-3 select-none">
                {/* Product Image */}
                <div className="relative h-39.75 w-full overflow-hidden rounded-xl border border-[#E5E4E1] bg-gray-50">
                  {card.image_url ? (
                    <img src={card.image_url} alt={card.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
                      <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
                    </div>
                  )}
                </div>

                {/* Details layout container */}
                <div className="flex w-full flex-col gap-3">
                  {/* Title & Subtitle block */}
                  <div className="flex w-full flex-col gap-1">
                    <h5 className="line-clamp-1 w-full text-[14px] leading-[150%] font-semibold text-[#1A1A1A]">
                      {card.title}
                    </h5>
                    <p className="line-clamp-2 min-h-9 w-full text-[14px] leading-[130%] font-normal text-[#757575]">
                      {card.sub_text || <>&nbsp;</>}
                    </p>
                  </div>

                  {/* Prices & Discount block */}
                  <div className="flex w-full flex-col gap-1">
                    {/* Before discount and discount percent badge row */}
                    <div className="flex h-4 w-full items-center gap-2">
                      {card.old_price ? (
                        <>
                          <span className="text-[12px] leading-[150%] font-normal text-[#616161] line-through">
                            {card.old_price}
                          </span>
                          {discountPercent !== null && (
                            <div className="flex h-4 items-center justify-center gap-2 rounded-lg bg-[#FFEBEB] px-1 py-0 text-[10px] font-bold text-[#FF4D4D]">
                              {discountPercent}% OFF
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-[12px] leading-[150%] font-normal text-transparent select-none">
                          &nbsp;
                        </span>
                      )}
                    </div>
                    {/* Current Price */}
                    <span className="text-[16px] leading-[150%] font-semibold text-[#1A1A1A]">
                      {card.current_price}
                    </span>
                  </div>

                  {/* Buttons / Actions row */}
                  <div className="flex h-9 w-full items-center gap-2.5">
                    {mainButton ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleAddToCart(productId, (mainButton.parameters?.quantity as number) || 1, card.title)
                        }
                        className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#E5E4E1] bg-[#F2F1ED] px-3 transition-colors hover:bg-[#EAE8E3] active:scale-[0.98]"
                      >
                        <span className="text-[14px] leading-[130%] font-normal text-[#1A1A1A]">
                          {mainButton.label || 'Add to Cart'}
                        </span>
                      </button>
                    ) : (
                      <div className="h-9 flex-1" />
                    )}

                    {/* Favorite Icon */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(productId, card.title)}
                      className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center focus:outline-none"
                      aria-label="Add to wishlist"
                    >
                      <Heart
                        className="h-full w-full transition-colors duration-200"
                        style={{
                          fill: isFavorite ? '#EF4444' : 'none',
                          color: isFavorite ? '#EF4444' : '#CAC8C6',
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
