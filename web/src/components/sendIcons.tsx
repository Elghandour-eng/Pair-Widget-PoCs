import { SendHorizontal } from 'lucide-react'
import type { CSSProperties } from 'react'

/**
 * Send-button glyphs. `default` is the paper plane the stock widget ships, the
 * `cinescape-*` marks are the Cinescape channel's own arrows (traced from the
 * brand SVGs, also in `web/public/send-icons/` for the SDK), and `custom`
 * draws whatever image the channel uploaded at `sendButtonIcon.url`.
 *
 * The built-in glyphs draw in `currentColor`, so the send button keeps
 * colouring them through `chat_input.sendButtonIcon.styles.iconColor`.
 */
export const SEND_ICONS = ['default', 'cinescape-right', 'cinescape-up', 'cinescape-double-up', 'custom'] as const
export type SendIconName = (typeof SEND_ICONS)[number]

/** Paths measured from the brand files, on a 24×24 grid. */
const PATHS: Record<'cinescape-right' | 'cinescape-up' | 'cinescape-double-up', string[]> = {
  'cinescape-right': ['M4.25 5.28 L19.75 12.0 L4.25 18.72 L4.25 16.59 L15.09 12.0 L4.25 7.41 Z'],
  'cinescape-up': ['M5.28 19.75 L12.0 4.25 L18.72 19.75 L16.59 19.75 L12.0 8.91 L7.41 19.75 Z'],
  'cinescape-double-up': [
    'M6.6 15.95 L12.0 3.5 L17.4 15.95 L15.68 15.95 L12.0 7.25 L8.32 15.95 Z',
    'M6.6 20.5 L12.0 8.05 L17.4 20.5 L15.68 20.5 L12.0 11.8 L8.32 20.5 Z',
  ],
}

/** Anything unknown (or missing, as in every pre-existing config) falls back to the paper plane. */
export function asSendIcon(v: unknown): SendIconName {
  return (SEND_ICONS as readonly string[]).includes(v as string) ? (v as SendIconName) : 'default'
}

/**
 * The glyph itself. `rtl:-scale-x-100` mirrors only the horizontal arrows — the
 * upward ones point the same way in both reading directions. A custom upload is
 * drawn as-is; with no URL yet it falls back to the paper plane so the button is
 * never empty while a designer is still picking the file.
 */
export function SendIcon({ name, url, className = '', style }: { name: SendIconName; url?: string; className?: string; style?: CSSProperties }) {
  if (name === 'custom') {
    return url?.trim() ? <img src={url} alt="" className={`${className} object-contain`} style={style} /> : <SendHorizontal className={`${className} rtl:-scale-x-100`} style={style} />
  }
  if (name === 'default') return <SendHorizontal className={`${className} rtl:-scale-x-100`} style={style} />
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className}${name === 'cinescape-right' ? ' rtl:-scale-x-100' : ''}`}
      style={style}
      fill="currentColor"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
