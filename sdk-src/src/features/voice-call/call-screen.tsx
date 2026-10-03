import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Mic, MicOff, PhoneOff, RotateCcw, X } from 'lucide-react'

import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import type { VoiceCallDto } from '@/config/types/widget-config-dto'
import { CallGlyph, useStartCall } from './call-button'
import {
  callLevels,
  confirmCall,
  dismissCall,
  endCall,
  resumeAudio,
  setMinimized,
  toggleMute,
  useVoiceCall,
  type CallState,
} from './voice-call-controller'

/**
 * The call, over the widget: a confirmation card before it, the call itself
 * while it runs (or a slim bar at the top when folded away so the chat stays
 * usable), and how it ended after. Everything it shows — copy, colours, the
 * visualizer, which controls appear — comes from the studio's design.
 */
export function CallScreen() {
  const { widgetConfig } = useWidgetConfigContext()
  const vc = widgetConfig.voiceCall
  const call = useVoiceCall()
  if (!vc || call.status === 'idle') return null

  const dir = /^ar/i.test(widgetConfig.locale ?? '') ? 'rtl' : 'ltr'
  if (call.status === 'confirm') return <ConfirmCard vc={vc} dir={dir} />
  if (call.minimized) return <CallBar vc={vc} call={call} dir={dir} />
  return (
    <CallPanel
      vc={vc}
      call={call}
      dir={dir}
      avatar={vc.design.avatarUrl || widgetConfig.headerConfig?.iconUrl || widgetConfig.avatarUrl || ''}
    />
  )
}

function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{6})/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

/**
 * The accent, unless it would vanish into the call screen (a near-black brand
 * on the dark default): then the text colour, which the design already made
 * readable there.
 */
function visibleAccent(d: VoiceCallDto['design']): string {
  const a = luminance(d.accent)
  const b = luminance(d.background)
  return a !== null && b !== null && Math.abs(a - b) < 0.25 ? d.textColor : d.accent
}

function background(d: VoiceCallDto['design']): string {
  return d.useGradient ? `linear-gradient(${d.gradientAngle}deg, ${d.background}, ${d.gradientTo})` : d.background
}

function ConfirmCard({ vc, dir }: { vc: VoiceCallDto; dir: string }) {
  const t = vc.texts
  const d = vc.design
  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.confirmTitle}
      dir={dir}
    >
      <div
        className="anim-consent-rise w-full rounded-2xl bg-white p-5 text-center shadow-xl"
        style={{ fontFamily: d.fontFamily || undefined }}
      >
        <div
          className="mx-auto mb-3 grid size-14 place-items-center rounded-full"
          style={{ background: d.accent, color: d.endColor }}
        >
          <CallGlyph className="size-6" />
        </div>
        <h2 className="text-[17px] font-bold text-[#1A1A1A]">{t.confirmTitle}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">{t.confirmBody}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={confirmCall}
            className="h-11 cursor-pointer rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: d.accent, color: d.endColor }}
          >
            {t.startButton}
          </button>
          <button
            type="button"
            onClick={dismissCall}
            className="h-10 cursor-pointer rounded-xl text-[13.5px] font-medium text-[#6E6E73] hover:bg-black/5"
          >
            {t.cancelButton}
          </button>
        </div>
      </div>
    </div>
  )
}

function useElapsed(startedAt?: number): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  if (!startedAt) return '0:00'
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function statusLine(vc: VoiceCallDto, call: CallState): string {
  const t = vc.texts
  if (call.status === 'connecting') return t.connecting
  if (call.status === 'ended') return call.reason === 'timeLimit' ? t.timeLimit : t.ended
  if (call.status === 'failed') {
    if (call.reason === 'micDenied') return t.micDenied
    if (call.reason === 'unavailable') return t.unavailable
    return t.failed
  }
  if (call.agentState === 'thinking') return t.thinking
  if (call.agentState === 'speaking') return t.speaking
  if (call.agentState === 'listening') return t.listening
  return t.subtitle
}

function CallPanel({ vc, call, dir, avatar }: { vc: VoiceCallDto; call: CallState; dir: string; avatar: string }) {
  const d = vc.design
  const t = vc.texts
  const elapsed = useElapsed(call.startedAt)
  const start = useStartCall()
  const running = call.status === 'connecting' || call.status === 'live'
  const over = call.status === 'ended' || call.status === 'failed'
  const control = { width: d.controlSize, height: d.controlSize }

  return (
    <div
      className="anim-fade absolute inset-0 z-50 flex flex-col"
      style={{ background: background(d), color: d.textColor, fontFamily: d.fontFamily || undefined }}
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      onPointerDown={call.audioBlocked ? resumeAudio : undefined}
    >
      <div className="flex items-center justify-between px-3 pt-3">
        {running ? (
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-white/10"
            aria-label={t.closeButton}
            title={t.closeButton}
          >
            <ChevronDown className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={dismissCall}
            className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-white/10"
            aria-label={t.closeButton}
            title={t.closeButton}
          >
            <X className="size-5" />
          </button>
        )}
        {vc.showTimer && call.status === 'live' && (
          <span
            className="rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums"
            style={{ background: d.controlBackground }}
          >
            {elapsed}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Visualizer d={d} live={call.status === 'live'} muted={call.muted}>
          {d.showAvatar &&
            (avatar ? (
              <img
                src={avatar}
                alt=""
                className="object-cover"
                style={{ width: d.avatarSize, height: d.avatarSize, borderRadius: d.avatarRadius }}
              />
            ) : (
              <span
                className="grid place-items-center"
                style={{
                  width: d.avatarSize,
                  height: d.avatarSize,
                  borderRadius: d.avatarRadius,
                  background: d.accent,
                  color: d.endColor,
                }}
              >
                <CallGlyph className="size-8" />
              </span>
            ))}
        </Visualizer>
        <div>
          <h2 className="font-bold" style={{ fontSize: d.titleSize }}>
            {t.title}
          </h2>
          <p className="mt-1 text-[13.5px]" style={{ color: d.mutedColor }} aria-live="polite">
            {statusLine(vc, call)}
            {call.status === 'connecting' && <span className="ms-1 inline-block animate-pulse">●</span>}
          </p>
        </div>
        {vc.showCaptions && call.status === 'live' && call.captions.length > 0 && (
          <div
            className="flex w-full max-w-sm flex-col gap-1.5 rounded-2xl p-3 text-start"
            style={{ background: d.captionBackground, color: d.captionColor, fontSize: d.captionSize }}
            aria-live="polite"
          >
            {call.captions.slice(-2).map((c) => (
              <p key={c.id} className={c.from === 'visitor' ? 'opacity-70' : ''}>
                {c.text}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-5 px-6 pt-2 pb-8">
        {running && (
          <>
            {vc.showMute && (
              <button
                type="button"
                onClick={toggleMute}
                disabled={call.status !== 'live'}
                className="grid cursor-pointer place-items-center rounded-full transition-opacity disabled:opacity-40"
                style={{
                  ...control,
                  background: call.muted ? d.controlColor : d.controlBackground,
                  color: call.muted ? d.background : d.controlColor,
                }}
                aria-label={call.muted ? t.unmute : t.mute}
                title={call.muted ? t.unmute : t.mute}
                aria-pressed={call.muted}
              >
                {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={endCall}
              className="grid cursor-pointer place-items-center rounded-full transition-transform hover:scale-105"
              style={{ ...control, background: d.endBackground, color: d.endColor }}
              aria-label={t.endButton}
              title={t.endButton}
            >
              <PhoneOff className="size-5" />
            </button>
          </>
        )}
        {over && (
          <div className="flex w-full max-w-xs flex-col gap-2">
            {call.reason !== 'unavailable' && (
              <button
                type="button"
                onClick={start}
                className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: d.textColor, color: d.background }}
              >
                <RotateCcw className="size-4" />
                {t.callAgain}
              </button>
            )}
            <button
              type="button"
              onClick={dismissCall}
              className="h-10 cursor-pointer rounded-xl text-[13.5px] font-medium"
              style={{ background: d.controlBackground, color: d.controlColor }}
            >
              {t.closeButton}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The folded call: timer, a tap to unfold, and the end button, above the chat. */
function CallBar({ vc, call, dir }: { vc: VoiceCallDto; call: CallState; dir: string }) {
  const d = vc.design
  const elapsed = useElapsed(call.startedAt)
  const height = useHeaderHeight()
  return (
    <div
      className="anim-fade absolute inset-x-0 top-0 z-50 flex items-center gap-2 ps-4 pe-3 shadow-md"
      style={{ height, background: background(d), color: d.textColor, fontFamily: d.fontFamily || undefined }}
      dir={dir}
    >
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
      >
        <span className="relative flex size-2.5 shrink-0">
          <span
            className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
            style={{ background: d.endBackground }}
          />
          <span className="relative inline-flex size-2.5 rounded-full" style={{ background: d.endBackground }} />
        </span>
        <span className="truncate text-[13px] font-semibold">{vc.texts.title}</span>
        {vc.showTimer && call.status === 'live' && (
          <span className="text-[12px] tabular-nums" style={{ color: d.mutedColor }}>
            {elapsed}
          </span>
        )}
      </button>
      {vc.showMute && call.status === 'live' && (
        <button
          type="button"
          onClick={toggleMute}
          className="grid size-8 cursor-pointer place-items-center rounded-full"
          style={{ background: d.controlBackground, color: d.controlColor }}
          aria-label={call.muted ? vc.texts.unmute : vc.texts.mute}
          aria-pressed={call.muted}
        >
          {call.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={endCall}
        className="grid size-8 cursor-pointer place-items-center rounded-full"
        style={{ background: d.endBackground, color: d.endColor }}
        aria-label={vc.texts.endButton}
      >
        <PhoneOff className="size-4" />
      </button>
    </div>
  )
}

/**
 * The folded call takes the header's place exactly, whichever screen is
 * showing: it measures the header it covers and follows it as it changes.
 */
function useHeaderHeight(): number {
  const [height, setHeight] = useState(64)
  useEffect(() => {
    let observer: ResizeObserver | null = null
    const attach = () => {
      const header = document.querySelector('[data-slot="card-header"]')
      if (!header) return
      observer?.disconnect()
      observer = new ResizeObserver(() => setHeight(Math.max(48, Math.round(header.getBoundingClientRect().height))))
      observer.observe(header)
    }
    attach()
    // Screens slide in and out, so the header can be replaced while folded.
    const id = setInterval(attach, 800)
    return () => {
      clearInterval(id)
      observer?.disconnect()
    }
  }, [])
  return height
}

/**
 * The visualizer around the avatar, driven by the agent's voice (and the
 * visitor's, more softly) on every animation frame. It writes styles straight
 * to the DOM rather than re-rendering React sixty times a second.
 */
function Visualizer({
  d,
  live,
  muted,
  children,
}: {
  d: VoiceCallDto['design']
  live: boolean
  muted: boolean
  children: React.ReactNode
}) {
  const orb = useRef<HTMLDivElement>(null)
  const bars = useRef<HTMLDivElement>(null)
  const wave = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (!live || d.visualizer === 'none') return
    let raf = 0
    let t = 0
    const tick = () => {
      t += 1
      const { agent, visitor, bins } = callLevels()
      const level = Math.min(1, Math.max(agent, visitor * 0.6))
      if (orb.current) {
        orb.current.style.transform = `scale(${1 + level * 0.45})`
        orb.current.style.opacity = String(0.25 + level * 0.6)
      }
      if (bars.current) {
        const children = bars.current.children
        for (let i = 0; i < children.length; i++) {
          const v = bins && bins.length ? bins[Math.min(bins.length - 1, 1 + i * 2)] / 255 : level
          ;(children[i] as HTMLElement).style.height = `${8 + Math.max(v, level * 0.5) * 40}px`
        }
      }
      if (wave.current) {
        const amp = 4 + level * 22
        let p = 'M0 30'
        for (let x = 0; x <= 200; x += 10)
          p += ` L${x} ${30 + Math.sin((x + t * 4) / 18) * amp * Math.sin((x / 200) * Math.PI)}`
        wave.current.setAttribute('d', p)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, d.visualizer])

  const size = d.avatarSize
  const accent = visibleAccent(d)
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid place-items-center" style={{ width: size + 56, height: size + 56 }}>
        {d.visualizer === 'orb' && (
          <div
            ref={orb}
            className="absolute inset-0 rounded-full transition-transform duration-75"
            style={{
              background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
              opacity: live ? 0.3 : 0.18,
              filter: muted ? 'grayscale(1)' : undefined,
            }}
          />
        )}
        <div className="relative">{children}</div>
      </div>
      {d.visualizer === 'bars' && (
        <div ref={bars} className="flex h-12 items-center gap-1.5" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full transition-[height] duration-75"
              style={{ height: 8, background: accent }}
            />
          ))}
        </div>
      )}
      {d.visualizer === 'wave' && (
        <svg viewBox="0 0 200 60" className="h-12 w-48" aria-hidden>
          <path ref={wave} d="M0 30 L200 30" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}
