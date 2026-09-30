import { useState } from 'react'

import {
  CircleAlert,
  CircleHelp,
  FileText,
  Info,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
} from 'lucide-react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { hexToRgba } from '@/lib/utils'
import { getWidgetId } from '@/utils/widget-id'

/**
 * The welcome / consent sheet: shown over the widget on first open, with a
 * short welcome, a few "things to keep in mind" and one agree button. Nothing
 * behind it is usable until it is accepted; the acceptance is kept per widget,
 * per visitor.
 */

const POINT_GLYPHS = {
  info: Info,
  alert: CircleAlert,
  'chat-text': MessageSquareText,
  shield: ShieldCheck,
  lock: Lock,
  spark: Sparkles,
  doc: FileText,
  'thumbs-up': ThumbsUp,
  star: Star,
  help: CircleHelp,
} as const

const consentKey = (widgetId: string | null) => `pair_widget_consent_${widgetId ?? ''}`

function hasAccepted(widgetId: string | null): boolean {
  try {
    return localStorage.getItem(consentKey(widgetId)) === '1'
  } catch {
    return false
  }
}

export function ConsentGate() {
  const { widgetConfig } = useWidgetConfigContext()
  const widgetId = getWidgetId()
  const [accepted, setAccepted] = useState(() => hasAccepted(widgetId))

  const cs = widgetConfig.consentScreen
  if (!cs?.enabled || accepted) return null

  const d = cs.design ?? {}
  const brand = widgetConfig.primaryColor
  const rs = (c?: string) => (c === '#brand' ? brand : c)

  const agree = () => {
    try {
      localStorage.setItem(consentKey(widgetId), '1')
    } catch {
      // Private mode: the gate stays dismissed for this load.
    }
    setAccepted(true)
  }

  const points = cs.points ?? []
  const cardShadow = d.card?.shadow
    ? `0 ${d.card.shadow.y ?? 10}px ${d.card.shadow.blur ?? 40}px ${hexToRgba(rs(d.card.shadow.color) ?? '#000000', d.card.shadow.opacity ?? 0.2)}`
    : undefined

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center p-4"
      style={{ background: hexToRgba(rs(d.overlayColor) ?? '#000000', d.overlayOpacity ?? 0.45) }}
      role="dialog"
      aria-modal="true"
      aria-label={cs.title ?? 'Welcome'}
    >
      <div
        className="anim-consent-rise w-full text-center"
        style={{
          background: rs(d.card?.background) ?? '#FFFFFF',
          borderRadius: d.card?.radius ?? 20,
          padding: d.card?.padding ?? 20,
          boxShadow: cardShadow,
          marginBottom: 8,
        }}
      >
        {d.showIllustration !== false && (
          <div className="mb-4 flex justify-center">
            <div
              className="grid size-16 place-items-center rounded-2xl"
              style={{ background: hexToRgba(rs(brand) ?? '#000000', 0.08), color: rs(brand) }}
            >
              <FileText className="size-8" aria-hidden />
            </div>
          </div>
        )}

        <h2
          style={{
            color: rs(d.title?.color) ?? '#1A1A1A',
            fontSize: d.title?.size ?? 17,
            fontWeight: (d.title?.weight as React.CSSProperties['fontWeight']) ?? 700,
          }}
        >
          {cs.title ?? 'Welcome to your AI Assistant'}
        </h2>
        {cs.subtitle && (
          <p
            className="mt-1"
            style={{
              color: rs(d.subtitle?.color) ?? '#6E6E73',
              fontSize: d.subtitle?.size ?? 12,
              fontWeight: (d.subtitle?.weight as React.CSSProperties['fontWeight']) ?? 400,
            }}
          >
            {cs.subtitle}
          </p>
        )}

        {points.length > 0 && (
          <ul className="mt-4 flex flex-col text-start" style={{ gap: d.points?.gap ?? 12 }}>
            {points.map((p, i) => {
              const Glyph = POINT_GLYPHS[p.icon as keyof typeof POINT_GLYPHS] ?? Info
              return (
                <li key={i} className="flex items-start gap-3">
                  <Glyph
                    className="mt-0.5 shrink-0"
                    style={{
                      width: d.points?.iconSize ?? 16,
                      height: d.points?.iconSize ?? 16,
                      color: rs(d.points?.iconColor) ?? '#6E6E73',
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      color: rs(d.points?.textColor) ?? '#3A3A3C',
                      fontSize: d.points?.textSize ?? 12.5,
                      lineHeight: 1.45,
                    }}
                  >
                    {p.text}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {cs.footnote && (
          <p className="mt-4" style={{ color: rs(d.footnote?.color) ?? '#8E8E93', fontSize: d.footnote?.size ?? 10.5 }}>
            {cs.footnote}
          </p>
        )}

        {/* The privacy / terms links: real anchors to the channel's own pages. */}
        {(() => {
          const links = [cs.links?.terms, cs.links?.privacy].filter(
            (l): l is NonNullable<typeof l> => !!l && l.show !== false && !!l.url,
          )
          if (!links.length) return null
          const linkStyle: React.CSSProperties = {
            color: rs(cs.links?.color) ?? brand,
            fontSize: (d.footnote?.size ?? 10.5) + 0.5,
            textDecoration: cs.links?.underline === false ? 'none' : 'underline',
            textUnderlineOffset: 2,
          }
          return (
            <p className={cs.footnote ? 'mt-1.5' : 'mt-4'}>
              {links.map((l, i) => (
                <span key={i}>
                  {i > 0 && (
                    <span
                      className="mx-1.5"
                      style={{ color: rs(d.footnote?.color) ?? '#8E8E93', fontSize: linkStyle.fontSize }}
                    >
                      ·
                    </span>
                  )}
                  <a href={l.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {l.label}
                  </a>
                </span>
              ))}
            </p>
          )
        })()}

        <button
          type="button"
          onClick={agree}
          className="mt-4 cursor-pointer transition-opacity hover:opacity-90"
          style={{
            background: rs(d.button?.background) ?? brand,
            color: rs(d.button?.textColor) ?? '#FFFFFF',
            borderRadius: d.button?.radius ?? 12,
            height: d.button?.height ?? 44,
            fontSize: d.button?.textSize ?? 13.5,
            fontWeight: (d.button?.weight as React.CSSProperties['fontWeight']) ?? 600,
            width: d.button?.fullWidth === false ? undefined : '100%',
            paddingInline: 20,
          }}
        >
          {cs.buttonText ?? 'Agree & Continue'}
        </button>
      </div>
    </div>
  )
}
