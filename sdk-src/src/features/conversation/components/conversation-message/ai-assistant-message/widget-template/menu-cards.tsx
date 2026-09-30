import { CardImage } from './card-image'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import { env } from '@/core/env'
import type { MenuCardsTemplate } from '@/features/conversation/types/message'

/**
 * Food & drinks carousel: photo cards with the item name and price.
 * Language follows the reply, colours follow the theme.
 */
export function MenuCards({ template }: { template: MenuCardsTemplate; sourceMessageUlid?: string }) {
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
  const resolveImg = (u?: string) => (u && u.indexOf('http') !== 0 ? `${env.baseURL.replace(/\/$/, '')}${u}` : u)

  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
      {heading && (
        <p className="text-[13.5px] font-bold" style={{ color: brand }}>
          {heading}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it, i) => {
          const img = resolveImg(it.image)
          return (
            <div
              key={i}
              className="flex w-[132px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl"
              style={cardStyle}
            >
              <CardImage
                src={img}
                alt={it.label_en ?? it.label}
                className="h-[96px] w-full object-cover"
                fallback={
                  <div
                    className="flex h-[96px] w-full items-center justify-center text-[26px]"
                    style={{ background: `${brand}0d` }}
                  >
                    🍿
                  </div>
                }
              />
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <span
                  className="line-clamp-2 text-[11.5px] leading-snug font-semibold"
                  style={{ color: isDark ? '#f0f2f8' : '#1b1c21' }}
                >
                  {isArabic ? it.label : (it.label_en ?? it.label)}
                </span>
                <span className="mt-auto text-[12px] font-bold whitespace-nowrap" style={{ color: brand }}>
                  <bdo dir="ltr">{it.price}</bdo> {isArabic ? 'د.ك' : 'KD'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
