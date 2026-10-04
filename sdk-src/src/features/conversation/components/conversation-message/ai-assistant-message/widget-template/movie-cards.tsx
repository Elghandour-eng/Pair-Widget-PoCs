import { useState } from 'react'
import { CardImage } from './card-image'
import { useTemplateDesign } from './use-template-design'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import type { MovieCardsTemplate } from '@/features/conversation/types/message'

/**
 * Now-showing carousel: poster cards with title, age rating and genre.
 * Tapping a card asks for that movie's showtimes as the visitor's reply.
 * Language follows the reply, colours follow the theme.
 */
export function MovieCards({ template }: { template: MovieCardsTemplate; sourceMessageUlid?: string }) {
  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: sendMessage } = useSendMessage()
  const [sending, setSending] = useState<number | null>(null)
  const d = useTemplateDesign(template.content)
  const { accent: brand, isArabic } = d
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? title : (title_en ?? title)
  const cardStyle: React.CSSProperties = d.cardStyle
  // Wider cards mean fewer across the same row; the poster keeps its chosen ratio.
  const cardWidth = Math.round(280 / Math.max(1, d.columns))

  // One request at a time; the card is free again once the message is on its way.
  const pick = (i: number, name: string) => {
    if (sending !== null || !name) return
    setSending(i)
    void sendMessage({
      ...(conversationId ? { conversation_id: conversationId } : {}),
      content: isArabic ? `مواعيد فيلم ${name}` : `Showtimes for ${name}`,
      message_type: 'text',
    })
      .catch(() => undefined)
      .finally(() => setSending(null))
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
      {heading && (
        <p className="font-bold" style={{ color: brand, fontSize: d.titleSize }}>
          {heading}
        </p>
      )}
      <div className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pick(i, it.title || it.title_ar || '')}
            disabled={sending !== null && sending !== i}
            aria-label={isArabic ? `مواعيد فيلم ${it.title_ar ?? it.title}` : `Showtimes for ${it.title}`}
            className="flex shrink-0 cursor-pointer snap-start flex-col overflow-hidden text-start transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ ...cardStyle, width: cardWidth, ...(sending === i ? { outline: `2px solid ${brand}` } : {}) }}
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
          </button>
        ))}
      </div>
    </div>
  )
}
