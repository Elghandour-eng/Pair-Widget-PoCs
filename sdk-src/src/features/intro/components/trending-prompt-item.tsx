import type { CSSProperties } from 'react'

import { CircleHelp, Clapperboard, Phone, Popcorn, Search, Sparkles, Star, Ticket, Utensils } from 'lucide-react'

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
  /** The studio's glyph for every chip, used when the chip names none itself. */
  defaultIcon?: string
  /** The upload behind `defaultIcon: 'custom'`. */
  defaultIconUrl?: string
  /** Which side of the text the icon sits on. */
  iconPosition?: 'start' | 'end'
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
  defaultIcon,
  defaultIconUrl,
  iconPosition,
}: TrendingPromptItemProps) {
  const isColumn = isCardLayout ?? chipStyles?.flexDirection === 'column'
  // A chip's own icon wins; otherwise the studio's default for all chips. An
  // upload only counts when it is what the icon actually names — a chip set to
  // `custom`, a chip with no name at all, or the studio default set to it. A
  // chip set to `custom` with nothing uploaded falls back to the default too.
  const iconName = prompt.icon && prompt.icon !== 'custom' ? prompt.icon : defaultIcon
  // "No icon" in the studio: this chip goes without, whatever the default is.
  const noIcon = iconName === 'none'
  const iconUrl =
    prompt.icon === 'custom' || !prompt.icon
      ? prompt.iconUrl || (defaultIcon === 'custom' ? defaultIconUrl : undefined)
      : undefined
  // The studio's default glyph is the sparkle, so an unknown name lands there
  // rather than on an icon the builder never offered.
  const Glyph = PROMPT_GLYPHS[iconName as keyof typeof PROMPT_GLYPHS] ?? Sparkles
  const iconSize = iconStyle?.size ?? 24

  return (
    <button
      className={cn(
        // `pair-prompt-chip` is what the studio's compiled hover rule targets.
        'pair-prompt-chip flex cursor-pointer rounded-full border border-[#E5E4E1] bg-[#FFF] px-3 py-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
        isColumn ? 'h-full w-full flex-col gap-4 pt-4 pb-3' : 'items-center justify-center gap-1.5',
        !isColumn && iconPosition === 'end' && 'flex-row-reverse',
      )}
      style={chipStyles}
      onClick={onClick}
      disabled={disabled}
    >
      {isLoading ? (
        <Spinner className="size-4" />
      ) : (
        showIcon &&
        !noIcon &&
        (iconUrl ? (
          <img
            src={iconUrl}
            alt={prompt.text}
            className="object-contain"
            style={{ width: iconSize, height: iconSize }}
          />
        ) : (
          <Glyph size={iconSize} className="shrink-0" style={{ color: iconStyle?.color }} />
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
