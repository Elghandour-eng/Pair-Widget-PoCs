import type { CSSProperties } from 'react'

import {
  CircleHelp,
  Clapperboard,
  Phone,
  Popcorn,
  Search,
  Sparkles,
  Star,
  Ticket,
  TrendingUp,
  Utensils,
} from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import type { TrendingPromptData } from '@/config/types/widget-config'
import { cn } from '@/lib/utils'

/**
 * The glyphs a prompt can carry, by the name the studio stores. An uploaded
 * image still wins; this is what a named icon resolves to, so choosing one in
 * the builder does not mean uploading a file first.
 */
const PROMPT_GLYPHS = {
  film: Clapperboard,
  food: Utensils,
  ticket: Ticket,
  popcorn: Popcorn,
  phone: Phone,
  help: CircleHelp,
  search: Search,
  star: Star,
  spark: Sparkles,
} as const

interface TrendingPromptItemProps {
  prompt: TrendingPromptData
  showIcon: boolean
  chipStyles: CSSProperties
  textStyle: CSSProperties
  onClick?: () => void
  disabled?: boolean
  isLoading?: boolean
  isCardLayout?: boolean
  /** Size and colour for a drawn glyph; an uploaded image only takes the size. */
  iconStyle?: { size?: number; color?: string }
}

export function TrendingPromptItem({
  prompt,
  showIcon,
  chipStyles,
  textStyle,
  onClick,
  disabled,
  isLoading,
  isCardLayout,
  iconStyle,
}: TrendingPromptItemProps) {
  const isColumn = isCardLayout ?? chipStyles?.flexDirection === 'column'
  const Glyph = PROMPT_GLYPHS[prompt.icon as keyof typeof PROMPT_GLYPHS]
  const iconSize = iconStyle?.size ?? 24

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
          <img
            src={prompt.iconUrl}
            alt={prompt.text}
            className="object-contain"
            style={{ width: iconSize, height: iconSize }}
          />
        ) : Glyph ? (
          <Glyph size={iconSize} style={{ color: iconStyle?.color }} />
        ) : (
          <TrendingUp size={iconSize} style={{ color: iconStyle?.color }} />
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
