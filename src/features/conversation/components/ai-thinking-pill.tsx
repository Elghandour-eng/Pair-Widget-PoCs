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

export function AiThinkingPill({ label }: { label?: string }) {
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
