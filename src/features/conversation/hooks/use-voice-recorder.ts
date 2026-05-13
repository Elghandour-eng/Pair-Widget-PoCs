import {
  VOICE_CHUNK_SAFETY_THRESHOLD,
  VOICE_MAX_DURATION_S,
  VOICE_MP3_BITRATE,
  VOICE_RECORDER_TIMESLICE_MS,
} from '@/constants/file-upload'
import { Mp3Encoder } from 'lamejs'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceRecorderPayload {
  /** All finalized MP3 blobs in recording order */
  segments: Blob[]
  /** Total elapsed recording time in milliseconds */
  totalDurationMs: number
  /** Final waveform snapshot */
  waveform: number[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BARS = 80

function getSupportedMimeType(preferred: string): string {
  const candidates = [preferred, 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', '']
  for (const t of candidates) {
    if (!t || MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

async function convertToMp3(rawBlob: Blob): Promise<Blob> {
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()

  const arrayBuffer = await rawBlob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  // Always encode mono (channel 0 only) for voice messages — smaller file
  const samples = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  const pcm16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const encoder = new Mp3Encoder(1, sampleRate, VOICE_MP3_BITRATE)
  const mp3Parts: ArrayBuffer[] = []
  const blockSize = 1152

  for (let i = 0; i < pcm16.length; i += blockSize) {
    const chunk = pcm16.subarray(i, i + blockSize)
    const encoded = encoder.encodeBuffer(chunk)
    if (encoded.length > 0) {
      // Copy into a plain ArrayBuffer to satisfy strict BlobPart types
      const buf = new ArrayBuffer(encoded.length)
      new Int8Array(buf).set(encoded)
      mp3Parts.push(buf)
    }
  }

  const flushed = encoder.flush()
  if (flushed.length > 0) {
    const buf = new ArrayBuffer(flushed.length)
    new Int8Array(buf).set(flushed)
    mp3Parts.push(buf)
  }

  await ctx.close()

  return new Blob(mp3Parts, { type: 'audio/mpeg' })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceRecorder() {
  // --- Public state ---
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [accumulatedBytes, setAccumulatedBytes] = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>(Array(BARS).fill(0))

  // --- Private refs (don't need to trigger re-renders) ---
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const accumulatedBytesRef = useRef(0) // mirror for use inside closures
  const completedSegmentsRef = useRef<Blob[]>([])
  const segmentIndexRef = useRef(0)
  const isAutoChunkingRef = useRef(false) // guard against re-entrant auto-chunk
  const isSendingRef = useRef(false) // user clicked send — suppress auto-chunk restart

  // AudioContext / waveform
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const waveformRafRef = useRef(0)
  const waveformDataRef = useRef<number[]>(Array(BARS).fill(0))

  // Timer (RAF-based, survives auto-chunk restarts)
  const timerRafRef = useRef(0)
  const lastTickRef = useRef(0)
  const elapsedMsRef = useRef(0) // mirror for use inside RAF closures

  const mimeTypeRef = useRef('')

  // Derived state
  const formattedTime = (() => {
    const s = Math.floor(elapsedMs / 1000)
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()

  const sizeWarning = accumulatedBytes > VOICE_CHUNK_SAFETY_THRESHOLD * 0.9

  // ─── Timer ───────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    lastTickRef.current = performance.now()
    const loop = () => {
      const now = performance.now()
      if (!isPausedRef.current && isRecordingRef.current) {
        const delta = now - lastTickRef.current
        elapsedMsRef.current += delta

        // Soft max-duration cap
        if (elapsedMsRef.current >= VOICE_MAX_DURATION_S * 1000) {
          setElapsedMs(elapsedMsRef.current)
          return // stopAndSend will be called separately
        }
        setElapsedMs(elapsedMsRef.current)
      }
      lastTickRef.current = now
      timerRafRef.current = requestAnimationFrame(loop)
    }
    timerRafRef.current = requestAnimationFrame(loop)
  }, [])

  const stopTimer = useCallback(() => {
    cancelAnimationFrame(timerRafRef.current)
  }, [])

  // Mirrors for use inside callbacks without stale closure
  const isPausedRef = useRef(false)
  const isRecordingRef = useRef(false)

  // ─── Waveform ─────────────────────────────────────────────────────────────

  const startWaveform = useCallback(() => {
    const draw = () => {
      const analyser = analyserRef.current
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        const smoothed = Math.min(1, rms * 2.5)
        waveformDataRef.current = [...waveformDataRef.current.slice(1), smoothed]
        setWaveformData([...waveformDataRef.current])
      }
      waveformRafRef.current = requestAnimationFrame(draw)
    }
    waveformRafRef.current = requestAnimationFrame(draw)
  }, [])

  const stopWaveform = useCallback(() => {
    cancelAnimationFrame(waveformRafRef.current)
  }, [])

  // ─── MediaRecorder factory ────────────────────────────────────────────────

  /**
   * Creates and wires a new MediaRecorder on the existing stream.
   * Called on initial start and after each auto-chunk.
   */
  const createRecorder = useCallback((stream: MediaStream) => {
    const recorder = new MediaRecorder(stream, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined)

    recorder.ondataavailable = async (e: BlobEvent) => {
      if (!e.data || e.data.size === 0) return
      chunksRef.current.push(e.data)
      accumulatedBytesRef.current += e.data.size
      setAccumulatedBytes(accumulatedBytesRef.current)

      // ⭐ Size-based auto-chunk check
      if (
        accumulatedBytesRef.current >= VOICE_CHUNK_SAFETY_THRESHOLD &&
        !isAutoChunkingRef.current &&
        !isSendingRef.current &&
        recorder.state === 'recording'
      ) {
        isAutoChunkingRef.current = true
        recorder.stop() // will fire onstop
      }
    }

    recorder.onstop = async () => {
      const currentChunks = [...chunksRef.current]
      const isAutoChunk = isAutoChunkingRef.current

      // Reset chunk buffer immediately so a new recorder can fill it
      chunksRef.current = []
      accumulatedBytesRef.current = 0
      setAccumulatedBytes(0)

      if (currentChunks.length === 0) {
        if (isAutoChunk) isAutoChunkingRef.current = false
        return
      }

      const rawBlob = new Blob(currentChunks, { type: mimeTypeRef.current || 'audio/webm' })

      // Convert to MP3 asynchronously — don't block recording restart
      setIsConverting(true)
      try {
        const mp3Blob = await convertToMp3(rawBlob)
        completedSegmentsRef.current.push(mp3Blob)
      } catch (err) {
        console.error('[useVoiceRecorder] MP3 conversion failed, keeping raw blob', err)
        completedSegmentsRef.current.push(rawBlob)
      } finally {
        setIsConverting(false)
      }

      if (isAutoChunk && !isSendingRef.current && mediaStreamRef.current) {
        // Seamlessly restart recording on same stream
        segmentIndexRef.current += 1
        setSegmentIndex(segmentIndexRef.current)
        isAutoChunkingRef.current = false

        const newRecorder = createRecorder(mediaStreamRef.current)
        mediaRecorderRef.current = newRecorder
        newRecorder.start(VOICE_RECORDER_TIMESLICE_MS)
      }
    }

    recorder.onerror = (e) => {
      console.error('[useVoiceRecorder] MediaRecorder error', e)
    }

    return recorder
  }, [])

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    try {
      sourceNodeRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    analyserRef.current = null
    sourceNodeRef.current = null
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
    }
    audioCtxRef.current = null
  }, [])

  // ─── Public API ───────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (permissionDenied) return // already denied — let UI show warning

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // AudioContext + analyser (tied to stream, not recorder)
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      sourceNodeRef.current = ctx.createMediaStreamSource(stream)
      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = 2048
      sourceNodeRef.current.connect(analyserRef.current)

      mimeTypeRef.current = getSupportedMimeType('audio/webm;codecs=opus')

      // Reset all state
      chunksRef.current = []
      accumulatedBytesRef.current = 0
      completedSegmentsRef.current = []
      segmentIndexRef.current = 0
      elapsedMsRef.current = 0
      isSendingRef.current = false
      isAutoChunkingRef.current = false
      waveformDataRef.current = Array(BARS).fill(0)

      setAccumulatedBytes(0)
      setSegmentIndex(0)
      setElapsedMs(0)
      setWaveformData(Array(BARS).fill(0))
      setPermissionDenied(false)
      setIsRecording(true)
      setIsPaused(false)
      isRecordingRef.current = true
      isPausedRef.current = false

      const recorder = createRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start(VOICE_RECORDER_TIMESLICE_MS)

      startTimer()
      startWaveform()
    } catch (err: unknown) {
      const error = err as { name?: string }
      if (error?.name === 'NotAllowedError' || error?.name === 'NotFoundError') {
        setPermissionDenied(true)
      }
      console.error('[useVoiceRecorder] Could not start recording', err)
    }
  }, [permissionDenied, createRecorder, startTimer, startWaveform])

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    recorder.pause()
    isPausedRef.current = true
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    recorder.resume()
    isPausedRef.current = false
    setIsPaused(false)
  }, [])

  /**
   * Finalize recording and return all segments as MP3 blobs.
   * Returns null if there's nothing to send.
   */
  const stopAndSend = useCallback((): Promise<VoiceRecorderPayload | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) {
        resolve(null)
        return
      }

      isSendingRef.current = true
      isRecordingRef.current = false
      setIsRecording(false)
      stopTimer()
      stopWaveform()

      const finalElapsed = elapsedMsRef.current
      const finalWaveform = [...waveformDataRef.current]

      if (recorder.state === 'inactive') {
        // Already stopped (e.g., auto-chunk just finished)
        resolve({
          segments: [...completedSegmentsRef.current],
          totalDurationMs: finalElapsed,
          waveform: finalWaveform,
        })
        cleanup()
        return
      }

      recorder.onstop = async () => {
        const currentChunks = [...chunksRef.current]
        chunksRef.current = []

        if (currentChunks.length > 0) {
          setIsConverting(true)
          try {
            const rawBlob = new Blob(currentChunks, { type: mimeTypeRef.current || 'audio/webm' })
            const mp3Blob = await convertToMp3(rawBlob)
            completedSegmentsRef.current.push(mp3Blob)
          } catch (err) {
            console.error('[useVoiceRecorder] Final segment MP3 conversion failed', err)
            const rawBlob = new Blob(currentChunks, { type: mimeTypeRef.current || 'audio/webm' })
            completedSegmentsRef.current.push(rawBlob)
          } finally {
            setIsConverting(false)
          }
        }

        const payload: VoiceRecorderPayload = {
          segments: [...completedSegmentsRef.current],
          totalDurationMs: finalElapsed,
          waveform: finalWaveform,
        }

        cleanup()
        resolve(payload)
      }

      recorder.stop()
    })
  }, [stopTimer, stopWaveform, cleanup])

  const cancel = useCallback(() => {
    isSendingRef.current = true // prevent auto-chunk restart
    isRecordingRef.current = false

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null // discard
      recorder.stop()
    }

    stopTimer()
    stopWaveform()
    chunksRef.current = []
    completedSegmentsRef.current = []
    accumulatedBytesRef.current = 0
    cleanup()

    setIsRecording(false)
    setIsPaused(false)
    setElapsedMs(0)
    setSegmentIndex(0)
    setAccumulatedBytes(0)
    setWaveformData(Array(BARS).fill(0))
    isRecordingRef.current = false
    isPausedRef.current = false
  }, [stopTimer, stopWaveform, cleanup])

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      isSendingRef.current = true
      stopTimer()
      stopWaveform()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.onstop = null
          recorder.stop()
        } catch {
          /* ignore */
        }
      }
      cleanup()
    }
  }, [stopTimer, stopWaveform, cleanup])

  return {
    // State
    isRecording,
    isPaused,
    permissionDenied,
    isConverting,
    elapsedMs,
    formattedTime,
    segmentIndex,
    accumulatedBytes,
    sizeWarning,
    waveformData,
    // Controls
    start,
    pause,
    resume,
    stopAndSend,
    cancel,
  }
}
