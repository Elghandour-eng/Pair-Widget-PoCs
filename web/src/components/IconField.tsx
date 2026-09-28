import type { CSSProperties, ReactElement } from 'react'
import {
  ArrowUp, BookA, Bot, Captions, Check, ChevronLeft, ChevronUp, CircleAlert, CircleHelp, Clapperboard,
  Contrast, Copy, Earth, Eclipse, Ellipsis, FileText, Globe, Heart, Image as ImageIcon, Info, Languages,
  Lightbulb, Lock, MessageSquareText, Mic, Moon, MoonStar, Paperclip, Palette, Phone, Plus, Popcorn,
  Search, SendHorizontal, ShieldCheck, Smile, Sparkles, Speech, Star, Sun, SunDim, SunMoon, ThumbsDown,
  ThumbsUp, Ticket, Utensils, Volume2, X, type LucideIcon,
} from 'lucide-react'
import { MediaInput } from './MediaInput'
import { Select } from './Select'
import { useI18n, type MsgKey } from '@/lib/i18n'

/**
 * Icon slots, and the one control that fills them.
 *
 * Every icon in the widget is either one of the glyphs below or an image the
 * channel uploads — the builder should not be the reason a brand cannot use its
 * own mark. A slot stores two fields, `icon` (a glyph name, or `custom`) and
 * `url`, so switching back and forth does not lose the upload.
 */

/** The brand chevron from the Cinescape references, drawn rather than fetched. */
function CineChevron({ className, style, turns = 0 }: { className?: string; style?: CSSProperties; turns?: number }) {
  return (
    <svg viewBox="0 0 547 475" className={className} style={{ ...style, transform: turns ? `rotate(${turns}deg)` : undefined }} aria-hidden>
      <path d="M547 0.1L0 237.3L547 474.4V399.1L164.6 237.3L547 75.4Z" fill="currentColor" />
    </svg>
  )
}

const CineRight = (p: { className?: string; style?: CSSProperties }) => <CineChevron {...p} turns={180} />
const CineUp = (p: { className?: string; style?: CSSProperties }) => <CineChevron {...p} turns={90} />

type Glyph = LucideIcon | ((p: { className?: string; style?: CSSProperties }) => ReactElement)

/** Every glyph the builder can offer, by name. Names are what the config stores. */
export const GLYPHS: Record<string, Glyph> = {
  send: SendHorizontal, 'arrow-up': ArrowUp, 'chevron-up': ChevronUp, 'chevron-left': ChevronLeft,
  'cine-right': CineRight, 'cine-up': CineUp,
  mic: Mic, volume: Volume2, paperclip: Paperclip, plus: Plus, image: ImageIcon, smile: Smile,
  bubble: Bot, chat: Ellipsis, spark: Sparkles, star: Star, heart: Heart, help: CircleHelp,
  search: Search, phone: Phone, ticket: Ticket, popcorn: Popcorn, film: Clapperboard, food: Utensils,
  'thumbs-up': ThumbsUp, 'thumbs-down': ThumbsDown, copy: Copy, check: Check, close: X, menu: Ellipsis,
  globe: Globe, languages: Languages, earth: Earth, speech: Speech, captions: Captions, 'book-a': BookA,
  moon: Moon, sun: Sun, 'sun-moon': SunMoon, 'moon-star': MoonStar, eclipse: Eclipse, contrast: Contrast,
  'sun-dim': SunDim, lightbulb: Lightbulb, palette: Palette,
  info: Info, alert: CircleAlert, shield: ShieldCheck, lock: Lock, doc: FileText, 'chat-text': MessageSquareText,
}

/** The glyphs offered per slot, so a send button is not offered a popcorn cup. */
export const ICON_SETS = {
  send: ['send', 'arrow-up', 'chevron-up', 'cine-right', 'cine-up'],
  voice: ['mic', 'volume'],
  attach: ['paperclip', 'plus', 'image'],
  emoji: ['smile', 'spark'],
  launcher: ['bubble', 'chat', 'spark', 'chevron-up', 'cine-up', 'star', 'heart', 'help'],
  header: ['menu', 'close', 'chevron-left'],
  card: ['film', 'food', 'ticket', 'popcorn', 'phone', 'help', 'search', 'star'],
  feedback: ['thumbs-up', 'thumbs-down', 'copy', 'check'],
  lang: ['badge', 'globe', 'languages', 'earth', 'speech', 'captions', 'book-a'],
  theme: ['moon', 'sun', 'sun-moon', 'moon-star', 'eclipse', 'contrast', 'sun-dim', 'lightbulb', 'palette'],
  consent: ['info', 'alert', 'shield', 'lock', 'doc', 'chat-text', 'spark', 'thumbs-up', 'star', 'help'],
} as const

export type IconSet = keyof typeof ICON_SETS

/** Renders a slot's current value: a drawn glyph, or the uploaded image. */
export function SlotIcon({
  name,
  url,
  size,
  color,
  className = '',
}: {
  name: string | undefined
  url?: string
  size?: number
  color?: string
  className?: string
}) {
  const style: CSSProperties = { width: size, height: size, color }
  if (name === 'custom') {
    return url ? <img src={url} alt="" className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} /> : null
  }
  if (name === 'none') return null
  // The عربي / EN language badge is text, not a drawing.
  if (name === 'badge') {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-sm font-bold ${className}`}
        style={{ minWidth: size, height: size, color, fontSize: (size ?? 14) * 0.62, padding: '0 2px', background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
      >
        ع
      </span>
    )
  }
  const Glyph = GLYPHS[name ?? '']
  if (!Glyph) return null
  return <Glyph className={`shrink-0 ${className}`} style={style} />
}

/**
 * One icon slot: pick a glyph, or upload an image. `path` addresses the glyph
 * name; the upload is stored next to it under `urlPath`.
 */
export function IconField({
  label,
  set: setName,
  path,
  urlPath,
  value,
  url,
  onChange,
  onUrlChange,
  disabled,
  allowNone,
}: {
  label: string
  set: IconSet
  path?: string
  urlPath?: string
  value: string | undefined
  url: string | undefined
  onChange: (v: string) => void
  onUrlChange: (v: string) => void
  disabled?: boolean
  allowNone?: boolean
}) {
  const { t } = useI18n()
  const names: string[] = [...ICON_SETS[setName]]
  const current = value && (names.includes(value) || value === 'custom' || value === 'none') ? value : names[0]
  void path
  void urlPath

  return (
    <>
      <div>
        <label className="label">{label}</label>
        <Select
          label={label}
          value={current}
          onChange={onChange}
          disabled={disabled}
          options={[
            ...names.map((name) => ({
              value: name,
              label: t(`icon.${name}` as MsgKey),
              icon: <SlotIcon name={name} size={14} />,
            })),
            ...(allowNone ? [{ value: 'none', label: t('icon.none') }] : []),
            { value: 'custom', label: t('icon.custom') },
          ]}
        />
      </div>
      {current === 'custom' && (
        <div className="sm:col-span-2">
          <MediaInput label={t('icon.upload')} value={url ?? ''} onChange={onUrlChange} disabled={disabled} />
        </div>
      )}
    </>
  )
}
