import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useSendMessage } from '@/features/conversation/hooks/use-send-message'
import type { SuggestionsMessage, SuggestionOption } from '@/features/conversation/types/message'

interface SuggestionsSectionProps {
  suggestions: SuggestionsMessage
}

export function SuggestionsSection({ suggestions }: SuggestionsSectionProps) {
  const { mutateAsync: sendMessageMutation } = useSendMessage()
  const { conversationId } = useWidgetNavigation()

  const handleClick = async (option: SuggestionOption) => {
    if (typeof option === 'string') {
      try {
        await sendMessageMutation({
          ...(conversationId ? { conversation_id: conversationId } : {}),
          content: option,
          message_type: 'text',
        })
      } catch (err) {
        console.error('Failed to send suggestion response', err)
      }
    } else if (option && typeof option === 'object' && option.type === 'action') {
      console.log('TODO: suggestion action clicked', option)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      {suggestions.text && (
        <p className="text-left text-[14px] leading-[130%] font-normal text-[#1A1A1A]">{suggestions.text}</p>
      )}
      <div className="flex w-full flex-wrap justify-start gap-2">
        {suggestions.options.map((option, idx) => {
          const isStringOption = typeof option === 'string'
          const label = isStringOption ? option : option?.label || ''

          return (
            <button
              key={idx}
              onClick={() => handleClick(option)}
              className="flex cursor-pointer items-center gap-1 rounded-xl border border-(--Strokes-Primary,#E5E4E1) bg-(--Surface-Base,#FFF) p-2 text-left font-(family-name:--Font-primary,'DM_Sans') text-[14px] leading-[130%] font-normal text-(--Text-Dark-Secondary,#616161) transition-colors hover:bg-gray-50 focus:outline-none"
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
