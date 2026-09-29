import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import type { LocationCardsTemplate } from '@/features/conversation/types/message'

/**
 * Cinema/branch location cards: one card renders inline, several become a
 * swipeable horizontal carousel. Data is fully hydrated server-side.
 */
export function LocationCards({ template }: { template: LocationCardsTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const cards = template.content?.cards ?? []
  if (cards.length === 0) return null
  const single = cards.length === 1

  return (
    <div
      className={
        single
          ? 'mt-2 flex w-full'
          : 'mt-2 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]'
      }
      dir="rtl"
    >
      {cards.map((c, i) => (
        <div
          key={c.id ?? i}
          className={`overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900 ${
            single ? 'w-full max-w-[320px]' : 'w-[240px] shrink-0 snap-start'
          }`}
        >
          {c.image && (
            <img
              src={c.image}
              alt={c.name ?? ''}
              className={`w-full object-cover ${single ? 'h-[140px]' : 'h-[110px]'}`}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <div className="flex flex-col gap-1.5 p-3.5">
            <p className="text-[14px] leading-tight font-bold text-neutral-900 dark:text-white">
              {c.name_ar ?? c.name}
              {c.name && c.name_ar && <span className="font-normal text-neutral-400"> · {c.name}</span>}
            </p>
            {(c.address_ar || c.address) && (
              <p className="text-[12px] leading-snug text-neutral-500 dark:text-neutral-400">
                {c.address_ar ?? c.address}
              </p>
            )}
            {c.hours && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                🕐 <bdo dir="ltr">{c.hours}</bdo>
              </p>
            )}
            {c.distance_km != null && (
              <p className="text-[12px] text-emerald-600 dark:text-emerald-400">📏 يبعد عنك {c.distance_km} كم</p>
            )}
            {c.maps_url && (
              <a
                href={c.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 rounded-xl px-3 py-2 text-center text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: color }}
              >
                الاتجاهات في خرايط جوجل 📍
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
