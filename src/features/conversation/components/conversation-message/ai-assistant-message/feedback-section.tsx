import { ThumbsDownIcon } from '@/components/icons/thumbs-down-icon'
import { ThumbsUpIcon } from '@/components/icons/thumbs-up-icon'
import { useState } from 'react'
import { toast } from 'sonner'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'

interface FeedbackSectionProps {
  messageId: string
}

const getInactiveColor = (color: string) => {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}66` // 40% opacity
  }
  return color
}

export function FeedbackSection({ messageId }: FeedbackSectionProps) {
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null)
  const { widgetConfig } = useWidgetConfigContext()

  const feedbackConfig = widgetConfig.messagesConfig?.feedback
  const primaryColor = widgetConfig.primaryColor

  const showFeedbackButtons = feedbackConfig?.showFeedbackButtons ?? true
  if (!showFeedbackButtons) {
    return null
  }

  const toastMessage = feedbackConfig?.toastMessage ?? 'Thanks for your feedback.'
  const iconSize = feedbackConfig?.style?.iconSize
  const iconColor = feedbackConfig?.style?.iconColor

  const activeColor = iconColor || (feedbackConfig?.iconColorType === 'widget' ? primaryColor : null)
  const inactiveColor = activeColor ? getInactiveColor(activeColor) : null

  const upFill =
    feedback === 'liked' ? activeColor || undefined : feedback === 'disliked' ? undefined : inactiveColor || undefined
  const downFill =
    feedback === 'disliked' ? activeColor || undefined : feedback === 'liked' ? undefined : inactiveColor || undefined

  const handleLike = () => {
    const next = feedback === 'liked' ? null : 'liked'
    setFeedback(next)
    if (next === 'liked') {
      toast.success(toastMessage)
    }
    console.log('Thumbs up clicked for message:', messageId)
  }

  const handleDislike = () => {
    const next = feedback === 'disliked' ? null : 'disliked'
    setFeedback(next)
    if (next === 'disliked') {
      toast.success(toastMessage)
    }
    console.log('Thumbs down clicked for message:', messageId)
  }

  return (
    <div className="mt-1 flex items-center justify-start gap-3 select-none">
      <button
        onClick={handleLike}
        className="cursor-pointer rounded p-1 transition-colors hover:bg-black/5 focus:outline-none"
        aria-label="Thumbs up"
      >
        <ThumbsUpIcon
          className="h-4 w-4.5"
          style={iconSize ? { width: iconSize, height: iconSize } : undefined}
          liked={feedback === 'liked'}
          fill={upFill}
        />
      </button>
      <button
        onClick={handleDislike}
        className="cursor-pointer rounded p-1 transition-colors hover:bg-black/5 focus:outline-none"
        aria-label="Thumbs down"
      >
        <ThumbsDownIcon
          className="h-4 w-4.5"
          style={iconSize ? { width: iconSize, height: iconSize } : undefined}
          disliked={feedback === 'disliked'}
          fill={downFill}
        />
      </button>
    </div>
  )
}
