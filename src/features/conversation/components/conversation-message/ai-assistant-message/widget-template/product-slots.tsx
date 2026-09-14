import { Spinner } from '@/components/ui/spinner'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { ProductSlotAction, ProductSlotItem, ProductSlotsTemplate } from '@/features/conversation/types/message'
import { ChevronDown, ChevronUp, ImageOff, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ProductSlotsProps {
  template: ProductSlotsTemplate
  sourceMessageUlid: string
}

export function ProductSlots({ template, sourceMessageUlid }: ProductSlotsProps) {
  const { content, config } = template
  const { slots = [], intro_text, description_text, closing_text } = content
  const slotConfig = config?.slot

  const [expandedSlotIds, setExpandedSlotIds] = useState<Record<string, boolean>>({})
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({})

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()

  const toggleSlotExpand = (slotId: string) => {
    setExpandedSlotIds((prev) => ({
      ...prev,
      [slotId]: !prev[slotId],
    }))
  }

  const handleAction = async (action: ProductSlotAction, productName?: string) => {
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
        toast.success(action.label ? `${action.label}: ${productName || 'Added product'}` : 'Product added')
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

  const renderTimingBadge = (timing: string) => {
    const isAM = timing.toUpperCase() === 'AM'
    return (
      <span
        key={timing}
        className={`inline-flex h-5 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[150%] font-bold tracking-[0.2px] uppercase ${
          isAM ? 'bg-[#F2E7CE] text-[#995B00]' : 'bg-[#CEE6F2] text-[#195D7F]'
        }`}
      >
        {isAM ? <Sun className="h-3 w-3 text-[#995B00]" /> : <Moon className="h-3 w-3 text-[#195D7F]" />}
        <span>{timing}</span>
      </span>
    )
  }

  const renderSlot = (slot: ProductSlotItem) => {
    const isExpanded = !!expandedSlotIds[slot.id]
    const recommended = slot.recommended_product
    const hasRecommendation = !!recommended
    const recommendedAction = recommended?.actions?.[0]
    const isActionLoading = recommendedAction
      ? loadingActionId === (recommendedAction.id || recommendedAction.action_ulid || recommendedAction.type)
      : false
    const hasImageError = recommended?.id ? imageErrorMap[recommended.id] : false
    const hasExpandableContent =
      (slotConfig?.show_goal !== false && !!slot.goal) || (slotConfig?.show_how_to_use !== false && !!slot.how_to_use)

    return (
      <div key={slot.id} className="flex flex-col shadow-xs transition-all duration-200">
        {/* Step Header: Order (left) & Timing Badges (right with space between) */}
        <div className="flex items-center justify-between gap-2">
          {slotConfig?.show_order !== false && slot.order !== undefined && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1F1F1F] text-[12px] font-bold text-white">
              {slot.order}
            </span>
          )}

          {slotConfig?.timing_badges?.enabled !== false && slot.when_to_use && slot.when_to_use.length > 0 && (
            <div className="flex items-center gap-1.5">
              {slot.when_to_use.map((timing) => renderTimingBadge(timing))}
            </div>
          )}
        </div>

        {/* Category Tag Row (Separate Row) */}
        {slotConfig?.show_category !== false && slot.category && (
          <div className="mt-2">
            <span className="text-[10px] leading-[150%] font-bold tracking-[0.2px] text-[#999999] uppercase">
              {slot.category}
            </span>
          </div>
        )}

        {/* Slot Title & Primary Description */}
        <div className={slotConfig?.show_category !== false && slot.category ? 'mt-1' : 'mt-2.5'}>
          <h4 className="text-[18px] leading-[150%] font-semibold text-[#1A1A1A]">{slot.title}</h4>
          {slotConfig?.show_description !== false && slot.description && (
            <p className="mt-1 text-[12px] leading-[150%] font-normal text-[#1A1A1A]">{slot.description}</p>
          )}
        </div>

        {/* Expanded Info (Goal, How to Use, etc.) - Hidden when collapsed */}
        {isExpanded && (
          <div className="animate-in fade-in mt-3 flex flex-col gap-2.5 duration-200">
            {slotConfig?.show_goal !== false && slot.goal && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] leading-[150%] font-semibold text-[#9A7742]">Goal:</span>
                <p className="text-[12px] leading-[150%] font-normal text-[#1A1A1A]">{slot.goal}</p>
              </div>
            )}

            {slotConfig?.show_how_to_use !== false && slot.how_to_use && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] leading-[150%] font-semibold text-[#9A7742]">How to use:</span>
                <p className="text-[12px] leading-[150%] font-normal text-[#1A1A1A]">{slot.how_to_use}</p>
              </div>
            )}
          </div>
        )}

        {/* See More / See Less Toggle Button */}
        {hasExpandableContent && (
          <button
            type="button"
            onClick={() => toggleSlotExpand(slot.id)}
            className="mt-2 flex w-fit cursor-pointer items-center gap-1 text-[14px] leading-[130%] font-normal text-[#0D4DA4] underline transition-opacity hover:opacity-80"
          >
            <span>{isExpanded ? 'See Less' : 'See More'}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-[#0D4DA4]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#0D4DA4]" />
            )}
          </button>
        )}

        {/* Recommended Product Sub-Card */}
        {hasRecommendation && (
          <div className="mt-3.5 flex flex-col gap-1.5">
            {slotConfig?.recommended_product?.show_label !== false && (
              <div className="text-[11px] font-bold tracking-wider text-[#8A8A88] uppercase">
                {slotConfig?.recommended_product?.label || 'Recommended Product'}
              </div>
            )}

            <div className="flex min-h-27 w-full items-stretch overflow-hidden rounded-lg border border-[#E5E4E1] bg-white select-none">
              {/* Product Image on Left */}
              <div className="relative h-27 w-23 shrink-0 overflow-hidden border-r border-[#E5E4E1] bg-gray-50">
                {recommended.image && !hasImageError ? (
                  <img
                    src={recommended.image}
                    alt={recommended.name}
                    loading="lazy"
                    onError={() => handleImageError(recommended.id)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
                    <ImageOff className="h-6 w-6 text-[#A3A3A3]" />
                  </div>
                )}
              </div>

              {/* Product Details on Right */}
              <div className="flex min-w-0 flex-1 flex-col justify-between p-2">
                {/* Top block: Brand and Name */}
                <div className="flex flex-col gap-0.5">
                  {slotConfig?.recommended_product?.show_brand !== false && recommended.brand && (
                    <h5 className="truncate text-[12px] leading-[150%] font-semibold text-[#1A1A1A]">
                      {recommended.brand}
                    </h5>
                  )}
                  {slotConfig?.recommended_product?.show_name !== false && (
                    <p
                      className="truncate text-[12px] leading-normal font-normal text-[#616161]"
                      title={recommended.name}
                    >
                      {recommended.name}
                    </p>
                  )}
                </div>

                {/* Bottom row: Price & Action */}
                <div className="flex items-end justify-between gap-2 pt-1">
                  {/* Price section */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex h-4 items-center gap-1.5">
                      {formatOldPrice(recommended.price) ? (
                        <>
                          <span className="text-[12px] leading-[150%] font-normal text-[#757575] line-through">
                            {formatOldPrice(recommended.price)}
                          </span>
                          {(recommended.discount?.percentage ||
                            (recommended.price.old && recommended.price.old > recommended.price.current)) && (
                            <span className="flex items-center justify-center gap-2 rounded bg-[#FFEBEB] px-1 py-px text-[10px] leading-[150%] font-bold tracking-[0.2px] text-[#F55252] uppercase">
                              {recommended.discount?.percentage ??
                                Math.round(
                                  ((recommended.price.old! - recommended.price.current) / recommended.price.old!) * 100,
                                )}
                              % OFF
                            </span>
                          )}
                        </>
                      ) : null}
                    </div>
                    <span className="text-[14px] leading-[150%] font-semibold text-[#1A1A1A]">
                      {formatPrice(recommended.price)}
                    </span>
                  </div>

                  {/* Action Button */}
                  {recommendedAction && (
                    <button
                      type="button"
                      onClick={() => handleAction(recommendedAction, recommended.name)}
                      disabled={isActionLoading}
                      className="flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#E5E4E1] bg-[#F2F1ED] p-3 text-[14px] leading-[130%] font-normal text-[#1A1A1A] transition-colors hover:bg-[#EAE8E3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActionLoading ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <span>{recommendedAction.label || 'Add'}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-full min-w-0 font-sans">
      {/* Intro Text */}
      {intro_text && <p className="mb-2 text-[14px] leading-relaxed text-[#4A4A48]">{intro_text}</p>}

      {/* Slots List Container */}
      <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-[#E5E4E1] bg-[#FAF9F6] p-3.5 sm:p-4">
        {slots.length > 0 ? (
          slots.map((slot) => renderSlot(slot))
        ) : (
          <p className="text-center text-[13px] text-[#8A8A88]">No recommendation slots available</p>
        )}

        {/* Description Text */}
        {description_text && (
          <p className="border-t border-[#EAE9E5] pt-1 text-[12px] leading-normal text-[#737371]">{description_text}</p>
        )}
      </div>

      {/* Closing Text */}
      {closing_text && <p className="mt-2 text-[14px] leading-relaxed text-[#4A4A48]">{closing_text}</p>}
    </div>
  )
}
