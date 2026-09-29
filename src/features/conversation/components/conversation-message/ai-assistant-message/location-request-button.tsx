import { useState } from 'react'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import { isDarkBackground } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * "Share my location" action card: asks the browser for GPS and sends a
 * friendly message — the coordinates ride along in metadata, so the visitor's
 * bubble never shows raw numbers. The server enriches it (address lookup,
 * exact distances) before the AI sees it.
 */
export function LocationRequestButton({ text }: { text?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: sendMessage } = useSendMessage()
  const [busy, setBusy] = useState(false)
  const color = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const isArabic = text ? /[؀-ۿ]/.test(text) : /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')

  const handleClick = () => {
    if (busy) return
    if (!('geolocation' in navigator)) {
      toast.error(isArabic ? 'المتصفح ما يدعم تحديد الموقع' : 'Location is not supported in this browser')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void sendMessage({
          ...(conversationId ? { conversation_id: conversationId } : {}),
          content: isArabic ? '📍 شاركت موقعي' : '📍 Shared my location',
          message_type: 'text',
          metadata: { shared_location: { lat: pos.coords.latitude, lng: pos.coords.longitude } },
        }).finally(() => setBusy(false))
      },
      () => {
        setBusy(false)
        toast.error(
          isArabic ? 'ما قدرنا نوصل لموقعك — اكتب اسم منطقتك' : "Couldn't get your location — type your area instead",
        )
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  return (
    <div
      className="flex w-full max-w-[320px] items-center gap-3 rounded-2xl p-3.5"
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        background: isDark ? 'rgba(255,255,255,0.05)' : `${color}0d`,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : `${color}26`}`,
      }}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center">
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-15"
          style={{ background: color, animationDuration: '2s' }}
        />
        <span
          className="relative flex size-9 items-center justify-center rounded-full text-[16px]"
          style={{ background: `${color}1a` }}
        >
          📍
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {text && (
          <span
            className="text-[12px] leading-snug"
            style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}
          >
            {text}
          </span>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          {busy && (
            <span
              className="inline-block size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden
            />
          )}
          {busy ? (isArabic ? 'قاعد أحدد موقعك...' : 'Locating you...') : isArabic ? 'شارك موقعي' : 'Share my location'}
        </button>
      </div>
    </div>
  )
}
