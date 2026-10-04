import { CardImage } from './card-image'
import { useTemplateDesign } from './use-template-design'
import type { LocationCardsTemplate } from '@/features/conversation/types/message'

/**
 * Cinema location cards: one renders inline, several become a swipeable
 * carousel. Copy follows the widget language and colours follow the theme.
 */
export function LocationCards({ template }: { template: LocationCardsTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const { accent: color, isArabic } = d
  const cards = template.content?.cards ?? []
  if (cards.length === 0) return null
  const single = cards.length === 1

  const cardStyle: React.CSSProperties = d.cardStyle
  const nameColor = d.text
  const dimColor = d.muted

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
            className={`flex flex-col overflow-hidden ${single ? 'w-full max-w-[320px]' : 'w-[240px] shrink-0 snap-start self-stretch'}`}
            style={cardStyle}
          >
            {d.showImage && (
              <CardImage
                src={c.image}
                alt={title ?? ''}
                className="w-full object-cover"
                style={{ aspectRatio: d.aspect }}
                fallback={
                  <div
                    className="flex w-full items-center justify-center text-[30px]"
                    style={{ aspectRatio: d.aspect, background: `linear-gradient(160deg, ${color}26, ${color}0a)` }}
                  >
                    📍
                  </div>
                }
              />
            )}
            <div className="flex flex-1 flex-col gap-1.5" style={{ padding: d.padding }}>
              <p className="leading-tight font-bold" style={{ color: nameColor, fontSize: d.titleSize }}>
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
