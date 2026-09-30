import { Spinner } from '@/components/ui/spinner'
import type { Message } from '@/features/conversation/types/message'
import { isUserMessage } from '@/features/conversation/utils/message-utils'
import { cn } from '@/lib/utils'
import { Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageLayout } from './message-layout'
import { TextMessage } from './text-message'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AudioMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
}

type LoadingStage = 'idle' | 'loading' | 'decoding' | 'ready' | 'error'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

/** Average stereo channels to mono */
function averageChannels(buf: AudioBuffer): Float32Array {
  const left = buf.getChannelData(0)
  const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left
  const out = new Float32Array(left.length)
  for (let i = 0; i < left.length; i++) out[i] = (left[i] + right[i]) / 2
  return out
}

/** Build high-resolution peak set (normalized 0..1) */
function buildPeaks(buf: AudioBuffer, count: number, gain: number = 2.5): number[] {
  const chan = buf.numberOfChannels > 1 ? averageChannels(buf) : buf.getChannelData(0)
  const total = chan.length
  const block = Math.max(1, Math.floor(total / count))
  const tmp: number[] = []

  for (let i = 0; i < count; i++) {
    const start = i * block
    const end = Math.min(total, start + block)
    let peak = 0
    for (let s = start; s < end; s++) {
      const v = Math.abs(chan[s])
      if (v > peak) peak = v
    }
    tmp.push(Math.min(1, peak * gain))
  }

  const max = Math.max(...tmp, 1e-6)
  return tmp.map((p) => p / max)
}

/** Downsample high-res peaks to targetCount by grouping with max */
function downsample(src: number[], targetCount: number): number[] {
  if (targetCount <= 0 || src.length === 0) return []
  if (src.length === targetCount) return src
  const result: number[] = new Array(targetCount).fill(0)
  const ratio = src.length / targetCount
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(src.length, Math.floor((i + 1) * ratio))
    let peak = 0
    for (let j = start; j < end; j++) if (src[j] > peak) peak = src[j]
    result[i] = peak
  }
  return result
}

// ─── WaveformBars sub-component ─────────────────────────────────────────────

interface WaveformBarsProps {
  peaks: number[]
  position: number // 0..100
  primaryColor: string
  minBarPx?: number
  barMaxHeight?: number
  isLoading: boolean
  loadingStage: LoadingStage
  loadingProgress: number // 0..100
  onSeek: (percent: number) => void
  barColor?: string
}

function WaveformBars({
  peaks,
  position,
  primaryColor,
  minBarPx = 2,
  barMaxHeight = 18,
  isLoading,
  loadingStage,
  loadingProgress,
  onSeek,
  barColor,
}: WaveformBarsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = clamp(clientX - rect.left, 0, rect.width)
      onSeek((offsetX / rect.width) * 100)
    },
    [onSeek],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isLoading) return
      draggingRef.current = true
      e.preventDefault()
      updatePosition(e.clientX)

      const onMove = (ev: PointerEvent) => {
        if (draggingRef.current) updatePosition(ev.clientX)
      }
      const onUp = () => {
        draggingRef.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [isLoading, updatePosition],
  )

  const activeColor = barColor || primaryColor

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 cursor-pointer items-center"
      style={{ height: `${barMaxHeight * 2 + 4}px` }}
      onPointerDown={handlePointerDown}
    >
      {/* Loading overlay */}
      {isLoading && loadingStage !== 'error' && (
        <div className="absolute inset-0 z-2 flex items-center justify-center rounded-md bg-white/60 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-1">
            <div className="h-1.5 w-full max-w-30 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${loadingStage === 'loading' ? loadingProgress : 100}%`,
                  backgroundColor: activeColor,
                }}
              />
            </div>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {loadingStage === 'loading'
                ? `Loading… ${loadingProgress}%`
                : loadingStage === 'decoding'
                  ? 'Preparing…'
                  : 'Initializing…'}
            </span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadingStage === 'error' && (
        <div className="absolute inset-0 z-2 grid place-items-center rounded-md bg-red-50/80 text-xs font-medium text-red-700">
          Failed to load
        </div>
      )}

      {/* Waveform top half (bars going UP from center) */}
      <div className="pointer-events-none absolute top-1/2 z-1 flex w-full -translate-y-full items-end justify-between gap-px px-0.5">
        {peaks.map((p, i) => {
          const played = peaks.length > 1 ? i / (peaks.length - 1) <= position / 100 : false
          return (
            <span
              key={`t${i}`}
              className="block w-0.5 rounded-t-full sm:w-0.75"
              style={{
                height: `${Math.max(minBarPx, Math.round(p * barMaxHeight))}px`,
                backgroundColor: activeColor,
                opacity: played ? 1 : 0.25,
              }}
            />
          )
        })}
      </div>

      {/* Waveform bottom half (mirrored bars going DOWN from center) */}
      <div className="pointer-events-none absolute top-1/2 z-1 flex w-full scale-y-[-1] items-end justify-between gap-px px-0.5">
        {peaks.map((p, i) => {
          const played = peaks.length > 1 ? i / (peaks.length - 1) <= position / 100 : false
          return (
            <span
              key={`b${i}`}
              className="block w-0.5 rounded-t-full sm:w-0.75"
              style={{
                height: `${Math.max(minBarPx, Math.round(p * barMaxHeight))}px`,
                backgroundColor: activeColor,
                opacity: played ? 1 : 0.25,
              }}
            />
          )
        })}
      </div>

      {/* Seek knob */}
      {!isLoading && (
        <div
          className="absolute top-1/2 z-3 size-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full shadow-sm active:cursor-grabbing"
          style={{
            left: `${position}%`,
            backgroundColor: activeColor,
          }}
        />
      )}
    </div>
  )
}

// ─── Main AudioMessage component ────────────────────────────────────────────

const HIGH_RES_PEAKS = 512 // stored high-res, downsampled to fit container width

export function AudioMessage({ message, isUnread, primaryColor, websiteName }: AudioMessageProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const resolvedPrimaryColor =
    widgetConfig.chatInput?.sendButtonIcon?.styles?.backgroundColor ||
    primaryColor ||
    widgetConfig.primaryColor ||
    '#3D8EDD'
  const audioRef = useRef<HTMLAudioElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState<number>(0)
  const [position, setPosition] = useState(0) // 0..100

  // Waveform state
  const [fullPeaks, setFullPeaks] = useState<number[]>([])
  const [barsCount, setBarsCount] = useState(48)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle')
  const [loadingProgress, setLoadingProgress] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const isUser = isUserMessage(message)

  const audioUrl = message.media_url || (message.metadata?.media_url as string) || (message.metadata?.url as string)

  // Metadata duration (pre-load)
  const metaDurationMs = message.metadata?.duration_ms as number | undefined
  const metaDurationS = metaDurationMs ? metaDurationMs / 1000 : 0

  useEffect(() => {
    if (metaDurationS > 0) setDuration(metaDurationS)
  }, [metaDurationS])

  // Downsampled peaks based on current bar count
  const peaks = fullPeaks.length > 0 ? downsample(fullPeaks, barsCount) : new Array(barsCount).fill(0.15)

  // ─── ResizeObserver for dynamic bar count ──────────────────────────────

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const BAR_PX = 4 + 1 // bar width + gap
    const MIN_BARS = 24
    const MAX_BARS = 45

    const updateBars = () => {
      const w = el.clientWidth
      const count = Math.floor(w / BAR_PX)
      setBarsCount(clamp(count, MIN_BARS, MAX_BARS))
    }

    updateBars()
    const ro = new ResizeObserver(() => updateBars())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── Fetch audio + decode waveform ────────────────────────────────────

  useEffect(() => {
    if (!audioUrl) return

    const ac = new AbortController()
    abortRef.current = ac

    const load = async () => {
      setLoadingStage('loading')
      setLoadingProgress(0)

      try {
        // Fetch with progress tracking
        const res = await fetch(audioUrl, { cache: 'force-cache', signal: ac.signal, mode: 'cors' })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        const contentLength = Number(res.headers.get('content-length') || 0)
        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            received += value.byteLength
            if (contentLength > 0) {
              setLoadingProgress(Math.min(100, Math.round((received / contentLength) * 100)))
            } else {
              setLoadingProgress((prev) => Math.min(99, prev + 1))
            }
          }
        }

        const merged = new Uint8Array(received)
        let offset = 0
        for (const c of chunks) {
          merged.set(c, offset)
          offset += c.byteLength
        }
        setLoadingProgress(100)

        // Decode
        setLoadingStage('decoding')
        const AudioCtx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()

        const audioBuf = await new Promise<AudioBuffer>((resolve, reject) => {
          // Use callback style (Safari compat) with promise fallback
          const maybePromise = ctx.decodeAudioData(
            merged.buffer.slice(0),
            (decoded) => resolve(decoded),
            (err) => reject(err),
          )
          if (maybePromise && typeof (maybePromise as Promise<AudioBuffer>).then === 'function') {
            ;(maybePromise as Promise<AudioBuffer>).then(resolve).catch(reject)
          }
        })

        await ctx.close()

        if (isFinite(audioBuf.duration) && audioBuf.duration > 0) {
          setDuration(audioBuf.duration)
        }

        setFullPeaks(buildPeaks(audioBuf, HIGH_RES_PEAKS))
        setLoadingStage('ready')
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') return
        console.warn('[AudioMessage] Waveform load error:', e)
        // Provide placeholder peaks so the UI is still usable
        setFullPeaks(new Array(HIGH_RES_PEAKS).fill(0.2))
        setLoadingStage('ready')
      }
    }

    load()
    return () => ac.abort()
  }, [audioUrl])

  // ─── Keep position in sync with playback ──────────────────────────────

  useEffect(() => {
    if (duration > 0 && !isNaN(currentTime)) {
      setPosition((currentTime / duration) * 100)
    }
  }, [currentTime, duration])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || loadingStage !== 'ready') return
    if (isPlaying) audio.pause()
    else audio.play()
  }

  const handleSeek = useCallback(
    (percent: number) => {
      const audio = audioRef.current
      if (!audio || !duration) return
      const newTime = (percent / 100) * duration
      audio.currentTime = newTime
      setCurrentTime(newTime)
      setPosition(percent)
    },
    [duration],
  )

  if (!audioUrl) {
    return (
      <TextMessage
        message={message}
        isUnread={isUnread}
        primaryColor={resolvedPrimaryColor}
        websiteName={websiteName}
      />
    )
  }

  const isLoading = loadingStage !== 'ready' && loadingStage !== 'error'

  const aiConfig = widgetConfig.messagesConfig?.aiMessages
  const customerConfig = widgetConfig.messagesConfig?.customerMessages
  const cardStyles = aiConfig?.CardStyles
  const hasCardStyles = aiConfig?.messageStyle === 'card' && cardStyles && Object.keys(cardStyles).length > 0

  let customBubbleStyle: React.CSSProperties = {}
  let customTextStyles: React.CSSProperties = {}
  let timeStyle: React.CSSProperties = {}
  let isCard = false

  if (isUser) {
    const bubbleType = customerConfig?.bubbleType ?? 'filled'
    const useBrandColor = customerConfig?.useBrandColor ?? false

    if (customerConfig) {
      customBubbleStyle = { ...customerConfig.bubbleStyle }
      customTextStyles = { ...customerConfig.TextStyles }

      if (useBrandColor) {
        customBubbleStyle.backgroundColor = resolvedPrimaryColor
      }

      if (bubbleType === 'outline' || bubbleType === 'outlined') {
        customBubbleStyle.backgroundColor = 'transparent'
        const borderW = customBubbleStyle.borderWidth || '1px'
        const borderC = customBubbleStyle.borderColor || resolvedPrimaryColor || '#000000'
        customBubbleStyle.border = `${borderW} solid ${borderC}`

        if (!customTextStyles.color) {
          customTextStyles.color = borderC
        }
      } else {
        // filled mode
        if (useBrandColor && !customTextStyles.color) {
          customTextStyles.color = '#FFFFFF'
        }
        // In filled mode, there should be no border
        delete customBubbleStyle.border
        delete customBubbleStyle.borderWidth
        delete customBubbleStyle.borderColor
        delete customBubbleStyle.borderStyle
      }
    }
  } else {
    // Incoming audio message (agent/AI side)
    if (aiConfig) {
      customTextStyles = { ...aiConfig.TextStyles }
      if (hasCardStyles) {
        isCard = true
        customBubbleStyle = { ...cardStyles }
      } else if (aiConfig.messageStyle === 'plain') {
        customBubbleStyle = { backgroundColor: 'transparent', border: 'none' }
      } else {
        customBubbleStyle = { backgroundColor: `${resolvedPrimaryColor}12` }
      }
    } else {
      customBubbleStyle = { backgroundColor: `${resolvedPrimaryColor}12` }
    }
  }

  if (customTextStyles.color) {
    timeStyle.color = customTextStyles.color
    timeStyle.opacity = 0.7
  }

  let playBtnBg = resolvedPrimaryColor
  let playIconColor = '#FFFFFF'

  if (isUser) {
    const bubbleType = customerConfig?.bubbleType ?? 'filled'
    const useBrandColor = customerConfig?.useBrandColor ?? false

    if (useBrandColor && bubbleType !== 'outline' && bubbleType !== 'outlined') {
      playBtnBg = '#FFFFFF'
      playIconColor = resolvedPrimaryColor
    }
  }

  return (
    <MessageLayout message={message} isUnread={isUnread} primaryColor={resolvedPrimaryColor} websiteName={websiteName}>
      <div
        ref={wrapperRef}
        className={cn('flex w-full min-w-50 flex-col', {
          'max-w-73 rounded-2xl bg-[#EEECE1] p-3 text-[#1A1A1A]': isUser,
          'w-full rounded-2xl px-3 py-2.5': !isUser && !isCard && aiConfig?.messageStyle !== 'plain',
          'w-full p-0': !isUser && !isCard && aiConfig?.messageStyle === 'plain',
          'w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm': !isUser && isCard,
        })}
        style={customBubbleStyle}
      >
        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration
            if (isFinite(d) && d > 0) setDuration(d)
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false)
            setCurrentTime(0)
            setPosition(0)
            if (audioRef.current) audioRef.current.currentTime = 0
          }}
        />

        {/* Row: play button + waveform */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isLoading}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80',
              isLoading && 'opacity-60',
            )}
            style={{ backgroundColor: playBtnBg }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Spinner className="size-4" style={{ color: playIconColor }} />
            ) : isPlaying ? (
              <Pause className="size-4" fill={playIconColor} style={{ color: playIconColor }} />
            ) : (
              <Play className="ml-0.5 size-4" fill={playIconColor} style={{ color: playIconColor }} />
            )}
          </button>

          {/* Waveform */}
          <WaveformBars
            peaks={peaks}
            position={position}
            primaryColor={resolvedPrimaryColor}
            isLoading={isLoading}
            loadingStage={loadingStage}
            loadingProgress={loadingProgress}
            onSeek={handleSeek}
            barColor={
              isUser && customerConfig?.useBrandColor && customerConfig?.bubbleType !== 'outline'
                ? '#FFFFFF'
                : resolvedPrimaryColor
            }
          />
        </div>

        {/* Duration */}
        <div className={cn('mt-0.5 flex items-center', isUser ? 'justify-start' : 'justify-end')}>
          <span
            className="text-muted-foreground text-[10px] tabular-nums"
            style={{ ...customTextStyles, opacity: 0.7 }}
          >
            {isPlaying || currentTime > 0 ? formatDuration(currentTime) : formatDuration(duration)}
          </span>
        </div>
      </div>
    </MessageLayout>
  )
}
