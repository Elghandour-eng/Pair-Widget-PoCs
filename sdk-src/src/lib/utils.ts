import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** True when a config background reads as dark, the way the studio judges it. */
export function isDarkBackground(input: string | undefined): boolean {
  if (!input) return false
  const m = /#([0-9a-f]{6})/i.exec(input)
  if (!m) return /black|#000|rgb\(0/i.test(input)
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

/**
 * A hex colour with an alpha, for focus rings and overlays; non-hex passes
 * through. Takes #RGB, #RRGGBB and #RRGGBBAA; a colour that carries its own
 * alpha has it multiplied by the one asked for.
 */
export function hexToRgba(input: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim())
  if (!m) return input
  const hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
  const n = parseInt(hex.slice(0, 6), 16)
  const own = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * own * 1000) / 1000})`
}
