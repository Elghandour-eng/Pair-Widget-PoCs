import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useDispatchAction } from '@/features/conversation/hooks/use-dispatch-action'
import type { ProductComparisonTemplate } from '@/features/conversation/types/message'
import React, { useState } from 'react'
import { toast } from 'sonner'

interface ProductComparisonProps {
  template: ProductComparisonTemplate
  sourceMessageUlid: string
}

export function ProductComparison({ template, sourceMessageUlid }: ProductComparisonProps) {
  const { content, config } = template
  const { products, rows, title, intro_text, usage_guidance, recommendation, actions } = content
  const maxVisibleRows = config?.comparison?.max_visible_rows ?? 5
  const enableExpandCollapse = config?.comparison?.enable_expand_collapse ?? true
  const seeMoreLabel = config?.comparison?.see_more_label ?? 'See more'
  const seeLessLabel = config?.comparison?.see_less_label ?? 'See less'
  const missingValueFallback = config?.comparison?.missing_value_fallback ?? '—'

  const [expanded, setExpanded] = useState(false)
  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: dispatchActionMutation } = useDispatchAction()
  const [loadingAction, setLoadingAction] = useState(false)

  const visibleRows = enableExpandCollapse && !expanded ? rows.slice(0, maxVisibleRows) : rows
  const hasHiddenRows = rows.length > maxVisibleRows

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

  const renderCellValue = (value: any, type?: string) => {
    if (value === undefined || value === null) {
      return missingValueFallback
    }
    if (type === 'list' && Array.isArray(value)) {
      return (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {value.map((item, idx) => (
            <li key={idx} className="leading-normal">
              {String(item)}
            </li>
          ))}
        </ul>
      )
    }
    if (type === 'price' && typeof value === 'object') {
      return value.formatted || `${value.value} ${value.currency}`
    }
    return String(value)
  }

  return (
    <section className="flex w-full flex-col gap-4 font-sans">
      {intro_text && <p className="font-sans text-[14px] leading-[18.2px] font-normal text-[#1A1A1A]">{intro_text}</p>}
      <h2 className="font-sans text-[18px] leading-6.75 font-semibold text-[#1A1A1A]">{title}</h2>

      {/* Side-by-side comparison table */}
      <div
        className="grid gap-0 overflow-hidden rounded-xl border border-[#E5E4E1] bg-[#FFF] shadow-sm"
        style={{ gridTemplateColumns: `120px repeat(${products.length}, minmax(90px, 1fr))` }}
      >
        {/* Header row */}
        <div className="flex items-center border-r border-b border-[#E5E4E1] bg-[#EEECE159] px-3 py-4 font-sans text-[12px] leading-4.5 font-semibold tracking-[0.24px] text-[#9A7742] uppercase">
          Attributes
        </div>
        {products.map((product, pIdx) => {
          const isLastCol = pIdx === products.length - 1
          return (
            <div
              key={product.id}
              className={`flex flex-col items-center gap-2 border-b border-[#E5E4E1] bg-[#EEECE159] px-2 py-4 text-center ${isLastCol ? '' : 'border-r border-[#E5E4E1]'}`}
            >
              {product.image?.url ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-[0.5px] border-[#E5E4E1] bg-[#FFF]">
                  <img src={product.image.url} alt={product.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-[0.5px] border-[#E5E4E1] bg-[#FFF] text-[10px] text-gray-400">
                  N/A
                </div>
              )}
              <h3 className="line-clamp-2 px-1 font-sans text-[12px] leading-4.5 font-semibold text-[#1A1A1A]">
                {product.name}
              </h3>
              {product.subtitle && (
                <p className="line-clamp-1 font-sans text-[11px] leading-4 font-normal text-[#757575]">
                  {product.subtitle}
                </p>
              )}
            </div>
          )
        })}

        {/* Content rows */}
        {visibleRows.map((row, rIdx) => {
          const isLastRow = rIdx === visibleRows.length - 1
          const rowBg = rIdx % 2 === 0 ? 'bg-[#EEECE1]' : 'bg-[#EEECE159]' // Alternating background

          return (
            <React.Fragment key={row.key}>
              {/* Attribute Label */}
              <div
                className={`border-r border-[#E5E4E1] px-3 py-3 font-sans text-[12px] leading-4.5 font-semibold text-[#9A7742] ${rowBg} ${isLastRow ? '' : 'border-b border-[#E5E4E1]'} flex items-center`}
              >
                {row.label}
              </div>

              {/* Product Values */}
              {products.map((product, pIdx) => {
                const isLastCol = pIdx === products.length - 1
                const borderClasses = `${isLastRow ? '' : 'border-b border-[#E5E4E1]'} ${isLastCol ? '' : 'border-r border-[#E5E4E1]'}`
                return (
                  <div
                    key={product.id}
                    className={`px-3 py-3 font-sans text-[12px] leading-4.5 font-normal text-[#1A1A1A] ${rowBg} ${borderClasses} flex items-center`}
                  >
                    {renderCellValue(row.values[product.id], row.value_type)}
                  </div>
                )
              })}
            </React.Fragment>
          )
        })}
      </div>

      {enableExpandCollapse && hasHiddenRows && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 self-center font-sans text-[14px] leading-4.5 font-normal text-[#0D4DA4] transition-colors hover:text-[#083a7c]"
        >
          <span>{expanded ? seeLessLabel : seeMoreLabel}</span>
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Usage guidance */}
      {usage_guidance && (
        <div className="mt-1 flex flex-col gap-3">
          <h3 className="font-sans text-[14px] font-semibold text-[#1A1A1A]">{usage_guidance.title}</h3>
          <div className="flex flex-col gap-2">
            {usage_guidance.items.map((item, idx) => (
              <p key={idx} className="font-sans text-[13px] leading-4.5 font-normal text-[#616161]">
                <strong className="font-semibold text-[#1A1A1A]">{item.title}</strong>: {item.usage}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="mt-1 flex flex-col gap-1 rounded-xl border border-[#E5E4E1] bg-[#ECE6F2] p-4 shadow-sm">
          <h4 className="font-sans text-[14px] font-semibold text-[#530D99]">
            {recommendation.title || 'Recommendation'}
          </h4>
          <p className="mt-0.5 font-sans text-[13px] leading-4.5 font-normal text-[#1A1A1A]">{recommendation.text}</p>
        </div>
      )}

      {/* Recommendation actions */}
      {config?.actions?.enabled &&
        actions &&
        actions.map((action, idx) => {
          const allowed = config.actions?.allowed_actions || []
          if (allowed.length > 0 && !allowed.includes(action.type)) {
            return null
          }
          return (
            <button
              key={idx}
              type="button"
              disabled={loadingAction}
              onClick={() => handleAction(action)}
              className="mt-2 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-3 py-2 font-sans text-[14px] leading-[18.2px] font-normal text-white transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {action.label || 'Action'}
            </button>
          )
        })}
    </section>
  )
}
