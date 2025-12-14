import type { Message } from '@/features/conversation/types/message'
import { Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageLayout } from './message-layout'
import { TextMessage } from './text-message'

interface VideoMessageProps {
  message: Message
  isUnread: boolean
  primaryColor: string
  websiteName: string
}

function toTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return ''
  const sec = Math.floor(seconds)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60

  const hh = h > 0 ? `${h}:` : ''
  const mm = (h > 0 ? String(m).padStart(2, '0') : String(m)) + ':'
  const ss = String(s).padStart(2, '0')
  return `${hh}${mm}${ss}`
}

export function VideoMessage({ message, isUnread, primaryColor, websiteName }: VideoMessageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [duration, setDuration] = useState<string>('')
  const [poster, setPoster] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)

  // Extract content from message
  const metadata = message.metadata
  const videoUrl = message.media_url || metadata?.media_url || metadata?.url
  const content = message.content
  // const apiPoster = message.sender_avatar // Fallback or specific field if available, usually undefined for video messages

  // Decide what to show as caption
  const showContent = content && !['[Video]', '[Video Message]'].includes(content)

  // Auto-generate thumbnail
  useEffect(() => {
    if (!videoUrl || poster) return

    const video = videoRef.current
    if (!video) return

    const generateThumbnail = async () => {
      try {
        // Wait for metadata if needed
        if (Number.isNaN(video.duration)) {
          await new Promise<void>((resolve) => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true })
          })
        }

        // Seek to 1s or slightly less if shorter
        const targetTime = Math.min(1, Math.max(video.duration - 0.1, 0.1))
        video.currentTime = targetTime

        await new Promise<void>((resolve) => {
          const onSeeked = () => resolve()
          video.addEventListener('seeked', onSeeked, { once: true })
        })

        // Draw to canvas
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          try {
            const dataUrl = canvas.toDataURL('image/jpeg')
            setPoster(dataUrl)
          } catch (e) {
            // CORS might prevent this
            console.warn('Could not generate video thumbnail due to CORS', e)
          }
        }
      } catch (e) {
        console.error('Error generating thumbnail', e)
      }
    }

    // Try to start generation when data is loaded
    if (video.readyState >= 2) {
      generateThumbnail()
    } else {
      video.addEventListener('loadeddata', generateThumbnail, { once: true })
    }
  }, [videoUrl]) // Run once when videoUrl changes

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const d = e.currentTarget.duration
    if (isFinite(d)) {
      setDuration(toTime(d))
    }
  }

  if (!videoUrl) {
    return <TextMessage message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName} />
  }

  return (
    <MessageLayout message={message} isUnread={isUnread} primaryColor={primaryColor} websiteName={websiteName}>
      <div className="flex max-w-full flex-col items-start gap-1">
        <div
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-black/5 dark:border-gray-800"
          onClick={() => setIsOpen(true)}
        >
          {/* Hidden inline video for thumbnail generation */}
          <video
            ref={videoRef}
            src={videoUrl}
            className="h-auto max-h-[200px] w-full max-w-[280px] rounded-xl object-cover"
            preload="metadata"
            muted
            playsInline
            crossOrigin="anonymous"
            onLoadedMetadata={handleLoadedMetadata}
          />

          {/* Poster Overlay (if generated) or keep video visible if no poster but video frame is shown */}
          {poster && (
            <img
              src={poster}
              alt="Video thumbnail"
              className="absolute inset-0 h-full w-full rounded-xl object-cover"
            />
          )}

          {/* Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="ml-1 h-6 w-6" fill="currentColor" />
            </div>
          </div>

          {/* Duration Badge */}
          {duration && (
            <div className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {duration}
            </div>
          )}
        </div>

        {showContent && <div className="px-1 text-sm leading-relaxed">{content}</div>}

        {isOpen &&
          createPortal(
            <div
              className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 duration-200"
              onClick={() => setIsOpen(false)}
            >
              <div className="absolute top-4 right-4 z-50">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="relative w-full max-w-5xl px-4" onClick={(e) => e.stopPropagation()}>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="max-h-[85vh] w-full rounded-xl bg-black shadow-2xl"
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    </MessageLayout>
  )
}
