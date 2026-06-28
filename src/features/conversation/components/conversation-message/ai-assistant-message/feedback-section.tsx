import { ThumbsDownIcon } from '@/components/icons/thumbs-down-icon'
import { ThumbsUpIcon } from '@/components/icons/thumbs-up-icon'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { useMessageFeedback } from '@/features/conversation/hooks/use-message-feedback'

interface FeedbackSectionProps {
  messageId: string
  initialFeedback?: 'liked' | 'disliked' | null
}

const getInactiveColor = (color: string) => {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}66` // 40% opacity
  }
  return color
}

export function FeedbackSection({ messageId, initialFeedback = null }: FeedbackSectionProps) {
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(initialFeedback)
  const { widgetConfig } = useWidgetConfigContext()
  const { conversationId } = useWidgetNavigation()
  const { mutateAsync: submitFeedbackMutation } = useMessageFeedback()

  // Keep state in sync with initialFeedback if it changes
  useEffect(() => {
    setFeedback(initialFeedback)
  }, [initialFeedback])

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

  const handleFeedback = async (nextFeedback: 'liked' | 'disliked') => {
    if (!conversationId) {
      toast.error('Conversation ID is missing')
      return
    }

    // Toggle logic: clicking the active feedback clears it (but API feedback must be set)
    // Here we toggle the UI feedback but send the selected rating to the server.
    // If the user clicks the same rating, we toggle it off in UI (set to null) or keep it.
    // Wait, the API doesn't support "deleting" feedback in the spec, but we can send the opposite or the clicked feedback.
    const next = feedback === nextFeedback ? null : nextFeedback
    setFeedback(next)

    try {
      await submitFeedbackMutation({
        conversationId,
        messageId,
        feedback: nextFeedback,
      })
      if (next === nextFeedback) {
        toast.success(toastMessage)
      }
    } catch (error) {
      // Revert UI state on error
      setFeedback(feedback)
      toast.error('Failed to submit feedback. Please try again.')
    }
  }

  return (
    <div className="mt-1 flex items-center justify-start gap-3 select-none">
      <button
        onClick={() => handleFeedback('liked')}
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
        onClick={() => handleFeedback('disliked')}
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
