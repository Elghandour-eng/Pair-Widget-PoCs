import { useTemplateDesign } from './use-template-design'
import type { ExperiencesListTemplate } from '@/features/conversation/types/message'

/**
 * Cinema experiences (IMAX, Dolby, 4DX…): one row per experience with its
 * cinemas and ticket price. Language-aware copy, theme-aware surfaces.
 */
export function ExperiencesList({ template }: { template: ExperiencesListTemplate; sourceMessageUlid?: string }) {
  const d = useTemplateDesign(template.content)
  const { accent: color, isDark, isArabic } = d
  const { title, title_en, items = [] } = template.content ?? {}
  if (items.length === 0) return null

  const heading = isArabic ? (title ?? 'تجاربنا السينمائية ✨') : (title_en ?? 'Our cinema experiences ✨')

  return (
    <div
      className="mt-2 w-full max-w-[340px] shadow-sm"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{ ...d.cardStyle, padding: d.padding }}
    >
      <p className="mb-2.5 font-bold" style={{ color, fontSize: d.titleSize }}>
        {heading}
      </p>
      <div className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="p-2.5"
            style={{
              // Rows echo the card's own radius, a step tighter so they nest rather than compete.
              borderRadius: Math.max(0, d.radius - 4),
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              ...(d.divider === 'none' ? {} : { border: `1px ${d.divider} ${d.border}` }),
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold" style={{ color: d.text }}>
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
