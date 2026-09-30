import { InfoCircleIcon } from '@/components/icons/loader-icon'
import { cn } from '@/lib/utils'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

interface AiAssistantMessageHeaderProps {
  isPending: boolean
}

export function AiAssistantMessageHeader({ isPending }: AiAssistantMessageHeaderProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const showAiIcon = aiConfig?.showAiIcon ?? true
  const iconUrl = aiConfig?.iconUrl

  if (!showAiIcon && !isPending) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 select-none">
      {showAiIcon &&
        (iconUrl ? (
          <img
            src={iconUrl}
            alt="AI Assistant Avatar"
            className={cn('h-7 w-7 rounded-full object-cover transition-all', {
              'animate-pulse': isPending,
            })}
          />
        ) : (
          <InfoCircleIcon
            className={cn('h-7 w-7 origin-center text-[#AD9332] transition-all', {
              'animate-claude-spin': isPending,
            })}
          />
        ))}

      {isPending && (
        <p className="text-[14px] leading-[130%] font-normal text-[#757575]">Curating the best collection for you...</p>
      )}
    </div>
  )
}
