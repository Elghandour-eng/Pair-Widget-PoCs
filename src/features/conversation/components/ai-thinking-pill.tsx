import { useEffect, useState } from 'react'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

/**
 * The assistant's "working" indicator: a slowly spinning spark in the widget's
 * colour next to a status line that narrates what is happening ("أفكر…",
 * "أجيب بيانات السينمات…"). The label comes from the stream's thinking text;
 * without one it gently cycles through generic phrases. Minimal on purpose —
 * no bubble, no skeleton blocks.
 */
const DEFAULT_LABELS = ['أفكر', 'أرتب لك الإجابة', 'لحظة وحدة']

export function AiThinkingPill({ label }: { label?: string }) {
  const { widgetConfig } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#B3202C'
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (label) return
    const t = setInterval(() => setTick((v) => v + 1), 2600)
    return () => clearInterval(t)
  }, [label])

  const text = label?.trim() || DEFAULT_LABELS[tick % DEFAULT_LABELS.length]

  return (
    <div className="animate-fade-in flex w-full items-center justify-start gap-2 px-4 py-2.5 select-none">
      <span
        className="animate-claude-spin inline-block text-[15px] leading-none"
        style={{ color, animationDuration: '2.4s' }}
        aria-hidden
      >
        ✳
      </span>
      <span
        key={text}
        className="animate-fade-in text-[13px] leading-none font-medium text-neutral-500 dark:text-neutral-400"
      >
        {text}
        <span className="thinking-ellipsis" />
      </span>
    </div>
  )
}
