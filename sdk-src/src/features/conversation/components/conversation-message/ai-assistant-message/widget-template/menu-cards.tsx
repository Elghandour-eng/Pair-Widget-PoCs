import { CardImage } from './card-image'
import { useTemplateDesign } from './use-template-design'
import { env } from '@/core/env'
import type { MenuCardsTemplate } from '@/features/conversation/types/message'

/**
 * Food & drinks carousel: photo cards with the item name and price.
 * Language follows the reply, colours follow the theme.
 */
export function MenuCards({ template }: { template: MenuCardsTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const { accent: brand, isArabic } = d
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? title : (title_en ?? title)
  const cardStyle: React.CSSProperties = d.cardStyle
  const cardWidth = Math.round(290 / Math.max(1, d.columns))
  const resolveImg = (u?: string) => (u && u.indexOf('http') !== 0 ? `${env.baseURL.replace(/\/$/, '')}${u}` : u)

  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
      {heading && (
        <p className="font-bold" style={{ color: brand, fontSize: d.titleSize }}>
          {heading}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it, i) => {
          const img = resolveImg(it.image)
          return (
            <div
              key={i}
              className="flex shrink-0 snap-start flex-col overflow-hidden"
              style={{ ...cardStyle, width: cardWidth }}
            >
              {d.showImage && (
                <CardImage
                  src={img}
                  alt={it.label_en ?? it.label}
                  className="w-full object-cover"
                  style={{ aspectRatio: d.aspect }}
                  fallback={
                    <div
                      className="flex w-full items-center justify-center text-[26px]"
                      style={{ aspectRatio: d.aspect, background: `${brand}0d` }}
                    >
                      🍿
                    </div>
                  }
                />
              )}
              <div className="flex flex-1 flex-col gap-1" style={{ padding: d.padding }}>
                <span
                  className="line-clamp-2 text-[11.5px] leading-snug font-semibold"
                  style={{ color: d.text }}
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
