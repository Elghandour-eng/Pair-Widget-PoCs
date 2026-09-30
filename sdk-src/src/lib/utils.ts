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

/** A hex colour with an alpha, for focus rings and overlays; non-hex passes through. */
export function hexToRgba(input: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return input
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
