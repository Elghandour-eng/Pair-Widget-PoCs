import { CardImage } from './card-image'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import type { MovieCardsTemplate } from '@/features/conversation/types/message'

/**
 * Now-showing carousel: poster cards with title, age rating and genre.
 * Language follows the reply, colours follow the theme.
 */
export function MovieCards({ template }: { template: MovieCardsTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const brand = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const replyLang = template.content?.lang
  const isArabic = replyLang ? replyLang === 'ar' : /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? title : (title_en ?? title)
  const cardStyle: React.CSSProperties = {
    background: isDark ? '#181c28' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
      {heading && (
        <p className="text-[13.5px] font-bold" style={{ color: brand }}>
          {heading}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex w-[124px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl"
            style={cardStyle}
          >
            <div className="relative">
              <CardImage
                src={it.image}
                alt={it.title}
                className="h-[168px] w-full object-cover"
                fallback={
                  <div
                    className="flex h-[168px] w-full flex-col items-center justify-center gap-2 px-2 text-center"
                    style={{ background: `linear-gradient(160deg, ${brand}26, ${brand}0a)` }}
                  >
                    <span className="text-[30px]">🎬</span>
                    <span className="line-clamp-3 text-[11px] font-semibold" style={{ color: brand }}>
                      {isArabic ? (it.title_ar ?? it.title) : it.title}
                    </span>
                  </div>
                }
              />
              {it.rating && (
                <span
                  className="absolute top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: brand, insetInlineEnd: '6px' }}
                >
                  {it.rating}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-2">
              <span
                className="line-clamp-2 text-[11.5px] leading-snug font-semibold"
                style={{ color: isDark ? '#f0f2f8' : '#1b1c21' }}
              >
                {isArabic ? (it.title_ar ?? it.title) : it.title}
              </span>
              {(it.genre || it.duration) && (
                <span className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}>
                  {[it.genre, it.duration].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
