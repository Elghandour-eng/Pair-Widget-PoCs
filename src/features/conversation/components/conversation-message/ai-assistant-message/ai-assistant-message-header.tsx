import { InfoCircleIcon } from '@/components/icons/loader-icon'
import { cn } from '@/lib/utils'

interface AiAssistantMessageHeaderProps {
  isPending: boolean
}

export function AiAssistantMessageHeader({ isPending }: AiAssistantMessageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 select-none">
      <InfoCircleIcon
        className={cn('h-7 w-7 origin-center text-[#AD9332] transition-all', {
          'animate-claude-spin': isPending,
        })}
      />

      {isPending && (
        <p className="text-[14px] leading-[130%] font-normal text-[#757575]">Curating the best collection for you...</p>
      )}
    </div>
  )
}
