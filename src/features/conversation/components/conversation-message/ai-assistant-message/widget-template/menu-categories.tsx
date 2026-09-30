import { useState } from 'react'
import { CardImage } from './card-image'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { env } from '@/core/env'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { isDarkBackground } from '@/lib/utils'
import type { MenuCategoriesTemplate } from '@/features/conversation/types/message'

/**
 * Menu category grid: photo tiles (one per public category) that send the
 * category name as the visitor's reply when tapped. Two per row.
 */
export function MenuCategories({ template }: { template: MenuCategoriesTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: sendMessage } = useSendMessage()
  const [picked, setPicked] = useState<string | null>(null)
  const brand = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const replyLang = template.content?.lang
  const isArabic = replyLang ? replyLang === 'ar' : /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const resolveImg = (u?: string) => (u && u.indexOf('http') !== 0 ? `${env.baseURL.replace(/\/$/, '')}${u}` : u)
  const heading = isArabic ? title : (title_en ?? title)

  const pick = (label: string) => {
    if (picked) return
    setPicked(label)
    void sendMessage({
      ...(conversationId ? { conversation_id: conversationId } : {}),
      content: label,
      message_type: 'text',
    }).catch(() => setPicked(null))
  }

  return (
    <div className="mt-2 flex w-full max-w-[340px] flex-col gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
      {heading && (
        <p className="text-[13.5px] font-bold" style={{ color: brand }}>
          {heading}
        </p>
      )}
      <div className="grid w-full grid-cols-2 gap-2">
        {items.map((it) => {
          const label = isArabic ? it.label : (it.label_en ?? it.label)
          const isPicked = picked === label
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => pick(label)}
              disabled={!!picked && !isPicked}
              className="group relative h-[92px] overflow-hidden rounded-2xl text-start transition-transform active:scale-[0.98] disabled:opacity-50"
              style={{
                border: `1.5px solid ${isPicked ? brand : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <CardImage
                src={resolveImg(it.image)}
                alt={label}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                fallback={
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(160deg, ${brand}40, ${brand}14)` }}
                  />
                }
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.05) 70%)' }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end p-2.5">
                <span className="text-[13px] leading-tight font-bold text-white">{label}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
