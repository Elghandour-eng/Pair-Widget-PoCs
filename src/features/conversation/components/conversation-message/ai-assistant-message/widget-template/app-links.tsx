import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import type { AppLinksTemplate } from '@/features/conversation/types/message'

/**
 * App download card: the app identity up top, then official-badge style
 * store buttons (caption + store name), theme- and language-aware.
 */
export function AppLinks({ template }: { template: AppLinksTemplate; sourceMessageUlid?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const replyLang = template.content?.lang
  const isArabic = replyLang ? replyLang === 'ar' : /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const { ios, android } = template.content ?? {}
  if (!ios && !android) return null

  const brand = widgetConfig.primaryColor || '#B3202C'
  const appIcon = widgetConfig.launcherDesign?.iconUrl || widgetConfig.avatarUrl
  const badge =
    'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0'
  const badgeStyle: React.CSSProperties = {
    background: isDark ? '#000' : '#111318',
    border: '1px solid rgba(255,255,255,0.14)',
  }

  return (
    <div
      className="mt-2 flex w-full max-w-[320px] flex-col gap-3.5 rounded-2xl p-4 shadow-sm"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        background: isDark ? '#181c28' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* App identity */}
      <div className="flex items-center gap-3">
        {appIcon ? (
          <img
            src={appIcon}
            alt=""
            className="size-11 rounded-xl object-cover shadow-sm"
            style={{ background: brand }}
          />
        ) : (
          <span
            className="flex size-11 items-center justify-center rounded-xl text-[20px] shadow-sm"
            style={{ background: `${brand}1a` }}
          >
            🍿
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="text-[14px] leading-tight font-bold" style={{ color: isDark ? '#f3f4f8' : '#17181c' }}>
            {isArabic ? 'تطبيق سينيسكيب' : 'Cinescape App'}
          </span>
          <span
            className="text-[11.5px] leading-snug"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}
          >
            {isArabic ? 'احجز تذاكرك وتابع العروض من جوالك' : 'Book tickets and browse shows on your phone'}
          </span>
        </div>
      </div>

      {/* Store badges */}
      <div className="flex w-full flex-col gap-2">
        {ios && (
          <a href={ios} target="_blank" rel="noopener noreferrer" className={badge} style={badgeStyle} dir="ltr">
            <svg width="22" height="26" viewBox="0 0 384 512" fill="#fff" aria-hidden>
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-normal tracking-wide text-white/70">Download on the</span>
              <span className="mt-0.5 text-[15px] font-semibold text-white">App Store</span>
            </span>
          </a>
        )}
        {android && (
          <a href={android} target="_blank" rel="noopener noreferrer" className={badge} style={badgeStyle} dir="ltr">
            <svg width="22" height="24" viewBox="0 0 512 512" aria-hidden>
              <path
                fill="#00d3ff"
                d="M47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0z"
              />
              <path
                fill="#ffd400"
                d="M472.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8z"
              />
              <path fill="#ff3a44" d="M104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
              <path fill="#00f076" d="M104.6 13l280.8 161.2-60.1 60.1L104.6 13z" />
            </svg>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-normal tracking-wide text-white/70">GET IT ON</span>
              <span className="mt-0.5 text-[15px] font-semibold text-white">Google Play</span>
            </span>
          </a>
        )}
      </div>
    </div>
  )
}
