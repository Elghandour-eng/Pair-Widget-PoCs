import { describe, expect, it } from 'vitest'
import {
  BRAND_TOKEN,
  CHAT_INPUT_DEFAULTS,
  actionCss,
  focusCss,
  hoverCss,
  inputCss,
  launcherCss,
  launcherHoverCss,
  loadingCss,
  normalizeChatInput,
  normalizeLauncher,
  normalizeLoading,
  normalizeToast,
  placeholderCss,
  resolve,
  sendCss,
  shadowCss,
  textCss,
  toastCss,
} from './inputDesign.js'

const BRAND = '#E30613'

describe('colour handling', () => {
  it('keeps hex, the brand token and transparent, and rejects anything else', () => {
    const d = normalizeChatInput({
      field: { background: '#abc', borderColor: 'transparent' },
      send: { background: BRAND_TOKEN },
      actions: { iconColor: 'red; content: "x"' },
    })
    expect(d.field.background).toBe('#abc')
    expect(d.field.borderColor).toBe('transparent')
    expect(d.send.background).toBe(BRAND_TOKEN)
    // Not a literal colour, so it falls back rather than reaching a style attribute.
    expect(d.actions.iconColor).toBe(CHAT_INPUT_DEFAULTS.actions.iconColor)
  })

  it('resolves the brand token only where a brand is known', () => {
    expect(resolve(BRAND_TOKEN, BRAND)).toBe(BRAND)
    expect(resolve('#123456', BRAND)).toBe('#123456')
  })
})

describe('normalizeChatInput', () => {
  it('fills everything from defaults when given nothing', () => {
    const d = normalizeChatInput(undefined)
    expect(d.layout).toBe('floating_pill')
    expect(d.field.radius).toBe(999)
    expect(d.actions.voice).toBe(true)
  })

  it('clamps numbers into range instead of trusting them', () => {
    const d = normalizeChatInput({
      field: { radius: 99999, borderWidth: -4, minHeight: 2 },
      send: { size: 500, disabledOpacity: 8 },
    })
    expect(d.field.radius).toBe(999)
    expect(d.field.borderWidth).toBe(0)
    expect(d.field.minHeight).toBe(28)
    expect(d.send.size).toBe(72)
    expect(d.send.disabledOpacity).toBe(1)
  })

  it('falls back on a choice it does not recognise', () => {
    const d = normalizeChatInput({ layout: 'hologram', send: { shape: 'blob' }, direction: 'sideways' })
    expect(d.layout).toBe('floating_pill')
    expect(d.send.shape).toBe('circle')
    expect(d.direction).toBe('auto')
  })

  it('rejects a font stack that is not a plain family list', () => {
    expect(normalizeChatInput({ text: { fontFamily: "'Jost', sans-serif" } }).text.fontFamily).toBe("'Jost', sans-serif")
    expect(normalizeChatInput({ text: { fontFamily: 'a;}(){' } }).text.fontFamily).toBe('')
  })

  it('keeps each action icon and its upload side by side', () => {
    const d = normalizeChatInput({ actions: { voiceIcon: 'custom', voiceUrl: '/u/mic.svg' } })
    expect(d.actions.voiceIcon).toBe('custom')
    expect(d.actions.voiceUrl).toBe('/u/mic.svg')
    // Switching the glyph must not be what loses the upload.
    expect(normalizeChatInput({ actions: { voiceIcon: 'mic', voiceUrl: '/u/mic.svg' } }).actions.voiceUrl).toBe('/u/mic.svg')
  })
})

describe('compiling to what the widget reads', () => {
  it('turns the field into the CSS blob the widget spreads on the composer', () => {
    const d = normalizeChatInput({ field: { background: '#101010', radius: 12, paddingX: 8, paddingY: 4 } })
    expect(inputCss(d, BRAND)).toMatchObject({
      backgroundColor: '#101010',
      borderRadius: '12px',
      padding: '4px 8px',
    })
  })

  it('resolves the brand token while compiling', () => {
    const d = normalizeChatInput({ send: { background: BRAND_TOKEN } })
    expect(sendCss(d, BRAND).backgroundColor).toBe(BRAND)
    expect(sendCss(d, BRAND).iconColor).toBe('#FFFFFF')
  })

  it('gives a circle a full radius whatever the radius value says', () => {
    const circle = normalizeChatInput({ send: { shape: 'circle', radius: 4 } })
    const square = normalizeChatInput({ send: { shape: 'square', radius: 40 } })
    const rounded = normalizeChatInput({ send: { shape: 'rounded', radius: 10 } })
    expect(sendCss(circle, BRAND).borderRadius).toBe('999px')
    expect(sendCss(square, BRAND).borderRadius).toBe('0px')
    expect(sendCss(rounded, BRAND).borderRadius).toBe('10px')
  })

  it('folds opacity into the shadow colour', () => {
    const css = shadowCss({ size: 10, y: 4, blur: 12, color: '#000000', opacity: 0.5 }, BRAND)
    expect(css).toBe('0 4px 12px 0 #00000080')
  })

  it('drops the shadow entirely at zero', () => {
    expect(shadowCss({ size: 0, y: 0, blur: 0, color: '#000000', opacity: 0.5 }, BRAND)).toBe('none')
  })

  it('writes the placeholder and typed-text rules separately', () => {
    const d = normalizeChatInput({
      placeholder: { color: '#999999', size: 12, italic: true },
      text: { color: '#111111', size: 15 },
    })
    expect(placeholderCss(d, BRAND)).toMatchObject({ color: '#999999', fontSize: '12px', fontStyle: 'italic' })
    expect(textCss(d, BRAND)).toMatchObject({ color: '#111111', fontSize: '15px' })
  })

  it('emits focus and hover as rules, since inline style cannot express them', () => {
    const d = normalizeChatInput({ field: { focusRingWidth: 4, focusRingColor: BRAND_TOKEN, focusRingOpacity: 1 } })
    const css = focusCss(d, BRAND, '.x')
    expect(css).toContain('.x:focus-within')
    expect(css).toContain(`0 0 0 4px ${BRAND}ff`)

    const withHover = normalizeChatInput({ send: { hoverBackground: '#222222' }, actions: { hoverBackground: '#333333' } })
    const hover = hoverCss(withHover, BRAND, '.s', '.a')
    expect(hover).toContain('.s:hover{background-color:#222222}')
    expect(hover).toContain('.a:hover{background-color:#333333}')
  })

  it('omits a hover rule that was never set', () => {
    // Send has no default hover; the action buttons keep the widget's own.
    const css = hoverCss(normalizeChatInput({}), BRAND, '.s', '.a')
    expect(css).not.toContain('.s:hover')
    expect(css).toContain('.a:hover')
    // A transparent action hover is "no hover", not a rule painting transparent.
    expect(hoverCss(normalizeChatInput({ actions: { hoverBackground: 'transparent' } }), BRAND, '.s', '.a')).toBe('')
  })

  it('sizes action buttons from the config', () => {
    const d = normalizeChatInput({ actions: { size: 44, iconColor: '#445566' } })
    expect(actionCss(d, BRAND)).toMatchObject({ width: '44px', height: '44px', color: '#445566' })
  })
})

describe('normalizeLauncher', () => {
  it('defaults to a brand-coloured bubble in the bottom-right', () => {
    const d = normalizeLauncher(undefined)
    expect(d).toMatchObject({ position: 'right', size: 56, icon: 'bubble', background: BRAND_TOKEN })
  })

  it('compiles a gradient only when one was asked for', () => {
    const flat = normalizeLauncher({ background: '#123456' })
    expect(launcherCss(flat, BRAND).background).toBe('#123456')

    const grad = normalizeLauncher({ useGradient: true, background: '#123456', gradientTo: '#654321', gradientAngle: 90 })
    expect(launcherCss(grad, BRAND).background).toBe('linear-gradient(90deg, #123456, #654321)')
  })

  it('only emits a hover rule when it would actually grow', () => {
    expect(launcherHoverCss(normalizeLauncher({ hoverScale: 1 }), '.l')).toBe('')
    expect(launcherHoverCss(normalizeLauncher({ hoverScale: 1.1 }), '.l')).toContain('scale(1.1)')
  })
})

describe('normalizeLoading', () => {
  it('defaults to the shimmer skeleton', () => {
    expect(normalizeLoading(undefined)).toMatchObject({ type: 'shimmer', lines: 3, cards: 3 })
  })

  it('allows a skeleton with no bars or no cards', () => {
    const d = normalizeLoading({ lines: 0, cards: 0 })
    expect(d.lines).toBe(0)
    expect(d.cards).toBe(0)
  })

  it('passes colours and speed as custom properties rather than a keyframe per channel', () => {
    const d = normalizeLoading({ baseColor: '#111111', highlightColor: '#222222', speedMs: 900, radius: 8 })
    expect(loadingCss(d, BRAND)).toEqual({
      '--pair-skel-base': '#111111',
      '--pair-skel-hi': '#222222',
      '--pair-skel-speed': '900ms',
      '--pair-skel-radius': '8px',
    })
  })
})

describe('normalizeToast', () => {
  it('defaults to the bottom centre rather than over the conversation', () => {
    expect(normalizeToast(undefined)).toMatchObject({ position: 'bottom-center', offset: 16, durationMs: 3000 })
  })

  it('clamps how long it stays', () => {
    expect(normalizeToast({ durationMs: 1 }).durationMs).toBe(800)
    expect(normalizeToast({ durationMs: 999999 }).durationMs).toBe(15000)
  })

  it('compiles the box, leaving width off unless it should stretch', () => {
    const narrow = normalizeToast({ background: '#101010', textColor: '#FFFFFF', radius: 8 })
    expect(toastCss(narrow, BRAND)).toMatchObject({ background: '#101010', color: '#FFFFFF', borderRadius: '8px' })
    expect(toastCss(narrow, BRAND).width).toBeUndefined()
    expect(toastCss(normalizeToast({ fullWidth: true }), BRAND).width).toBe('100%')
  })

  it('only draws a border when one was asked for', () => {
    expect(toastCss(normalizeToast({}), BRAND).borderStyle).toBeUndefined()
    expect(toastCss(normalizeToast({ borderWidth: 2 }), BRAND).borderStyle).toBe('solid')
  })
})
