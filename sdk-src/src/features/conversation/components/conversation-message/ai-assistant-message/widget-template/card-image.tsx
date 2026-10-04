import { useState, type CSSProperties, type ReactNode } from 'react'

/**
 * A card photo that never leaves a hole: when the image is missing or fails to
 * load (e.g. a poster the CDN returns 403 for), the fallback renders in the
 * same box so the card keeps its shape.
 */
export function CardImage({
  src,
  alt,
  className,
  style,
  fallback,
}: {
  src?: string
  alt: string
  className: string
  /** Carries the design's aspect ratio, so the hole and the photo share one shape. */
  style?: CSSProperties
  fallback: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" onError={() => setFailed(true)} />
}
