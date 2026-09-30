import { Spinner } from '@/components/ui/spinner'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type {
  ProductCarouselItem,
  ProductCarouselItemAction,
  ProductsCarouselTemplate,
} from '@/features/conversation/types/message'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronRight, Flame, Gift, Heart, ShoppingBag, Sparkles, Star, Tag, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface ProductsCarouselProps {
  template: ProductsCarouselTemplate
  sourceMessageUlid: string
}

export function ProductsCarousel({ template, sourceMessageUlid }: ProductsCarouselProps) {
  const { content, config } = template
  const { header, products = [], intro_text, description_text, closing_text } = content

  const isMultiProduct = products.length > 1
  const isScrollable = config?.carousel?.scrollable ?? (config?.layout?.scroll_type === 'horizontal' && isMultiProduct)
  const carouselProducts = isMultiProduct ? products.slice(0, 3) : products

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  })
  const [scrollProgress, setScrollProgress] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({})

  const scrollbarTrackRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()

  const toggleFavorite = (productId: string, productTitle: string) => {
    const isFav = !favorites[productId]
    setFavorites((prev) => ({ ...prev, [productId]: isFav }))
    if (isFav) {
      toast.success(`Added ${productTitle} to wishlist!`)
    } else {
      toast.success(`Removed ${productTitle} from wishlist!`)
    }
  }

  const onScroll = useCallback(() => {
    if (!emblaApi) return
    const progress = Math.max(0, Math.min(1, emblaApi.scrollProgress()))
    setScrollProgress(progress)
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onScroll()
    emblaApi.on('scroll', onScroll)
    emblaApi.on('reInit', onScroll)
    return () => {
      emblaApi.off('scroll', onScroll)
      emblaApi.off('reInit', onScroll)
    }
  }, [emblaApi, onScroll])

  const handleScrollbarMove = (clientX: number) => {
    if (!emblaApi || !scrollbarTrackRef.current) return
    const rect = scrollbarTrackRef.current.getBoundingClientRect()
    if (rect.width <= 0) return
    const rawProgress = (clientX - rect.left) / rect.width
    const progress = Math.max(0, Math.min(1, rawProgress))
    const snapList = emblaApi.scrollSnapList()
    if (snapList.length > 0) {
      const targetIndex = Math.round(progress * (snapList.length - 1))
      emblaApi.scrollTo(targetIndex)
    }
  }

  const handleScrollbarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!emblaApi || !scrollbarTrackRef.current) return
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    handleScrollbarMove(e.clientX)
  }

  const handleScrollbarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    handleScrollbarMove(e.clientX)
  }

  const handleScrollbarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore
    }
  }

  const handleAction = async (action: ProductCarouselItemAction, productName?: string) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }
    const actionKey = action.id || action.action_ulid || action.type || 'action'
    setLoadingActionId(actionKey)

    try {
      const res = await dispatchActionMutation({
        conversationId,
        actionUlid: action.id || action.action_ulid || '',
        sourceMessageUlid,
        parameters: action.payload || {},
      })
      if (res.success) {
        toast.success(action.label ? `${action.label}: ${productName || 'Success'}` : 'Action completed')
      } else {
        toast.error(res.error_message || 'Action failed')
      }
    } catch {
      toast.error('Failed to execute action')
    } finally {
      setLoadingActionId(null)
    }
  }

  const handleImageError = (productId: string) => {
    setImageErrorMap((prev) => ({ ...prev, [productId]: true }))
  }

  const formatPrice = (price?: { current: number; currency: string; old?: number }) => {
    if (!price) return null
    return `${price.current} ${price.currency}`
  }

  const formatOldPrice = (price?: { current: number; currency: string; old?: number }) => {
    if (!price || price.old === undefined || price.old <= price.current) return null
    return `${price.old} ${price.currency}`
  }

  const renderHeaderIcon = (icon?: string) => {
    if (!icon) {
      return <Sparkles className="h-4 w-4 fill-amber-400 text-amber-500" />
    }

    if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/') || icon.startsWith('data:')) {
      return <img src={icon} alt="" className="h-4 w-4 object-contain" />
    }

    const normalized = icon.toLowerCase().trim().replace(/[-_]/g, '')

    switch (normalized) {
      case 'sparkles':
      case 'sparkle':
        return <Sparkles className="h-4 w-4 fill-amber-400 text-amber-500" />
      case 'star':
        return <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
      case 'flame':
      case 'fire':
        return <Flame className="h-4 w-4 fill-orange-400 text-orange-500" />
      case 'heart':
        return <Heart className="h-4 w-4 fill-rose-400 text-rose-500" />
      case 'shoppingbag':
      case 'bag':
        return <ShoppingBag className="h-4 w-4 text-[#1F1F1F]" />
      case 'gift':
        return <Gift className="h-4 w-4 text-purple-500" />
      case 'tag':
      case 'badge':
        return <Tag className="h-4 w-4 text-blue-500" />
      case 'zap':
      case 'lightning':
        return <Zap className="h-4 w-4 fill-yellow-400 text-yellow-500" />
      default:
        if (icon.length <= 4) {
          return <span className="text-sm leading-none">{icon}</span>
        }
        return <Sparkles className="h-4 w-4 fill-amber-400 text-amber-500" />
    }
  }

  const renderProductCard = (product: ProductCarouselItem, isCarouselItem = false, isGridItem = false) => {
    const isOutOfStock = product.availability === 'out_of_stock'
    const isWishlistAction = (type?: string) =>
      !!type &&
      ['favorite', 'wishlist', 'add_to_wishlist', 'remove_from_wishlist', 'toggle_wishlist', 'like'].includes(
        type.toLowerCase(),
      )

    const primaryAction = product.actions?.find((a) => !isWishlistAction(a.type))
    const wishlistAction = product.actions?.find((a) => isWishlistAction(a.type))

    const isPrimaryActionLoading = primaryAction
      ? loadingActionId === (primaryAction.id || primaryAction.action_ulid || primaryAction.type)
      : false
    const isWishlistActionLoading = wishlistAction
      ? loadingActionId === (wishlistAction.id || wishlistAction.action_ulid || wishlistAction.type)
      : false
    const hasImageError = imageErrorMap[product.id]
    const discountPercent =
      product.discount?.percentage ??
      (product.price.old && product.price.old > product.price.current
        ? Math.round(((product.price.old - product.price.current) / product.price.old) * 100)
        : null)

    return (
      <div
        key={product.id}
        className={`flex flex-col items-start justify-end gap-3 select-none ${
          isGridItem ? 'w-full' : isCarouselItem ? 'w-36.25 shrink-0' : 'w-full max-w-xs'
        }`}
      >
        {/* Product Image */}
        <div className="relative h-39.75 w-full overflow-hidden rounded-xl border border-[#E5E4E1] bg-gray-50">
          {product.image && !hasImageError ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              onError={() => handleImageError(product.id)}
              className={`h-full w-full object-cover ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
              <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
            </div>
          )}

          {isOutOfStock && (
            <span className="absolute right-2 bottom-2 rounded-md bg-[#1F1F1F]/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
              Out of Stock
            </span>
          )}
        </div>

        {/* Details layout container */}
        <div className="flex w-full flex-col gap-3">
          {/* Title & Subtitle block */}
          <div className="flex w-full flex-col gap-1">
            <h5 className="line-clamp-1 w-full text-[14px] leading-[150%] font-semibold text-[#1A1A1A]">
              {product.brand || product.name}
            </h5>
            <p className="line-clamp-2 min-h-9 w-full text-[14px] leading-[130%] font-normal text-[#757575]">
              {product.name}
            </p>
          </div>

          {/* Prices & Discount block */}
          <div className="flex w-full flex-col gap-1">
            {/* Before discount and discount percent badge row */}
            <div className="flex h-4 w-full items-center gap-2">
              {formatOldPrice(product.price) ? (
                <>
                  <span className="text-[12px] leading-[150%] font-normal text-[#616161] line-through">
                    {formatOldPrice(product.price)}
                  </span>
                  {discountPercent !== null && (
                    <div className="flex h-4 items-center justify-center gap-2 rounded-lg bg-[#FFEBEB] px-1 py-0 text-[10px] font-bold text-[#FF4D4D]">
                      {discountPercent}% OFF
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[12px] leading-[150%] font-normal text-transparent select-none">&nbsp;</span>
              )}
            </div>
            {/* Current Price */}
            <span className="text-[16px] leading-[150%] font-semibold text-[#1A1A1A]">
              {formatPrice(product.price)}
            </span>
          </div>

          {/* Buttons / Actions row */}
          {(primaryAction || wishlistAction) && (
            <div className="flex h-9 w-full items-center gap-2.5">
              {primaryAction && (
                <button
                  type="button"
                  disabled={isOutOfStock || isPrimaryActionLoading}
                  onClick={() => handleAction(primaryAction, product.name)}
                  className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#E5E4E1] bg-[#F2F1ED] px-3 transition-colors hover:bg-[#EAE8E3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPrimaryActionLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <span className="text-[14px] leading-[130%] font-normal text-[#1A1A1A]">
                      {primaryAction.label || 'Add to Cart'}
                    </span>
                  )}
                </button>
              )}

              {/* Favorite / Wishlist Action Button */}
              {wishlistAction && (
                <button
                  type="button"
                  disabled={isWishlistActionLoading}
                  onClick={() => {
                    toggleFavorite(product.id, product.name)
                    handleAction(wishlistAction, product.name)
                  }}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center focus:outline-none disabled:opacity-50"
                  aria-label={wishlistAction.label || 'Add to wishlist'}
                >
                  {isWishlistActionLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Heart
                      className="h-full w-full transition-colors duration-200"
                      style={{
                        fill: favorites[product.id] ? '#EF4444' : 'none',
                        color: favorites[product.id] ? '#EF4444' : '#CAC8C6',
                      }}
                    />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderHorizontalProductCard = (product: ProductCarouselItem) => {
    const isOutOfStock = product.availability === 'out_of_stock'
    const isWishlistAction = (type?: string) =>
      !!type &&
      ['favorite', 'wishlist', 'add_to_wishlist', 'remove_from_wishlist', 'toggle_wishlist', 'like'].includes(
        type.toLowerCase(),
      )

    const primaryAction = product.actions?.find((a) => !isWishlistAction(a.type))
    const wishlistAction = product.actions?.find((a) => isWishlistAction(a.type))

    const isPrimaryActionLoading = primaryAction
      ? loadingActionId === (primaryAction.id || primaryAction.action_ulid || primaryAction.type)
      : false
    const isWishlistActionLoading = wishlistAction
      ? loadingActionId === (wishlistAction.id || wishlistAction.action_ulid || wishlistAction.type)
      : false
    const hasImageError = imageErrorMap[product.id]
    const discountPercent =
      product.discount?.percentage ??
      (product.price.old && product.price.old > product.price.current
        ? Math.round(((product.price.old - product.price.current) / product.price.old) * 100)
        : null)

    return (
      <div
        key={product.id}
        className="flex min-h-27 w-full items-stretch overflow-hidden rounded-lg border border-[#E5E4E1] bg-white select-none"
      >
        {/* Product Image on Left (92px width, full height) */}
        <div className="relative h-27 w-23 shrink-0 overflow-hidden border-r border-[#E5E4E1] bg-gray-50">
          {product.image && !hasImageError ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              onError={() => handleImageError(product.id)}
              className={`h-full w-full object-cover ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
              <ShoppingBag className="h-8 w-8 stroke-[1.5]" />
            </div>
          )}

          {isOutOfStock && (
            <span className="absolute right-1 bottom-1 rounded bg-[#1F1F1F]/80 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
              Out of Stock
            </span>
          )}
        </div>

        {/* Product Details on Right */}
        <div className="flex min-w-0 flex-1 flex-col justify-between p-2">
          {/* Top block: Brand and Name */}
          <div className="flex flex-col gap-0.5">
            <h5 className="truncate text-[12px] leading-[150%] font-semibold text-[#1A1A1A]">
              {product.brand || product.name}
            </h5>
            <p className="truncate text-[12px] leading-normal font-normal text-[#616161]" title={product.name}>
              {product.name}
            </p>
          </div>

          {/* Bottom row: Price & Action */}
          <div className="flex items-end justify-between gap-2 pt-1">
            {/* Price section */}
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex h-4 items-center gap-1.5">
                {formatOldPrice(product.price) ? (
                  <>
                    <span className="text-[12px] leading-[150%] font-normal text-[#757575] line-through">
                      {formatOldPrice(product.price)}
                    </span>
                    {discountPercent !== null && (
                      <span className="flex items-center justify-center gap-2 rounded bg-[#FFEBEB] px-1 py-px text-[10px] leading-[150%] font-bold tracking-[0.2px] text-[#F55252] uppercase">
                        {discountPercent}% OFF
                      </span>
                    )}
                  </>
                ) : null}
              </div>
              <span className="text-[14px] leading-[150%] font-semibold text-[#1A1A1A]">
                {formatPrice(product.price)}
              </span>
            </div>

            {/* Action button(s) */}
            {(primaryAction || wishlistAction) && (
              <div className="flex shrink-0 items-center gap-2">
                {primaryAction && (
                  <button
                    type="button"
                    disabled={isOutOfStock || isPrimaryActionLoading}
                    onClick={() => handleAction(primaryAction, product.name)}
                    className="flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#E5E4E1] bg-[#F2F1ED] p-3 text-[14px] leading-[130%] font-normal text-[#1A1A1A] transition-colors hover:bg-[#EAE8E3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPrimaryActionLoading ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <span>{primaryAction.label || 'Add to Cart'}</span>
                    )}
                  </button>
                )}

                {wishlistAction && (
                  <button
                    type="button"
                    disabled={isWishlistActionLoading}
                    onClick={() => {
                      toggleFavorite(product.id, product.name)
                      handleAction(wishlistAction, product.name)
                    }}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center focus:outline-none disabled:opacity-50"
                    aria-label={wishlistAction.label || 'Add to wishlist'}
                  >
                    {isWishlistActionLoading ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Heart
                        className="h-full w-full transition-colors duration-200"
                        style={{
                          fill: favorites[product.id] ? '#EF4444' : 'none',
                          color: favorites[product.id] ? '#EF4444' : '#CAC8C6',
                        }}
                      />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full min-w-0 font-sans">
      {/* Intro Text */}
      {intro_text && <p className="mb-3 text-[14px] leading-relaxed text-[#4A4A48]">{intro_text}</p>}

      {/* Widget Container */}
      <div className="flex w-full min-w-0 flex-col gap-2">
        {/* Header with Title and View All */}
        {header && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#1F1F1F]">
                {renderHeaderIcon(header.icon)}
              </div>
              <h3 className="truncate text-[18px] leading-[150%] font-semibold tracking-normal text-[#1F1F1F]">
                {header.title}
              </h3>
            </div>

            {header.view_all?.visible && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="group flex shrink-0 cursor-pointer items-center gap-1 text-[14px] leading-[130%] font-normal text-[#0D4DA4] transition-opacity hover:opacity-80"
              >
                <span>{header.view_all.label || 'View All'}</span>
                <ChevronRight className="h-4 w-4 text-[#0D4DA4] transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        )}

        {/* Content Body: Carousel vs Single Card */}
        {isScrollable && isMultiProduct ? (
          <div className="relative -mx-4 w-[calc(100%+2rem)] min-w-0">
            <div className="w-full cursor-grab overflow-hidden px-4 active:cursor-grabbing" ref={emblaRef}>
              <div className="flex gap-3 py-1">
                {carouselProducts.map((product) => (
                  <div key={product.id} className="flex shrink-0">
                    {renderProductCard(product, true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll Bar Progress Indicator (Interactive) */}
            {isScrollable && carouselProducts.length > 1 && (
              <div
                className="mx-auto mt-3 flex h-4 w-full max-w-86.25 cursor-pointer touch-none items-center px-4 select-none"
                onPointerDown={handleScrollbarPointerDown}
                onPointerMove={handleScrollbarPointerMove}
                onPointerUp={handleScrollbarPointerUp}
                onPointerCancel={handleScrollbarPointerUp}
              >
                <div ref={scrollbarTrackRef} className="relative h-0.5 w-full rounded-full bg-[#F0F0F0]">
                  {/* Active Thumb Indicator (5px) */}
                  <div
                    className="absolute top-1/2 h-1.25 w-[47.5%] -translate-y-1/2 rounded-full bg-[#E5E4E1] transition-transform duration-75 ease-out hover:bg-[#D4D3CF]"
                    style={{
                      left: `${scrollProgress * 52.5}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex w-full justify-center">
            {products.length > 0 ? (
              renderHorizontalProductCard(products[0])
            ) : (
              <p className="text-center text-[13px] text-[#8A8A88]">No products available</p>
            )}
          </div>
        )}

        {/* Description Text */}
        {description_text && <p className="pt-1 text-[12px] leading-normal text-[#737371]">{description_text}</p>}
      </div>

      {/* Closing Text */}
      {closing_text && <p className="mt-2 text-[14px] leading-relaxed text-[#4A4A48]">{closing_text}</p>}

      {/* Full-screen / Mobile Bottom Drawer for View All */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="animate-in fade-in absolute inset-0 bg-black/50 backdrop-blur-xs duration-200"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="animate-in slide-in-from-bottom relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl duration-250">
            {/* Sticky Header */}
            <div className="flex items-center justify-between border-b border-[#F0F0EE] px-5 py-6">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="truncate text-[18px] leading-[150%] font-semibold tracking-normal text-[#1F1F1F]">
                    {header?.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#1F1F1F] transition-colors hover:bg-[#F2F1ED] hover:text-[#757575]"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="my-2 px-5 text-[12px] text-[#757575]">Showing all {products.length} items</p>

            {/* Scrollable Products 2-Column Grid in Drawer */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 pb-4">
                {products.map((product) => renderProductCard(product, false, true))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
