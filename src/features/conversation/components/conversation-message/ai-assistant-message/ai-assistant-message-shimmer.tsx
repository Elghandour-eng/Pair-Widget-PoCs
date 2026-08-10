import { env } from '@/core/env'
import { cn } from '@/lib/utils'
import { getWidgetId } from '@/utils/widget-id'
import type { CSSProperties } from 'react'

interface AiAssistantMessageShimmerProps {
  cardStyles?: CSSProperties
}

export function HiroLoading(_props: AiAssistantMessageShimmerProps) {
  return (
    <div className="flex w-full justify-center py-2">
      <div
        className="relative flex h-16.5 w-full max-w-92.5 items-center justify-center gap-2 rounded-[100px] p-4 shadow-sm select-none"
        style={{
          background: 'linear-gradient(266.37deg, #9AAFF4 8.92%, #45BDF9 41.19%, #BCE1FF 76.22%, #6AC5FE 104.8%)',
          boxSizing: 'border-box',
        }}
      >
        {/* Sparkle Icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 animate-pulse"
        >
          <path
            d="M8 0C8 4.41828 4.41828 8 0 8C4.41828 8 8 11.5817 8 16C8 11.5817 11.5817 8 16 8C11.5817 8 8 4.41828 8 0Z"
            fill="white"
          />
        </svg>
        <span
          className="text-center text-[16px] leading-4 font-semibold tracking-wide text-white"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Thinking
        </span>
      </div>
    </div>
  )
}

export function AiAssistantMessageShimmer({ cardStyles }: AiAssistantMessageShimmerProps) {
  const currentWidgetId = getWidgetId()
  const hiroWidgetId = env.hiroWidgetId

  const isHiroWidget = !!currentWidgetId && currentWidgetId === hiroWidgetId

  if (isHiroWidget) {
    return <HiroLoading cardStyles={cardStyles} />
  }

  const hasCardStyles = cardStyles && Object.keys(cardStyles).length > 0

  return (
    <div className="w-full">
      {/* Text Area Skeleton */}
      <div
        className={cn(
          'mt-1 flex w-full flex-col gap-2.5',
          hasCardStyles && 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
        )}
        style={hasCardStyles ? cardStyles : undefined}
      >
        <div className="shimmer-skeleton h-2.5 w-full rounded-[6px]" />
        <div className="shimmer-skeleton h-2.5 w-full rounded-[6px]" />
        <div className="shimmer-skeleton h-2.5 w-full rounded-[6px]" />
      </div>

      {/* Suggestions Section Skeleton */}
      <div className="mt-2 flex w-full gap-2">
        <div className="shimmer-skeleton h-72 flex-1 rounded-2xl" />
        <div className="shimmer-skeleton h-72 flex-1 rounded-2xl" />
        <div className="shimmer-skeleton h-72 flex-1 rounded-2xl" />
      </div>
    </div>
  )
}
