import { useEffect, useState } from 'react'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'

/**
 * The assistant's "working" line: a spinning film-reel in the widget's colour
 * next to a status phrase that narrates what is actually happening. The phrase
 * comes from the stream's thinking text; without one it cycles through warm
 * Kuwaiti fallbacks. Text colour follows the widget theme.
 */
const DEFAULT_LABELS = ['قاعد أفكر شلون أساعدك', 'ثواني وحدة، قاعد أرتب لك الجواب', 'لحظة، أجمع لك المعلومة الصح']

function FilmReelSpinner({ color }: { color: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-claude-spin shrink-0"
      style={{ animationDuration: '2.6s' }}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="7" r="1.7" fill={color} />
      <circle cx="12" cy="17" r="1.7" fill={color} />
      <circle cx="7" cy="12" r="1.7" fill={color} />
      <circle cx="17" cy="12" r="1.7" fill={color} />
      <circle cx="12" cy="12" r="1.2" fill={color} />
    </svg>
  )
}

/**
 * Hiro's look: a full-width gradient pill with a spark and one word. It
 * breathes (a slow sheen across it) so a long wait still reads as working.
 */
function GradientThinkingPill({ label }: { label?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const t = widgetConfig.messagesConfig?.thinking ?? {}
  const isArabic = /^ar/i.test(view.lang ?? widgetConfig.locale ?? 'en')
  const fixed = t.label?.trim() || (isArabic ? 'أفكر' : 'Thinking')
  const text = t.narrate && label?.trim() ? label.trim() : fixed
  const from = t.from || '#8FD3FF'
  const to = t.to || '#9AA8F5'
  return (
    <div className="animate-fade-in w-full px-4 py-2 select-none" dir="auto">
      <div
        className="pair-thinking-pill relative flex w-full items-center justify-center gap-2 overflow-hidden"
        style={{
          height: t.height ?? 56,
          borderRadius: t.radius ?? 999,
          background: `linear-gradient(100deg, ${from} 0%, #CDE9FF 30%, #4FC3F7 62%, ${to} 100%)`,
          color: t.textColor || '#FFFFFF',
          boxShadow: `0 8px 24px ${from}55, inset 0 0 0 3px rgba(255,255,255,0.35)`,
        }}
      >
        <span className="pair-thinking-sheen pointer-events-none absolute inset-0" aria-hidden />
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="pair-thinking-spark relative shrink-0"
          aria-hidden
        >
          <path d="M12 2c.5 4.6 2.4 7.5 10 10-7.6 2.5-9.5 5.4-10 10-.5-4.6-2.4-7.5-10-10 7.6-2.5 9.5-5.4 10-10Z" />
        </svg>
        <span key={text} className="animate-fade-in relative text-[15px] font-semibold tracking-wide">
          {text}
        </span>
      </div>
    </div>
  )
}

export function AiThinkingPill({ label }: { label?: string }) {
  const { widgetConfig } = useWidgetConfigContext()
  if (widgetConfig.messagesConfig?.thinking?.style === 'pill') return <GradientThinkingPill label={label} />
  return <ReelThinkingLine label={label} />
}

function ReelThinkingLine({ label }: { label?: string }) {
  const { widgetConfig, view } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const isDark = view.theme ? view.theme === 'dark' : isDarkBackground(widgetConfig.widgetBgColor)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (label) return
    const t = setInterval(() => setTick((v) => v + 1), 3200)
    return () => clearInterval(t)
  }, [label])

  const text = label?.trim() || DEFAULT_LABELS[tick % DEFAULT_LABELS.length]

  return (
    <div className="animate-fade-in flex w-full items-center justify-start gap-2.5 px-4 py-2.5 select-none" dir="auto">
      <FilmReelSpinner color={color} />
      <span
        key={text}
        className="animate-fade-in text-[13px] leading-none font-medium"
        style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }}
      >
        {text}
        <span className="thinking-ellipsis" />
      </span>
    </div>
  )
}
