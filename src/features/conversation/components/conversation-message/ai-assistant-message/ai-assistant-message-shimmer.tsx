import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface AiAssistantMessageShimmerProps {
  cardStyles?: CSSProperties
}

export function AiAssistantMessageShimmer({ cardStyles }: AiAssistantMessageShimmerProps) {
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
