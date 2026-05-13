import { Spinner } from '@/components/ui/spinner'
import { useVoiceRecorder } from '@/features/conversation/hooks/use-voice-recorder'
import type { VoiceRecorderPayload } from '@/features/conversation/hooks/use-voice-recorder'
import { cn } from '@/lib/utils'
import { Check, MicOff, Pause, Play, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

// ─── Props ───────────────────────────────────────────────────────────────────

interface VoiceRecorderProps {
  primaryColor?: string
  isUploading?: boolean
  uploadProgress?: { current: number; total: number }
  onSend: (payload: VoiceRecorderPayload) => void
  onCancel: () => void
}

// ─── Waveform canvas ──────────────────────────────────────────────────────────

interface WaveformCanvasProps {
  waveformData: number[]
  primaryColor: string
  isPaused: boolean
}

function WaveformCanvas({ waveformData, primaryColor, isPaused }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Centre baseline
    ctx.globalAlpha = 0.15
    ctx.fillStyle = primaryColor
    ctx.fillRect(0, H / 2 - 1, W, 2)
    ctx.globalAlpha = 1

    const bars = waveformData.length
    const gap = 2
    const barW = Math.max(1, Math.floor((W - (bars - 1) * gap) / bars))
    let x = 0

    for (let i = 0; i < bars; i++) {
      const v = waveformData[i]
      const h = Math.max(3, v * H)
      const y = (H - h) / 2
      ctx.globalAlpha = isPaused ? 0.4 : 1
      ctx.fillStyle = primaryColor
      ctx.beginPath()
      ctx.roundRect?.(x, y, barW, h, 2)
      ctx.fill()
      x += barW + gap
    }
    ctx.globalAlpha = 1
  }, [waveformData, primaryColor, isPaused])

  return <canvas ref={canvasRef} width={320} height={32} className="w-full" style={{ height: '32px' }} />
}

// ─── Main component ────────────────────────────────────────────────────────────

export function VoiceRecorder({
  primaryColor = '#3b82f6',
  isUploading = false,
  uploadProgress,
  onSend,
  onCancel,
}: VoiceRecorderProps) {
  const {
    isRecording,
    isPaused,
    permissionDenied,
    isConverting,
    formattedTime,
    segmentIndex,
    sizeWarning,
    waveformData,
    start,
    pause,
    resume,
    stopAndSend,
    cancel,
  } = useVoiceRecorder()

  const hasStarted = useRef(false)

  // Auto-start recording when component mounts
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      start()
    }
  }, [start])

  const isBusy = isConverting || isUploading

  // ─── Permission denied ────────────────────────────────────────────────────

  if (permissionDenied) {
    return (
      <div className="flex w-full items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        <MicOff className="size-4 shrink-0" />
        <span>You need to allow microphone access to send a voice message. Check your browser settings.</span>
        <button
          type="button"
          className="ml-auto shrink-0 text-red-400 transition-colors hover:text-red-600"
          onClick={() => {
            cancel()
            onCancel()
          }}
        >
          ✕
        </button>
      </div>
    )
  }

  // ─── Send handler ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (isBusy) return
    const payload = await stopAndSend()
    if (payload && payload.segments.length > 0) {
      onSend(payload)
    } else {
      onCancel()
    }
  }

  const handleCancel = () => {
    cancel()
    onCancel()
  }

  // ─── Upload progress label ────────────────────────────────────────────────

  const progressLabel = (() => {
    if (isConverting) return 'Converting…'
    if (isUploading && uploadProgress && uploadProgress.total > 1) {
      return `Sending ${uploadProgress.current}/${uploadProgress.total}…`
    }
    if (isUploading) return 'Sending…'
    return null
  })()

  return (
    <div
      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 select-none"
      role="group"
      aria-label="Voice recorder"
    >
      {/* Cancel button */}
      <button
        type="button"
        disabled={isBusy || isUploading}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full p-2 transition-colors',
          'text-muted-foreground hover:bg-red-50 hover:text-red-500',
          (isBusy || isUploading) && 'pointer-events-none opacity-40',
        )}
        aria-label="Cancel recording"
        onClick={handleCancel}
      >
        <Trash2 className="size-4" />
      </button>

      {/* Timer + recording indicator */}
      <div className="flex shrink-0 items-center gap-1.5">
        {isRecording && !isPaused && (
          <span className="relative flex size-2.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="relative inline-flex size-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          </span>
        )}
        {isPaused && (
          <span className="relative flex size-2.5">
            <span
              className="relative inline-flex size-2.5 rounded-full opacity-50"
              style={{ backgroundColor: primaryColor }}
            />
          </span>
        )}
        <span className="text-foreground min-w-10 text-sm tabular-nums">{formattedTime}</span>
      </div>

      {/* Waveform */}
      <div className="relative min-w-0 flex-1">
        {progressLabel ? (
          <div className="flex h-8 items-center">
            <span className="text-muted-foreground text-xs">{progressLabel}</span>
          </div>
        ) : (
          <WaveformCanvas waveformData={waveformData} primaryColor={primaryColor} isPaused={isPaused} />
        )}

        {/* Size-approaching-limit warning */}
        {sizeWarning && !isConverting && (
          <div className="absolute -top-5 right-0 left-0 text-center text-[10px] text-amber-500">
            Saving chunk, recording continues…
          </div>
        )}

        {/* Multi-segment badge */}
        {segmentIndex > 0 && (
          <div className="text-muted-foreground absolute -bottom-5 left-0 text-[10px]">Part {segmentIndex + 1}</div>
        )}
      </div>

      {/* Pause / Resume */}
      <button
        type="button"
        disabled={isBusy}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full p-2 transition-colors',
          'hover:bg-accent',
          isBusy && 'pointer-events-none opacity-40',
        )}
        aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        style={{ color: primaryColor }}
        onClick={isPaused ? resume : pause}
      >
        {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>

      {/* Send */}
      <button
        type="button"
        disabled={isBusy}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full p-2 text-white transition-colors',
          isBusy ? 'opacity-70' : 'hover:opacity-90',
        )}
        style={{ backgroundColor: primaryColor }}
        aria-label="Send voice message"
        onClick={handleSend}
      >
        {isBusy ? <Spinner className="size-4 text-white" /> : <Check className="size-4" />}
      </button>
    </div>
  )
}
