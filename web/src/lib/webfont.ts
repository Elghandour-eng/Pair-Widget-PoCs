import { useEffect } from 'react'

/**
 * Font stacks offered in the builder. The Arabic-capable families are listed
 * first because most channels here ship Arabic copy; `custom` lets a channel
 * paste any stack its own site already loads.
 */
export const FONT_PRESETS: { value: string; label: string }[] = [
  // Arabic-capable first: most channels here ship Arabic copy.
  { value: "'Noto Kufi Arabic', 'Jost', Futura, sans-serif", label: 'Noto Kufi Arabic + Jost' },
  { value: "'IBM Plex Sans Arabic', sans-serif", label: 'IBM Plex Sans Arabic' },
  { value: "'Cairo', sans-serif", label: 'Cairo' },
  { value: "'Tajawal', sans-serif", label: 'Tajawal' },
  { value: "'Almarai', sans-serif", label: 'Almarai' },
  { value: "'Readex Pro', sans-serif", label: 'Readex Pro' },
  { value: "'Alexandria', sans-serif", label: 'Alexandria' },
  { value: "'Noto Sans Arabic', sans-serif", label: 'Noto Sans Arabic' },
  { value: "'Changa', sans-serif", label: 'Changa' },
  { value: "'El Messiri', sans-serif", label: 'El Messiri' },
  { value: "'Baloo Bhaijaan 2', sans-serif", label: 'Baloo Bhaijaan 2' },
  // Latin sans
  { value: "'Jost', Futura, 'Century Gothic', sans-serif", label: 'Jost' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'DM Sans', sans-serif", label: 'DM Sans' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Manrope', sans-serif", label: 'Manrope' },
  { value: "'Outfit', sans-serif", label: 'Outfit' },
  { value: "'Plus Jakarta Sans', sans-serif", label: 'Plus Jakarta Sans' },
  { value: "'Figtree', sans-serif", label: 'Figtree' },
  { value: "'Work Sans', sans-serif", label: 'Work Sans' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  // Display, serif, mono
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Sora', sans-serif", label: 'Sora' },
  { value: "'Playfair Display', Georgia, serif", label: 'Playfair Display' },
  { value: "'Lora', Georgia, serif", label: 'Lora' },
  { value: "'Merriweather', Georgia, serif", label: 'Merriweather' },
  { value: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono' },
  { value: "'IBM Plex Mono', ui-monospace, monospace", label: 'IBM Plex Mono' },
  { value: 'system-ui, -apple-system, Segoe UI, sans-serif', label: 'System default' },
]

/** Families we are willing to pull from Google Fonts, so a stack cannot inject an arbitrary request. */
const GOOGLE_FAMILIES = new Set([
  'Noto Kufi Arabic', 'Noto Sans Arabic', 'IBM Plex Sans Arabic', 'Cairo', 'Tajawal', 'Almarai',
  'Readex Pro', 'Alexandria', 'Changa', 'El Messiri', 'Baloo Bhaijaan 2',
  'Jost', 'Inter', 'DM Sans', 'Poppins', 'Manrope', 'Outfit', 'Plus Jakarta Sans', 'Figtree',
  'Work Sans', 'Nunito', 'Montserrat', 'Lato', 'Open Sans', 'Roboto', 'Space Grotesk', 'Sora',
  'Playfair Display', 'Lora', 'Merriweather', 'JetBrains Mono', 'IBM Plex Mono',
])

/**
 * Weights to request per family, where the family does not publish the default
 * set. The css2 API rejects the whole request for a weight a family lacks, so
 * asking for 500 from Lato loses Lato altogether rather than just that weight.
 */
const FAMILY_WEIGHTS: Record<string, string> = {
  Lato: '400;700;900',
  Merriweather: '400;700;900',
  Almarai: '400;700;800',
  Tajawal: '400;500;700;800',
  'Space Grotesk': '400;500;600;700',
}
const DEFAULT_WEIGHTS = '400;500;600;700;800'

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
      const weights = FAMILY_WEIGHTS[family] ?? DEFAULT_WEIGHTS
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights}&display=swap`
      document.head.appendChild(link)
    }
  }, [stack])
}
