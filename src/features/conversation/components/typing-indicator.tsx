import { AiAssistantMessageShimmer } from '@/features/conversation/components/conversation-message/ai-assistant-message/ai-assistant-message-shimmer'

interface TypingIndicatorProps {
  senderName?: string
  senderType?: string
}

export function TypingIndicator({ senderName = 'AI Assistant', senderType = 'ai' }: TypingIndicatorProps) {
  const isAi = senderType === 'ai' || senderType === 'ai_agent'

  if (isAi) {
    return (
      <div className="animate-fade-in flex w-full flex-col items-start gap-4 bg-transparent py-2 pl-4 select-none">
        <AiAssistantMessageShimmer />
      </div>
    )
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
