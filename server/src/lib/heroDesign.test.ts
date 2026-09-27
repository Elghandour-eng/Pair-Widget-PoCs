import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  HERO_ART_H,
  HERO_ART_W,
  HERO_PRESETS,
  buildHeroSvg,
  normalizeHeroCarousel,
  normalizeHeroDesign,
  normalizeHeroSlide,
  normalizeHeroSlides,
  wrapHeroText,
} from './heroDesign.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const svgOf = (design: Parameters<typeof buildHeroSvg>[0], rtl = false) =>
  buildHeroSvg(design, { uid: 'u1', patternHref: (f) => `/${f}.png`, rtl, brand: '#E30613' })

describe('heroDesign is mirrored between the two workspaces', () => {
  // The server workspace cannot import from web/, so the module is duplicated.
  // This is the guard that the copies never drift.
  it.each(['heroDesign.ts', 'inputDesign.ts'])('server/src/lib/%s is byte-identical to the web copy', (file) => {
    const mine = readFileSync(path.join(here, file))
    const theirs = readFileSync(path.resolve(here, `../../../web/src/lib/${file}`))
    expect(theirs.equals(mine)).toBe(true)
  })
})

describe('normalizeHeroDesign', () => {
  it('fills everything from defaults when given nothing', () => {
    const d = normalizeHeroDesign(undefined)
    expect(d.layout).toBe('text-left')
    expect(d.background.color).toBe('#000000')
    expect(d.pattern.asset).toBe('none')
  })

  it('rejects values that would land in the markup unescaped', () => {
    const d = normalizeHeroDesign({
      background: { color: '" onload="alert(1)' },
      pattern: { asset: 'javascript:x', opacity: 99, scale: -5 },
      decor: { shape: 'nope' },
    })
    expect(d.background.color).toBe('#000000')
    expect(d.pattern.asset).toBe('none')
    expect(d.pattern.opacity).toBe(1)
    expect(d.pattern.scale).toBe(0.25)
    expect(d.decor.shape).toBe('none')
  })

  it('keeps valid values and clamps numbers into range', () => {
    const d = normalizeHeroDesign({
      layout: 'text-center',
      background: { type: 'gradient', from: '#112233', to: '#445566', angle: 400 },
      title: { show: true, text: 'Hi', color: '#fff', size: 999 },
    })
    expect(d.layout).toBe('text-center')
    expect(d.background.from).toBe('#112233')
    expect(d.background.angle).toBe(360)
    expect(d.title.size).toBe(48)
    expect(d.title.color).toBe('#fff')
  })
})

describe('normalizeHeroSlide', () => {
  it('reads a design slide', () => {
    const s = normalizeHeroSlide({ type: 'design', design: { background: { color: '#123456' } } })
    expect(s).toMatchObject({ type: 'design' })
    expect(s?.type === 'design' && s.design.background.color).toBe('#123456')
  })

  it('migrates a legacy style id to that preset', () => {
    const s = normalizeHeroSlide({ style: 'sadu-night' })
    expect(s?.type).toBe('design')
    expect(s?.type === 'design' && s.design.pattern.asset).toBe('sadu')
  })

  it('reads an image slide, as an object or a bare string', () => {
    expect(normalizeHeroSlide({ url: '/a.png' })).toEqual({ type: 'image', url: '/a.png' })
    expect(normalizeHeroSlide('/b.png')).toEqual({ type: 'image', url: '/b.png' })
  })

  it('drops empty entries', () => {
    expect(normalizeHeroSlide({ url: '   ' })).toBeNull()
    expect(normalizeHeroSlide('')).toBeNull()
    expect(normalizeHeroSlide(null)).toBeNull()
    expect(normalizeHeroSlides(['', { url: '/a.png' }, null])).toHaveLength(1)
  })
})

describe('normalizeHeroCarousel', () => {
  it('defaults to a 3.5s autoplaying fade with brand-coloured pill dots', () => {
    const c = normalizeHeroCarousel(undefined)
    expect(c).toMatchObject({ autoplay: true, intervalMs: 3500, transition: 'fade' })
    expect(c.dots).toMatchObject({ show: true, shape: 'pill', size: 5, activeWidth: 16 })
  })

  it('keeps the brand token and clamps the interval', () => {
    const c = normalizeHeroCarousel({ intervalMs: 5, dots: { activeColor: '#brand', inactiveColor: '#fff', size: 400 } })
    expect(c.intervalMs).toBe(800)
    expect(c.dots.activeColor).toBe('#brand')
    expect(c.dots.inactiveColor).toBe('#fff')
    expect(c.dots.size).toBe(20)
  })
})

describe('wrapHeroText', () => {
  it('reproduces the design references own line breaks', () => {
    // Both taken from the Cinescape channel's first slide, at its sizes.
    expect(wrapHeroText('What’s showing tonight?', 180, 24, 3)).toEqual(['What’s showing', 'tonight?'])
    expect(wrapHeroText('Ask me for films, times and formats.', 195, 13, 2)).toEqual([
      'Ask me for films, times and',
      'formats.',
    ])
  })

  it('ellipsises past the line budget instead of overflowing the artboard', () => {
    const lines = wrapHeroText('one two three four five six seven eight nine ten', 100, 20, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })
})

describe('buildHeroSvg', () => {
  it('renders every preset as well-formed, self-contained SVG', () => {
    for (const [id, preset] of Object.entries(HERO_PRESETS)) {
      const svg = svgOf(preset.design)
      expect(svg.startsWith('<svg'), id).toBe(true)
      expect(svg.endsWith('</svg>'), id).toBe(true)
      expect(svg).toContain(`viewBox="0 0 ${HERO_ART_W} ${HERO_ART_H}"`)
      // Nothing may be fetched at render time beyond the tile the caller resolved.
      expect(svg, id).not.toMatch(/href="(?!\/|data:)/)
      expect(svg.match(/<svg/g), id).toHaveLength(1)
    }
  })

  it('scopes ids and keyframes to the uid, so inlined slides cannot collide', () => {
    const a = buildHeroSvg(HERO_PRESETS['sadu-night'].design, { uid: 'aa', patternHref: (f) => `/${f}.png` })
    const b = buildHeroSvg(HERO_PRESETS['sadu-night'].design, { uid: 'bb', patternHref: (f) => `/${f}.png` })
    expect(a).toContain('id="aam"')
    expect(a).toContain('@keyframes aap')
    expect(b).not.toContain('aa')
  })

  it('escapes copy rather than letting it close a tag', () => {
    const design = normalizeHeroDesign({
      title: { show: true, text: '</text><script>x</script>' },
      badge: { show: true, text: 'a&b' },
    })
    const svg = svgOf(design)
    expect(svg).not.toContain('<script')
    expect(svg).toContain('&lt;/text&gt;&lt;script&gt;x&lt;/script&gt;')
    expect(svg).toContain('A&amp;B')
  })

  it('drops all animation when asked to be still', () => {
    const svg = buildHeroSvg(HERO_PRESETS['sadu-night'].design, {
      uid: 'u1',
      patternHref: (f) => `/${f}.png`,
      still: true,
    })
    expect(svg).not.toContain('@keyframes')
    expect(svg).not.toContain('<style>')
  })

  it('omits the pattern layer when the caller cannot supply the tile', () => {
    const svg = buildHeroSvg(HERO_PRESETS['sadu-night'].design, { uid: 'u1', patternHref: () => null })
    expect(svg).not.toContain('<pattern')
    expect(svg).not.toContain('<mask')
  })

  it('mirrors the art in RTL and lays the copy out from the right', () => {
    const design = normalizeHeroDesign({ ...HERO_PRESETS['cinescape-night'].design })
    const rtl = svgOf(design, true)
    expect(rtl).toContain(`translate(${HERO_ART_W} 0) scale(-1 1)`)
    expect(rtl).toContain('text-anchor="end"')
    expect(svgOf(design, false)).not.toContain('scale(-1 1)')
  })

  it('clips the pattern to the decoration when the design asks for a window', () => {
    const svg = svgOf(HERO_PRESETS['cinescape-night'].design)
    expect(svg).toContain('<clipPath id="u1c"')
    expect(svg).toContain('clip-path="url(#u1c)"')
  })

  it('drifts the masked group, so the pattern moves rather than the flat fill', () => {
    const svg = svgOf(HERO_PRESETS['sadu-night'].design)
    expect(svg).toMatch(/<g class="pd" mask="url\(#u1m\)"/)
    expect(svg).toContain('#u1 .pd{animation:u1p')
  })
})
