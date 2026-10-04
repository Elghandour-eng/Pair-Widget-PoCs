import type { QuickLinkData, QuickLinksConfig } from '@/config/types/widget-config'
import type { QuickLinksDesignDto } from '@/config/types/widget-config-dto'

interface QuickLinkItemProps {
  item: QuickLinkData
  cardStyles?: QuickLinksConfig['cardStyles']
  textStyle?: QuickLinksConfig['textStyle']
  subtitleStyle?: QuickLinksConfig['subtitleStyle']
  showTitle?: boolean
  showSubtitle?: boolean
  /** The studio's card design: whether the image shows, and how it is sized. */
  design?: QuickLinksDesignDto
  /** A tap sends the card's message to the chat. */
  onClick?: () => void
  disabled?: boolean
}

export function QuickLinkItem({
  item,
  cardStyles,
  textStyle,
  subtitleStyle,
  showTitle = true,
  showSubtitle = true,
  design,
  onClick,
  disabled,
}: QuickLinkItemProps) {
  // The image box follows the studio's design; the old fixed height stays the
  // fallback for configs that carry no design at all.
  const showImage = design ? design.showImage !== false && (design.imageHeight ?? 84) > 0 : true
  const imageStyle: React.CSSProperties | undefined = design
    ? {
        height: design.imageHeight ?? 84,
        borderRadius: design.imageRadius ?? 10,
        objectFit: design.imageFit ?? 'cover',
      }
    : undefined

  return (
    <button
      type="button"
      // `pair-quick-card` is what the studio's compiled hover rule targets.
      className="pair-quick-card flex h-full w-full min-w-0 flex-[1_0_0] cursor-pointer flex-col items-start justify-start gap-2 rounded-xl border border-[#E5E4E1] bg-[#FFF] p-1 text-start transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      style={cardStyles}
      onClick={onClick}
      disabled={disabled}
    >
      {showImage && item.image && design?.imageAsIcon && (
        // An icon, not a photo: small, at the card's start, never cropped.
        <img
          src={item.image}
          alt=""
          className="m-1 shrink-0 object-contain"
          style={{ width: design.iconSize ?? 24, height: design.iconSize ?? 24 }}
        />
      )}
      {showImage && item.image && !design?.imageAsIcon && (
        <img
          src={item.image}
          alt={item.text}
          className={
            design
              ? 'w-full object-top'
              : 'h-24.5 w-full rounded-xl border border-[#E5E4E1] bg-[#FFF] object-cover object-top'
          }
          style={imageStyle}
        />
      )}
      {/* Alignment is inherited from the card, where the studio's design sets it. */}
      <div className="flex w-full flex-col p-1">
        {showTitle && item.text && (
          <span className="w-full text-[0.75rem] leading-[150%] font-semibold text-[#1A1A1A]" style={textStyle}>
            {item.text}
          </span>
        )}
        {showSubtitle && item.subtitle && (
          <span
            className="mt-0.5 w-full text-[0.625rem] leading-[140%] font-normal text-gray-500"
            style={subtitleStyle}
          >
            {item.subtitle}
          </span>
        )}
      </div>
    </button>
  )
}
