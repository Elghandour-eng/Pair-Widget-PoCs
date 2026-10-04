import { CardImage } from './card-image'
import { useTemplateDesign } from './use-template-design'
import type { MovieCardsTemplate } from '@/features/conversation/types/message'

/**
 * Now-showing carousel: poster cards with title, age rating and genre.
 * Language follows the reply, colours follow the theme.
 */
export function MovieCards({ template }: { template: MovieCardsTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const { accent: brand, isArabic } = d
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? title : (title_en ?? title)
  const cardStyle: React.CSSProperties = d.cardStyle
  // Wider cards mean fewer across the same row; the poster keeps its chosen ratio.
  const cardWidth = Math.round(280 / Math.max(1, d.columns))

  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
      {heading && (
        <p className="font-bold" style={{ color: brand, fontSize: d.titleSize }}>
          {heading}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex shrink-0 snap-start flex-col overflow-hidden"
            style={{ ...cardStyle, width: cardWidth }}
          >
            <div className="relative">
              <CardImage
                src={it.image}
                alt={it.title}
                className="w-full object-cover"
                style={{ aspectRatio: d.aspect }}
                fallback={
                  <div
                    className="flex w-full flex-col items-center justify-center gap-2 px-2 text-center"
                    style={{ aspectRatio: d.aspect, background: `linear-gradient(160deg, ${brand}26, ${brand}0a)` }}
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
            <div className="flex flex-1 flex-col gap-0.5" style={{ padding: d.padding }}>
              <span
                className="line-clamp-2 text-[11.5px] leading-snug font-semibold"
                style={{ color: d.text }}
              >
                {isArabic ? (it.title_ar ?? it.title) : it.title}
              </span>
              {(it.genre || it.duration) && (
                <span className="text-[10px]" style={{ color: d.muted }}>
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
