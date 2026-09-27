/**
 * Official Pair marks, traced from the supplied brand SVGs.
 * Both use `currentColor` so they pick up the surrounding text colour.
 */

/** The standalone "P" monogram, cropped to its glyph bounds. */
export function PairMark({ className = 'h-7', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="62 56 134 147" className={className} role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M128.544 56.1433H61.98V84.853H97.5665V84.8438H126.564C148.309 84.8438 159.298 94.6252 159.298 111.369C159.298 128.108 148.309 137.678 126.564 137.678H104.926H61.98V166.448H97.5665V166.379H128.544C169.622 166.379 195.321 145.284 195.321 111.369C195.321 77.4491 169.622 56.1433 128.544 56.1433Z" />
      <path d="M61.9805 176.987H97.567V202.979H61.9805V176.987Z" />
    </svg>
  )
}

/** The full "Pair" wordmark, cropped to its glyph bounds. */
export function PairWordmark({ className = 'h-6', title = 'Pair' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="54 105 150 46" className={className} role="img" aria-label={title} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M73.8101 106.433H53.9803V115.046H64.5818V115.043H73.2204C79.6984 115.043 82.972 117.977 82.972 123C82.972 128.022 79.6984 130.893 73.2204 130.893H66.7743H53.9803V139.524H64.5818V139.503H73.8101C86.0476 139.503 93.7035 133.175 93.7035 123C93.7035 112.824 86.0476 106.433 73.8101 106.433Z" />
      <path d="M53.9805 142.686H64.5819V150.483H53.9805V142.686Z" />
      <path d="M126.114 139.556H105.916L102.063 148.849H91.7477L111.137 105.485H121.081L140.537 148.849H129.968L126.114 139.556ZM122.947 131.941L116.048 115.336L109.15 131.941H122.947Z" />
      <path d="M145.068 105.485H155.133V148.849H145.068V105.485Z" />
      <path d="M193.172 148.849L184.784 136.769H175.521V148.849H165.455V105.485H184.285C188.139 105.485 191.485 106.125 194.323 107.406C197.161 108.686 199.347 110.504 200.879 112.858C202.41 115.213 203.177 118.001 203.177 121.224C203.177 124.444 202.399 127.221 200.846 129.557C199.291 131.89 197.086 133.674 194.229 134.91L203.985 148.849H193.172ZM192.984 121.224C192.984 118.785 192.195 116.917 190.619 115.617C189.047 114.315 186.749 113.664 183.726 113.664H175.521V128.779H183.726C186.749 128.779 189.047 128.119 190.619 126.798C192.195 125.477 192.984 123.619 192.984 121.224Z" />
    </svg>
  )
}

/** Wordmark plus the product name, as used in the shell and on the sign-in screen. */
export function PairLockup({ className = '', wordmark = 'h-5', label }: { className?: string; wordmark?: string; label?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2.5 ${className}`}>
      <PairWordmark className={`${wordmark} text-accent`} />
      {label && <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">{label}</span>}
    </span>
  )
}
