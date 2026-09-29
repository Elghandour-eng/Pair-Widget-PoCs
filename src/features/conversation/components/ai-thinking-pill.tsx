import { useWidgetConfigContext } from '@/contexts/widget-config-context'

/**
 * The branded "assistant is thinking" pill: avatar (or a sparkle) with a soft
 * pulse ring, the assistant's name, and three wave dots tinted with the
 * widget's primary colour. Replaces the old skeleton blocks, which read as a
 * broken layout while a reply streams in.
 */
export function AiThinkingPill() {
  const { widgetConfig } = useWidgetConfigContext()
  const color = widgetConfig.primaryColor || '#4A5568'
  const avatar = widgetConfig.avatarUrl || widgetConfig.messagesConfig?.aiMessages?.iconUrl
  const name = widgetConfig.name || 'AI'

  return (
    <div className="animate-fade-in flex w-full items-start justify-start px-4 py-2 select-none">
      <div
        className="flex items-center gap-2.5 rounded-2xl rounded-bl-md border px-3.5 py-2.5 shadow-sm"
        style={{ borderColor: `${color}2e`, background: `linear-gradient(135deg, ${color}14, ${color}05)` }}
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-20"
            style={{ background: color, animationDuration: '1.8s' }}
          />
          {avatar ? (
            <img src={avatar} alt="" className="relative h-7 w-7 rounded-full object-cover" />
          ) : (
            <span
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: color }}
            >
              {name.trim().charAt(0).toUpperCase() || '✦'}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1" aria-label={`${name} is typing`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full"
              style={{ background: color, animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
