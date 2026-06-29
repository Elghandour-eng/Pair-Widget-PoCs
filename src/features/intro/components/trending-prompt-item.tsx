import type { CSSProperties } from 'react'

import { TrendingUp } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import type { TrendingPromptData } from '@/config/types/widget-config'
import { cn } from '@/lib/utils'

interface TrendingPromptItemProps {
  prompt: TrendingPromptData
  showIcon: boolean
  chipStyles: CSSProperties
  textStyle: CSSProperties
  onClick?: () => void
  disabled?: boolean
  isLoading?: boolean
}

export function TrendingPromptItem({
  prompt,
  showIcon,
  chipStyles,
  textStyle,
  onClick,
  disabled,
  isLoading,
}: TrendingPromptItemProps) {
  const isColumn = chipStyles?.flexDirection === 'column'

  return (
    <button
      className={cn(
        'flex cursor-pointer rounded-full border border-[#E5E4E1] bg-[#FFF] px-3 py-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
        isColumn ? 'h-full w-full flex-col gap-4 pt-4 pb-3' : 'items-center justify-center gap-1.5',
      )}
      style={chipStyles}
      onClick={onClick}
      disabled={disabled}
    >
      {isLoading ? (
        <Spinner className="size-4" />
      ) : (
        showIcon &&
        (prompt.iconUrl ? (
          <img src={prompt.iconUrl} alt={prompt.text} className="size-6 object-contain" />
        ) : (
          <TrendingUp className="size-6" size={24} />
        ))
      )}
      <span
        className="text-start font-['DM_Sans'] text-[0.875rem] leading-[130%] font-normal text-wrap text-(--Text-Dark-Primary,#1A1A1A)"
        style={textStyle}
      >
        {prompt.text}
      </span>
    </button>
  )
}
