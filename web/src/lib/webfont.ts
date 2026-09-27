import { useEffect } from 'react'

/**
 * Font stacks offered in the builder. The Arabic-capable families are listed
 * first because most channels here ship Arabic copy; `custom` lets a channel
 * paste any stack its own site already loads.
 */
export const FONT_PRESETS: { value: string; label: string }[] = [
  { value: "'Noto Kufi Arabic', 'Jost', Futura, sans-serif", label: 'Noto Kufi Arabic + Jost' },
  { value: "'Jost', Futura, 'Century Gothic', sans-serif", label: 'Jost' },
  { value: "'Cairo', sans-serif", label: 'Cairo' },
  { value: "'Tajawal', sans-serif", label: 'Tajawal' },
  { value: "'Almarai', sans-serif", label: 'Almarai' },
  { value: "'IBM Plex Sans Arabic', sans-serif", label: 'IBM Plex Sans Arabic' },
  { value: "'Noto Sans Arabic', sans-serif", label: 'Noto Sans Arabic' },
  { value: "'Readex Pro', sans-serif", label: 'Readex Pro' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: 'system-ui, -apple-system, Segoe UI, sans-serif', label: 'System default' },
]

/** Families we are willing to pull from Google Fonts, so a stack cannot inject an arbitrary request. */
const GOOGLE_FAMILIES = new Set([
  'Noto Kufi Arabic',
  'Noto Sans Arabic',
  'Jost',
  'Cairo',
  'Tajawal',
  'Almarai',
  'IBM Plex Sans Arabic',
  'Readex Pro',
  'Inter',
  'Montserrat',
  'Poppins',
])

const loaded = new Set<string>()

/** The families named in a CSS font stack, quotes stripped, in order. */
export function familiesIn(stack: unknown): string[] {
  if (typeof stack !== 'string') return []
  return stack
    .split(',')
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/**
 * Loads the config's font so the preview shows the real thing rather than a
 * fallback. Injected links are kept (never removed) and deduped by family, so
 * typing through a stack does not thrash the document head.
 */
export function useWebFont(stack: unknown) {
  useEffect(() => {
    for (const family of familiesIn(stack)) {
      if (!GOOGLE_FAMILIES.has(family) || loaded.has(family)) continue
      loaded.add(family)
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
      document.head.appendChild(link)
    }
  }, [stack])
}
