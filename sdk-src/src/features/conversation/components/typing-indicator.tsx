import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { AiThinkingPill } from '@/features/conversation/components/ai-thinking-pill'

interface TypingIndicatorProps {
  senderName?: string
  senderType?: string
}

export function TypingIndicator({ senderName = 'AI Assistant', senderType = 'ai' }: TypingIndicatorProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const isAi = senderType === 'ai' || senderType === 'ai_agent'
  // An AI-bot channel can turn the big shimmer off (its replies stream in);
  // it then gets the compact typing dots like a human agent.
  const aiShimmer = widgetConfig.messagesConfig?.aiMessages?.showShimmer !== false

  if (isAi && aiShimmer) {
    return <AiThinkingPill />
  }

  // Fallback for human agent typing
  return (
    <div className="animate-fade-in flex w-full items-start justify-start gap-2 select-none">
      <div className="size-3 shrink-0" />
      <div className="flex max-w-[70%] flex-col items-start gap-1">
        <div className="flex min-h-9.5 items-center gap-1 rounded-2xl rounded-bl-none bg-[#F0F1F1] px-4 py-3">
          <span className="size-2 animate-bounce rounded-full bg-[#60676E] [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-[#60676E] [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-[#60676E]" />
        </div>
        <span className="px-1 text-[10px] leading-[130%] font-normal text-[#60676E]">{senderName} is typing...</span>
      </div>
    </div>
  )
}
