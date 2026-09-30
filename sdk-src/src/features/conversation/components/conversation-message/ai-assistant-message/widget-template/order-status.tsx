import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { OrderStatusTemplate } from '@/features/conversation/types/message'
import { ArrowUpRight, Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface OrderStatusProps {
  template: OrderStatusTemplate
  sourceMessageUlid: string
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function StatusBadge({ label, value }: { label: string; value?: string }) {
  const isCancelled = value === 'cancelled' || label.toLowerCase().includes('cancel')
  const isConfirmed = value === 'confirmed' || label.toLowerCase().includes('confirm')
  const isDelivered = value === 'delivered' || label.toLowerCase().includes('deliver')
  const isShipped = value === 'shipped' || label.toLowerCase().includes('ship')

  let colorClasses = 'bg-[#F0F0F0] text-[#555555]'
  if (isCancelled) colorClasses = 'bg-[#FFE4E4] text-[#C0392B]'
  else if (isDelivered) colorClasses = 'bg-[#E4F5E4] text-[#1E7E34]'
  else if (isConfirmed || isShipped) colorClasses = 'bg-[#E8F0FF] text-[#1A4FBB]'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${colorClasses}`}
    >
      {isCancelled && <X className="h-3 w-3" strokeWidth={3} />}
      {label}
    </span>
  )
}

function TimelineStep({
  step,
  isLast,
}: {
  step: {
    id: string
    label: string
    status: 'completed' | 'active' | 'pending'
    date?: string | null
    description?: string
  }
  isLast: boolean
}) {
  const isCompleted = step.status === 'completed'
  const isActive = step.status === 'active'

  return (
    <li className="flex gap-3">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            isCompleted
              ? 'border-[#1E0F00] bg-[#1E0F00]'
              : isActive
                ? 'border-[#1E0F00] bg-[#1E0F00]'
                : 'border-[#CCCCCC] bg-white'
          }`}
        >
          {(isCompleted || isActive) && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
          {!isCompleted && !isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#CCCCCC]" />}
        </div>
        {!isLast && (
          <div
            className={`mt-1 w-0.5 flex-1 ${isCompleted ? 'bg-[#1E0F00]' : 'bg-[#DDDDDD]'}`}
            style={{ minHeight: '20px' }}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-4 ${isLast ? 'pb-1' : ''}`}>
        <div className="flex items-center gap-2">
          <span
            className={`font-['DM_Sans'] text-[14px] leading-[150%] not-italic ${
              isCompleted || isActive
                ? 'font-semibold text-(--Text-Dark-Primary,#1A1A1A)'
                : 'text-(--Text-Dark-Secondary,#616161)'
            }`}
          >
            {step.label}
          </span>
          {step.date && (
            <span className="font-['DM_Sans'] text-[12px] leading-[150%] text-(--Text-Dark-Disable,#999) not-italic">
              · {formatDate(step.date)}
            </span>
          )}
        </div>
        {step.description && (
          <p className="mt-1 font-['DM_Sans'] text-[12px] leading-[150%] text-(--Text-Dark-Secondary,#616161) not-italic">
            {step.description}
          </p>
        )}
      </div>
    </li>
  )
}

export function OrderStatus({ template, sourceMessageUlid }: OrderStatusProps) {
  const { content } = template
  const { intro_text, closing_text, order } = content
  const { id, order_number, status, refund_status, summary, timeline, items, actions } = order

  const [timelineExpanded, setTimelineExpanded] = useState(false)

  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleAction = async (act: any) => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }
    const actionId = act.id || act.type || ''
    setLoadingAction(actionId)
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
      setLoadingAction(null)
    }
  }

  // Determine which timeline steps to show
  const allSteps = timeline?.items ?? []
  const currentStepIndex = allSteps.findIndex((s) => s.status === 'active')
  const collapsedSteps =
    currentStepIndex >= 0 ? [allSteps[currentStepIndex]] : allSteps.filter((s) => s.status === 'completed').slice(-1)
  const visibleSteps = timelineExpanded ? allSteps : collapsedSteps

  // Items
  const visibleProducts = items?.products ?? []
  const [itemsExpanded, setItemsExpanded] = useState(false)
  const maxVisibleItems = 1
  const displayedProducts = itemsExpanded ? visibleProducts : visibleProducts.slice(0, maxVisibleItems)
  const hasMoreItems =
    (items?.total_count ?? visibleProducts.length) > maxVisibleItems || visibleProducts.length > maxVisibleItems

  return (
    <section className="flex flex-col gap-5">
      {/* Intro text */}
      {intro_text && (
        <p className="font-['DM_Sans'] text-[14px] leading-[130%] text-(--Text-Dark-Primary,#1A1A1A) not-italic">
          {intro_text}
        </p>
      )}

      {/* Order Card */}
      <div className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-[#F7F7F5]">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 px-3 pt-4 pb-3">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-['DM_Sans'] text-[18px] leading-[150%] font-semibold text-(--Text-Dark-Primary,#1A1A1A) not-italic">
              Order {order_number || `#${id}`}
            </h2>
            {refund_status && (
              <span className="font-['DM_Sans'] text-[14px] leading-4.5 font-semibold text-[#B07D20]">
                {refund_status.label}
              </span>
            )}
            {summary && (
              <p className="text-[12px] leading-4 text-[#777777]">
                {[
                  summary.placed_on ? `Placed on ${formatDate(summary.placed_on)}` : null,
                  summary.items_count !== undefined ? `${summary.items_count} items` : null,
                  summary.total_amount?.formatted ?? null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            )}
          </div>
          <StatusBadge label={status.label} value={status.value} />
        </div>

        {/* Timeline Section */}
        {timeline && allSteps.length > 0 && (
          <div className="mx-3 mb-3 overflow-hidden rounded-xl bg-[#ECE6F2]">
            {/* Timeline header */}
            <button
              type="button"
              onClick={() => setTimelineExpanded((p) => !p)}
              className="flex w-full items-center justify-between px-3 py-2.5"
            >
              <span className="font-['DM_Sans'] text-[12px] leading-[150%] font-semibold tracking-wider text-(--Text-Dark-Tertiary,#757575) uppercase not-italic">
                Order Timeline
              </span>
              {timelineExpanded ? (
                <ChevronUp className="h-4 w-4 text-[#8A8A8A]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#8A8A8A]" />
              )}
            </button>

            {/* Timeline steps */}
            <ul className="px-3 pb-3">
              {visibleSteps.map((step, idx) => (
                <TimelineStep key={step.id} step={step} isLast={idx === visibleSteps.length - 1} />
              ))}
            </ul>
          </div>
        )}

        {/* Items Section */}
        {visibleProducts.length > 0 && (
          <div className="border-t border-[#E5E5E5] px-3 pt-3">
            <p className="mb-2 font-['DM_Sans'] text-[12px] font-semibold tracking-wider text-[#8A8A8A] uppercase">
              Items
            </p>
            <div className="flex flex-col gap-2">
              {displayedProducts.map((product) => (
                <div key={product.id} className="flex gap-3 rounded-xl border border-[#E5E5E5] bg-white p-3">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-16 w-16 shrink-0 rounded-lg border-[0.5px] border-solid border-(--Strokes-Primary,#E5E4E1) object-cover"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {product.brand && (
                      <span className="font-['DM_Sans'] text-[14px] leading-[150%] font-semibold text-(--Text-Dark-Primary,#1A1A1A) not-italic">
                        {product.brand}
                      </span>
                    )}
                    <span className="truncate font-['DM_Sans'] text-[12px] leading-[150%] text-(--Text-Dark-Secondary,#616161) not-italic">
                      {product.name}
                    </span>
                    {product.attributes && product.attributes.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {product.attributes.map((attr, i) => (
                          <span
                            key={i}
                            className="font-['DM_Sans'] text-[12px] leading-[150%] text-(--Text-Dark-Secondary,#616161) not-italic"
                          >
                            {attr.label}:{' '}
                            <span className="font-['DM_Sans'] text-[12px] leading-[150%] font-semibold text-(--Text-Dark-Primary,#1A1A1A) not-italic">
                              {attr.value}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {product.price && (
                    <span className="shrink-0 text-[12px] leading-4 font-semibold text-[#1F1F1F]">
                      {product.price.formatted ?? `${product.price.value} ${product.price.currency}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* See all items */}
            {hasMoreItems && (
              <button
                type="button"
                onClick={() => setItemsExpanded((p) => !p)}
                className="mt-2 flex items-center gap-1.5 py-1 text-[14px] text-[#0066CC] underline underline-offset-2"
              >
                {itemsExpanded ? 'See less' : `See All ${items?.total_count ?? visibleProducts.length} Items`}
                {itemsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        {actions && actions.length > 0 && (
          <div className="mt-3 border-t border-[#E5E5E5] px-3 pt-3 pb-3">
            <div className="flex flex-col gap-2">
              {actions.map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => handleAction(act)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1F1F1F] bg-white px-4 py-2.25 text-[14px] leading-4.5 font-medium text-[#1F1F1F] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"
                >
                  {loadingAction === (act.id || act.type) ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1F1F1F] border-t-transparent" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  {act.label || 'Action'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Closing text */}
      {closing_text && (
        <p className="font-['DM_Sans'] text-[14px] leading-[130%] text-(--Text-Dark-Primary,#1A1A1A) not-italic">
          {closing_text}
        </p>
      )}
    </section>
  )
}
