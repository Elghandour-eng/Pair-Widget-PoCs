import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import type { PriceListTemplate } from '@/features/conversation/types/message'

/** Ticket price table: language-aware labels, theme-aware surfaces. */
export function PriceList({ template }: { template: PriceListTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const isArabic = /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const { title, title_en, currency, currency_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? (title ?? 'أسعار التذاكر 🎬') : (title_en ?? title ?? 'Ticket prices 🎬')
  const cur = isArabic ? (currency ?? 'د.ك') : (currency_en ?? 'KD')

  return (
    <div
      className="mt-2 w-full max-w-[330px] rounded-2xl p-4 shadow-sm"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        background: isDark ? '#181c28' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {heading && (
        <p className="mb-2.5 text-[14px] font-bold" style={{ color }}>
          {heading}
        </p>
      )}
      <div className="flex flex-col">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 py-2 text-[13px]"
            style={
              i < items.length - 1
                ? { borderBottom: `1px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}` }
                : undefined
            }
          >
            <span style={{ color: isDark ? '#e8eaf2' : '#26272c' }}>
              {isArabic ? it.label : (it.label_en ?? it.label)}
            </span>
            <span className="shrink-0 font-semibold whitespace-nowrap" style={{ color }}>
              <bdo dir="ltr">{it.price}</bdo> {cur}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
