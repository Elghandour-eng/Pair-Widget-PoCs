import { InfoCircleIcon } from '@/components/icons/info-circle-icon'
import { ReloadIcon } from '@/components/icons/reload-icon'
import { SendIcon } from '@/components/icons/send-icon'
import { Spinner } from '@/components/ui/spinner'
import type { VoiceRecorderPayload } from '@/features/conversation/hooks/use-voice-recorder'
import { useVoiceRecorder } from '@/features/conversation/hooks/use-voice-recorder'
import { cn } from '@/lib/utils'
import { Mic, Play, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

export function VoiceRecorder({ isUploading = false, uploadProgress, onSend, onCancel }: VoiceRecorderProps) {
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

  const [readyPayload, setReadyPayload] = useState<VoiceRecorderPayload | null>(null)
  const hasStarted = useRef(false)

  // Auto-start recording when component mounts
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      start()
    }
  }, [start])

  const isBusy = isConverting || isUploading

  const progressLabel = (() => {
    if (isConverting) return 'Processing audio…'
    if (isUploading && uploadProgress && uploadProgress.total > 1) {
      return `Sending ${uploadProgress.current}/${uploadProgress.total}…`
    }
    if (isUploading) return 'Sending…'
    return null
  })()

  const handleCancel = () => {
    setReadyPayload(null)
    cancel()
    onCancel()
  }

  const handleStop = async () => {
    const payload = await stopAndSend()
    if (payload && payload.segments.length > 0) {
      setReadyPayload(payload)
    } else {
      handleCancel()
    }
  }

  const handleSend = () => {
    if (isBusy || !readyPayload) return
    onSend(readyPayload)
  }

  const handleWaveformClick = () => {
    if (readyPayload || isBusy) return
    if (isPaused) {
      resume()
    } else {
      pause()
    }
  }

  const formattedFinalTime = (() => {
    if (!readyPayload) return '00:00'
    const s = Math.floor(readyPayload.totalDurationMs / 1000)
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()

  // ─── Permission denied ────────────────────────────────────────────────────

  if (permissionDenied) {
    return (
      <div className="flex h-11.5 w-full items-center gap-2 rounded-full border border-[#FEF3F2] bg-white p-1.25 select-none">
        {/* Left info button: clicking exits voice recorder mode */}
        <button
          type="button"
          onClick={handleCancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FEF3F2] text-[#BF2C25] transition-colors hover:bg-red-100"
          aria-label="Exit voice recorder"
        >
          <InfoCircleIcon className="size-4" />
        </button>

        {/* Center error text */}
        <div className="min-w-0 flex-1 px-1">
          <span className="block truncate text-[12px] font-normal text-[#BF2C25]">
            Permission denied. Check settings & reload.
          </span>
        </div>

        {/* Right reload button: clicking retries permission request */}
        <button
          type="button"
          onClick={handleCancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#BF2C25] text-white transition-colors hover:bg-[#A9221C]"
          aria-label="Retry permission"
        >
          <ReloadIcon className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex h-11.5 w-full items-center gap-2 rounded-full border border-[#ECECED] bg-white p-1.25 select-none"
      role="group"
      aria-label="Voice recorder"
    >
      {/* Left button circle */}
      {progressLabel ? (
        <div className="text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F3] opacity-40">
          <X className="size-4" />
        </div>
      ) : readyPayload ? (
        <button
          type="button"
          onClick={handleCancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F3] text-[#626A6A] transition-colors hover:bg-[#E4E4E6]"
          aria-label="Discard recording"
        >
          <X className="size-4" />
        </button>
      ) : isPaused ? (
        <button
          type="button"
          onClick={resume}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F3] text-[#626A6A] transition-colors hover:bg-[#E4E4E6]"
          aria-label="Resume recording"
        >
          <Play className="size-4 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCancel}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-[#626A6A] transition-colors',
            isRecording ? 'bg-[#4D98E2] hover:bg-[#3D8EDD]' : 'bg-[#F2F2F3] hover:bg-[#E4E4E6]',
          )}
          aria-label="Cancel recording"
        >
          <X className={cn('size-4', isRecording ? 'text-white' : 'text-[#626A6A]')} />
        </button>
      )}

      {/* Waveform and Timer */}
      <div className="relative flex min-w-0 flex-1 items-center gap-2">
        {progressLabel ? (
          <div className="flex h-8 flex-1 items-center px-2">
            <span className="animate-pulse text-[12px] font-normal text-[#85888E]">{progressLabel}</span>
          </div>
        ) : (
          <>
            {/* Pulsing red dot for active recording */}
            {isRecording && !isPaused && (
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4D98E2] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[#4D98E2]" />
              </span>
            )}
            {/* Static dot for paused state */}
            {isRecording && isPaused && <span className="size-2 shrink-0 rounded-full bg-[#4D98E2]/50" />}

            {/* Waveform Canvas (clicks to pause/resume) */}
            <div className={cn('min-w-0 flex-1', !readyPayload && 'cursor-pointer')} onClick={handleWaveformClick}>
              <WaveformCanvas
                waveformData={readyPayload ? readyPayload.waveform : waveformData}
                primaryColor={readyPayload ? '#797B86' : '#3D8EDD'}
                isPaused={isPaused}
              />
            </div>

            {/* Timer display */}
            <span
              className={cn(
                'min-w-10 px-1 text-center text-[10px] font-medium tabular-nums select-none',
                readyPayload ? 'text-[#85888E]' : 'text-[#3D8EDD]',
              )}
            >
              {readyPayload ? formattedFinalTime : formattedTime}
            </span>
          </>
        )}

        {/* Size limits / warnings */}
        {sizeWarning && !isConverting && (
          <div className="absolute -top-5 right-0 left-0 text-center text-[9px] text-amber-500">
            Saving chunk, recording continues…
          </div>
        )}

        {segmentIndex > 0 && !readyPayload && (
          <div className="text-muted-foreground absolute -bottom-5 left-0 text-[9px]">Part {segmentIndex + 1}</div>
        )}
      </div>

      {/* Right button circle */}
      {progressLabel ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3D8EDD] text-white">
          <Spinner className="size-4 text-white" />
        </div>
      ) : readyPayload ? (
        <button
          type="button"
          onClick={handleSend}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E1E1E] text-white transition-colors hover:bg-[#333333]"
          aria-label="Send voice message"
        >
          <SendIcon className="size-3 text-white" />
        </button>
      ) : isPaused ? (
        <button
          type="button"
          onClick={resume}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3D8EDD] text-white transition-colors hover:bg-[#2A7BC6]"
          aria-label="Resume recording"
        >
          <Mic className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStop}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3D8EDD] text-white transition-colors hover:bg-[#2A7BC6]"
          aria-label="Stop recording"
        >
          <Square className="size-3.5 fill-current" />
        </button>
      )}
    </div>
  )
}
