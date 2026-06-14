/**
 * Helper to race a promise against a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))])
}

/**
 * Dynamically loads a single font family from Google Fonts and returns a Promise that resolves when loaded or failed.
 */
export function loadFontFamilyAsync(fontFamily?: string): Promise<void> {
  if (!fontFamily || typeof window === 'undefined') return Promise.resolve()

  // Normalize common lowercase fonts to their exact Google Fonts casing
  const commonFontsMap: Record<string, string> = {
    inter: 'Inter',
    'dm sans': 'DM Sans',
    'pt sans': 'PT Sans',
    'pt serif': 'PT Serif',
    'open sans': 'Open Sans',
    roboto: 'Roboto',
    lato: 'Lato',
    montserrat: 'Montserrat',
    'source sans pro': 'Source Sans Pro',
    'playfair display': 'Playfair Display',
    merriweather: 'Merriweather',
    'noto sans': 'Noto Sans',
    'noto serif': 'Noto Serif',
    oswald: 'Oswald',
    raleway: 'Raleway',
    poppins: 'Poppins',
    nunito: 'Nunito',
    ubuntu: 'Ubuntu',
    lora: 'Lora',
    quicksand: 'Quicksand',
    outfit: 'Outfit',
  }

  // Extract the primary font name (e.g. "Outfit" from "Outfit, sans-serif")
  const rawPrimary = fontFamily.split(',')[0].replace(/['"]/g, '').trim()
  const lowercaseName = rawPrimary.toLowerCase()

  const primaryFont =
    commonFontsMap[lowercaseName] ||
    rawPrimary
      .split(/\s+/)
      .map((word) => {
        if (!word) return ''
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(' ')

  // Standard web-safe/system fonts that do not require loading
  const webSafeFonts = new Set([
    'default',
    'arial',
    'helvetica',
    'system-ui',
    '-apple-system',
    'blinkmacsystemfont',
    'segoe ui',
    'roboto',
    'sans-serif',
    'serif',
    'monospace',
    'times new roman',
    'times',
    'courier new',
    'georgia',
    'palatino',
    'comic sans ms',
    'trebuchet ms',
  ])

  if (webSafeFonts.has(primaryFont.toLowerCase())) return Promise.resolve()

  const fontId = `google-font-${primaryFont.toLowerCase().replace(/\s+/g, '-')}`
  if (document.getElementById(fontId)) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@300;400;500;600;700&display=swap`

    link.onload = () => resolve()
    link.onerror = () => {
      console.warn(`[FontLoader] Failed to load font: ${primaryFont}`)
      resolve()
    }

    document.head.appendChild(link)
  })
}

/**
 * Dynamically loads a single font family synchronously (background load).
 */
export function loadFontFamily(fontFamily?: string): void {
  loadFontFamilyAsync(fontFamily).catch(() => {})
}

/**
 * Recursively scans an object for any key matching 'fontFamily' (case-insensitive) and collects its values.
 */
function extractFontFamilies(obj: any, fontFamilies: Set<string>): void {
  if (!obj || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractFontFamilies(item, fontFamilies)
    }
    return
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key]

      // Match 'fontFamily', 'font-family', 'fontfamily' (case-insensitive)
      if (key.toLowerCase().replace(/[^a-z]/g, '') === 'fontfamily' && typeof val === 'string' && val) {
        fontFamilies.add(val)
      } else if (val && typeof val === 'object') {
        extractFontFamilies(val, fontFamilies)
      }
    }
  }
}

/**
 * Scans the config response or mapped object dynamically for any nested 'fontFamily' key,
 * loads all configured fonts, and resolves when all fonts have successfully loaded or timed out (1.5 seconds max).
 */
export async function loadAllFontsFromConfigAsync(config?: any): Promise<void> {
  if (!config) return

  const fontFamilies = new Set<string>()
  extractFontFamilies(config, fontFamilies)

  const loadPromises: Promise<void>[] = []
  fontFamilies.forEach((font) => {
    loadPromises.push(loadFontFamilyAsync(font))
  })

  if (loadPromises.length > 0) {
    // Set a timeout of 1.5s so we don't block the widget initialization indefinitely if the connection is slow
    await withTimeout(Promise.all(loadPromises), 1500)
  }
}

/**
 * Scans the config and loads all configured fonts (background load).
 */
export function loadAllFontsFromConfig(config?: any): void {
  loadAllFontsFromConfigAsync(config).catch(() => {})
}
