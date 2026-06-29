import type { QuickLinkData, QuickLinksConfig } from '@/config/types/widget-config'

interface QuickLinkItemProps {
  item: QuickLinkData
  cardStyles?: QuickLinksConfig['cardStyles']
  textStyle?: QuickLinksConfig['textStyle']
  showTitle?: boolean
  showSubtitle?: boolean
}

export function QuickLinkItem({
  item,
  cardStyles,
  textStyle,
  showTitle = true,
  showSubtitle = true,
}: QuickLinkItemProps) {
  return (
    <button
      className="flex h-full w-full min-w-[5.71rem] flex-[1_0_0] flex-col items-start justify-start gap-2 rounded-xl border border-[#E5E4E1] bg-[#FFF] p-1 transition-colors hover:bg-gray-50"
      style={cardStyles}
    >
      {item.image && (
        <img
          src={item.image}
          alt={item.text}
          className="h-24.5 w-full rounded-xl border border-[#E5E4E1] bg-[#FFF] object-cover object-top"
        />
      )}
      <div className="flex w-full flex-col p-1 text-left">
        {showTitle && item.text && (
          <span className="w-full text-[0.75rem] leading-[150%] font-semibold text-[#1A1A1A]" style={textStyle}>
            {item.text}
          </span>
        )}
        {showSubtitle && item.subtitle && (
          <span className="mt-0.5 w-full text-[0.625rem] leading-[140%] font-normal text-gray-500">
            {item.subtitle}
          </span>
        )}
      </div>
    </button>
  )
}
