import { Spinner } from '@/components/ui/spinner'
import { env } from '@/core/env'
import { cn } from '@/lib/utils'
import { getWidgetId } from '@/utils/widget-id'
import type { CSSProperties } from 'react'

import type { LoadingDesignDto } from '@/config/types/widget-config-dto'

interface AiAssistantMessageShimmerProps {
  cardStyles?: CSSProperties
  /** The studio's loading design; its colours and speed arrive as custom properties. */
  design?: LoadingDesignDto
  containerStyle?: CSSProperties
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

interface LoadingIndicatorProps {
  /** The studio's loading design; without one the widget draws its own spinner and text. */
  design?: LoadingDesignDto
  /** Carries the design's speed as a custom property. */
  containerStyle?: CSSProperties
  /** The channel's colour, for a spinner the design does not colour itself. */
  brand?: string
}

/**
 * The spinner, or the bouncing dots, shown in place of the skeleton. Colour,
 * size, stroke and caption come from the design; the speed comes off the
 * container (see `.pair-load-spin` and `.pair-load-dot` in styles.css).
 */
export function LoadingIndicator({ design, containerStyle, brand }: LoadingIndicatorProps) {
  // No design stored: the placeholder the widget has always drawn.
  if (!design) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner className="size-4" style={{ color: brand }} />
          Loading messages...
        </p>
      </div>
    )
  }

  const color = design.spinnerColor && design.spinnerColor !== '#brand' ? design.spinnerColor : brand
  const size = design.spinnerSize ?? 22
  const dot = size / 2.5
  const caption = design.labelShow && design.labelText?.trim()

  return (
    <div className="flex flex-1 items-center justify-center gap-2" style={containerStyle}>
      {design.type === 'dots' ? (
        <span
          role="status"
          aria-label="Loading"
          className="flex shrink-0 items-end"
          style={{ color, gap: Math.max(2, size / 4) }}
        >
          {[0, 1, 2].map((i) => (
            <i key={i} className="pair-load-dot" style={{ width: dot, height: dot }} />
          ))}
        </span>
      ) : (
        <Spinner
          className="pair-load-spin shrink-0"
          size={size}
          strokeWidth={design.spinnerThickness ?? 2.5}
          absoluteStrokeWidth
          style={{ color, width: size, height: size }}
        />
      )}
      {caption && (
        <p style={{ color: design.labelColor, fontSize: design.labelSize ? `${design.labelSize}px` : undefined }}>
          {design.labelText}
        </p>
      )}
    </div>
  )
}

export function AiAssistantMessageShimmer({ cardStyles, design, containerStyle }: AiAssistantMessageShimmerProps) {
  const currentWidgetId = getWidgetId()
  const hiroWidgetId = env.hiroWidgetId

  const isHiroWidget = !!currentWidgetId && currentWidgetId === hiroWidgetId

  if (isHiroWidget) {
    return <HiroLoading cardStyles={cardStyles} />
  }

  const hasCardStyles = cardStyles && Object.keys(cardStyles).length > 0

  // Shape comes from the config; the colours, speed and radius ride in on the
  // custom properties the container carries.
  const lines = design?.lines ?? 3
  const lineHeight = design?.lineHeight ?? 10
  const cards = design?.cards ?? 3
  const cardHeight = design?.cardHeight ?? 288
  const block = design?.type === 'pulse' ? 'skeleton-pulse' : 'shimmer-skeleton'
  const caption = design?.labelShow && design.labelText?.trim()

  return (
    <div className="w-full" style={containerStyle}>
      {/* Text Area Skeleton */}
      {lines > 0 && (
        <div
          className={cn(
            'mt-1 flex w-full flex-col gap-2.5',
            hasCardStyles && 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
          )}
          style={hasCardStyles ? cardStyles : undefined}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={cn(block, 'w-full')} style={{ height: lineHeight }} />
          ))}
        </div>
      )}

      {/* Suggestions Section Skeleton */}
      {cards > 0 && (
        <div className="mt-2 flex w-full gap-2">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className={cn(block, 'flex-1')} style={{ height: cardHeight }} />
          ))}
        </div>
      )}

      {caption && (
        <p
          className="mt-3 text-center"
          style={{ color: design?.labelColor, fontSize: design?.labelSize ? `${design.labelSize}px` : undefined }}
        >
          {design?.labelText}
        </p>
      )}
    </div>
  )
}
