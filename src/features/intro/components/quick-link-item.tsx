import type { QuickLinkData, QuickLinksConfig } from '@/config/types/widget-config'

interface QuickLinkItemProps {
  item: QuickLinkData
  config: QuickLinksConfig
}

export function QuickLinkItem({ item, config }: QuickLinkItemProps) {
  const cardStyles = config?.cardStyles ?? {}
  const textStyles = config?.textStyle ?? {}

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
      <span
        className="w-full p-1 text-left text-[0.75rem] leading-[150%] font-semibold text-[#1A1A1A]"
        style={textStyles}
      >
        {item.text}
      </span>
    </button>
  )
}
