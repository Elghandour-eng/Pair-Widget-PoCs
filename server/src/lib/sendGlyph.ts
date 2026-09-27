/**
 * The send glyph, as something an SDK build can actually draw.
 *
 * The widget picks its send icon from `sendButtonIcon.variant` and ships exactly
 * two glyphs, so a channel's own mark had nowhere to go. But the same build
 * spreads `sendButtonIcon.styles` onto the button element and paints the glyph
 * in `iconColor` — so the chosen mark is handed over as a background image on
 * the button, with `iconColor: transparent` retiring the built-in one. The
 * button then shows the channel's mark, in the size and colour the design asks
 * for, with no change to the widget.
 *
 * Paths are the ones the dashboard draws (web/src/components/sendIcons.tsx),
 * measured from the brand files on a 24×24 grid.
 */

const PATHS: Record<string, string[]> = {
  'cinescape-right': ['M4.25 5.28 L19.75 12.0 L4.25 18.72 L4.25 16.59 L15.09 12.0 L4.25 7.41 Z'],
  'cinescape-up': ['M5.28 19.75 L12.0 4.25 L18.72 19.75 L16.59 19.75 L12.0 8.91 L7.41 19.75 Z'],
  'cinescape-double-up': [
    'M6.6 15.95 L12.0 3.5 L17.4 15.95 L15.68 15.95 L12.0 7.25 L8.32 15.95 Z',
    'M6.6 20.5 L12.0 8.05 L17.4 20.5 L15.68 20.5 L12.0 11.8 L8.32 20.5 Z',
  ],
}

/** True for a glyph this module can draw (the stock paper plane is left to the widget). */
export const isDrawableSendIcon = (icon: unknown): boolean =>
  typeof icon === 'string' && icon in PATHS

/**
 * The glyph as a data URI, drawn in `color`. `#` has to be percent-encoded or
 * the rest of the URI is read as a fragment.
 */
export function sendGlyphDataUri(icon: string, color: string, rtl: boolean): string | null {
  const paths = PATHS[icon]
  if (!paths) return null
  const fill = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#FFFFFF'
  // The horizontal arrow points along the reading direction; the upward ones
  // read the same way round in both.
  const mirror = rtl && icon === 'cinescape-right' ? ' transform="translate(24 0) scale(-1 1)"' : ''
  const body = paths.map((d) => `<path d="${d}"/>`).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}">` +
    (mirror ? `<g${mirror}>${body}</g>` : body) +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
