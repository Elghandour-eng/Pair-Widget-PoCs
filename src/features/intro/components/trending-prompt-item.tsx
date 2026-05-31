import type { CSSProperties } from 'react'

import { TrendingUp } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import type { TrendingPromptData } from '@/config/types/widget-config'

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
  return (
    <button
      className="flex cursor-pointer items-center justify-center gap-[0.375rem] rounded-full border border-[#E5E4E1] bg-[#FFF] px-3 py-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      style={chipStyles}
      onClick={onClick}
      disabled={disabled}
    >
      {isLoading ? (
        <Spinner className="size-4" />
      ) : (
        showIcon &&
        (prompt.iconUrl ? (
          <img src={prompt.iconUrl} alt={prompt.text} className="size-4 object-contain" />
        ) : (
          <TrendingUp className="size-4" size={20} />
        ))
      )}
      <span
        className="font-['DM_Sans'] text-[0.875rem] leading-[130%] font-normal text-[var(--Text-Dark-Primary,#1A1A1A)]"
        style={textStyle}
      >
        {prompt.text}
      </span>
    </button>
  )
}
