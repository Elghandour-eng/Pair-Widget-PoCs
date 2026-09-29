import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import type { LocationCardsTemplate } from '@/features/conversation/types/message'

/**
 * Cinema location cards: one renders inline, several become a swipeable
 * carousel. Copy follows the widget language and colours follow the theme.
 */
export function LocationCards({ template }: { template: LocationCardsTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  // the reply's own language (set server-side from the message text) wins over the view setting
  const replyLang = (template.content as { lang?: string } | undefined)?.lang
  const isArabic = replyLang ? replyLang === 'ar' : /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const cards = template.content?.cards ?? []
  if (cards.length === 0) return null
  const single = cards.length === 1

  const cardStyle: React.CSSProperties = {
    background: isDark ? '#181c28' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
  }
  const nameColor = isDark ? '#f3f4f8' : '#17181c'
  const dimColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'

  return (
    <div
      className={
        single
          ? 'mt-2 flex w-full'
          : 'mt-2 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]'
      }
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {cards.map((c, i) => {
        const title = isArabic ? (c.name_ar ?? c.name) : (c.name ?? c.name_ar)
        const subtitle = isArabic ? c.name : c.name_ar
        const address = isArabic ? (c.address_ar ?? c.address) : (c.address ?? c.address_ar)
        return (
          <div
            key={c.id ?? i}
            className={`flex flex-col overflow-hidden rounded-2xl shadow-sm ${single ? 'w-full max-w-[320px]' : 'w-[240px] shrink-0 snap-start self-stretch'}`}
            style={cardStyle}
          >
            {c.image && (
              <img
                src={c.image}
                alt={title ?? ''}
                className={`w-full object-cover ${single ? 'h-[140px]' : 'h-[110px]'}`}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-3.5">
              <p className="text-[14px] leading-tight font-bold" style={{ color: nameColor }}>
                {title}
                {subtitle && (
                  <span className="font-normal" style={{ color: dimColor }}>
                    {' '}
                    · {subtitle}
                  </span>
                )}
              </p>
              {address && (
                <p className="text-[12px] leading-snug" style={{ color: dimColor }}>
                  {address}
                </p>
              )}
              {c.hours && (
                <p className="text-[12px] text-amber-500">
                  🕐 <bdo dir="ltr">{c.hours}</bdo>
                </p>
              )}
              {c.distance_km != null && (
                <p className="text-[12px] text-emerald-500">
                  {isArabic ? `📏 يبعد عنك ${c.distance_km} كم` : `📏 ${c.distance_km} km away`}
                </p>
              )}
              {c.maps_url && (
                <a
                  href={c.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto rounded-xl px-3 py-2 text-center text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: color }}
                >
                  {isArabic ? 'الاتجاهات في خرايط جوجل 📍' : 'Directions on Google Maps 📍'}
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
