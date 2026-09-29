import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import type { ExperiencesListTemplate } from '@/features/conversation/types/message'

/**
 * Cinema experiences (IMAX, Dolby, 4DX…): one row per experience with its
 * cinemas and ticket price. Language-aware copy, theme-aware surfaces.
 */
export function ExperiencesList({ template }: { template: ExperiencesListTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const isArabic = /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? (title ?? 'تجاربنا السينمائية ✨') : (title_en ?? 'Our cinema experiences ✨')

  return (
    <div
      className="mt-2 w-full max-w-[340px] rounded-2xl p-4 shadow-sm"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        background: isDark ? '#181c28' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      <p className="mb-2.5 text-[14px] font-bold" style={{ color }}>
        {heading}
      </p>
      <div className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="rounded-xl p-2.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold" style={{ color: isDark ? '#f3f4f8' : '#17181c' }}>
                {it.name}
              </span>
              {it.price && (
                <span className="shrink-0 text-[12px] font-semibold whitespace-nowrap" style={{ color }}>
                  <bdo dir="ltr">{it.price}</bdo> {isArabic ? 'د.ك' : 'KD'}
                </span>
              )}
            </div>
            <p
              className="mt-0.5 text-[11.5px] leading-snug"
              style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}
            >
              📍 {isArabic ? it.cinemas_ar : (it.cinemas_en ?? it.cinemas_ar)}
              {(isArabic ? it.note_ar : it.note_en) && <span> · {isArabic ? it.note_ar : it.note_en}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
