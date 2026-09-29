import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import type { PriceListTemplate } from '@/features/conversation/types/message'

/** Ticket price table: label right, price left, dashed row separators. */
export function PriceList({ template }: { template: PriceListTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const { title, currency = 'د.ك', items = [] } = template.content ?? {}
  if (items.length === 0) return null

  return (
    <div
      className="mt-2 w-full max-w-[330px] rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
      dir="rtl"
    >
      {title && (
        <p className="mb-2.5 text-[14px] font-bold" style={{ color }}>
          {title}
        </p>
      )}
      <div className="flex flex-col">
        {items.map((it, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 py-2 text-[13px] ${
              i < items.length - 1 ? 'border-b border-dashed border-black/8 dark:border-white/10' : ''
            }`}
          >
            <span className="text-neutral-800 dark:text-neutral-200">{it.label}</span>
            <span className="shrink-0 font-semibold whitespace-nowrap" style={{ color }}>
              <bdo dir="ltr">{it.price}</bdo> {currency}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
