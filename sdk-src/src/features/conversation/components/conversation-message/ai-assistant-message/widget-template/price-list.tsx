import { useTemplateDesign } from './use-template-design'
import type { PriceListTemplate } from '@/features/conversation/types/message'

/** Ticket price table: language-aware labels, theme-aware surfaces. */
export function PriceList({ template }: { template: PriceListTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const { accent: color, isDark, isArabic } = d
  const { title, title_en, currency, currency_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? (title ?? 'أسعار التذاكر 🎬') : (title_en ?? title ?? 'Ticket prices 🎬')
  const cur = isArabic ? (currency ?? 'د.ك') : (currency_en ?? 'KD')

  return (
    <div
      className="mt-2 w-full max-w-[330px] shadow-sm"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{ ...d.cardStyle, padding: d.padding }}
    >
      {heading && (
        <p className="mb-2.5 font-bold" style={{ color, fontSize: d.titleSize }}>
          {heading}
        </p>
      )}
      <div className="flex flex-col">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 py-2 text-[13px]"
            style={
              i < items.length - 1 && d.divider !== 'none'
                ? { borderBottom: `1px ${d.divider} ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}` }
                : undefined
            }
          >
            <span style={{ color: d.text }}>
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
