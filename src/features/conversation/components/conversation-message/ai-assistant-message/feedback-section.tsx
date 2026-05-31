import { ThumbsDownIcon } from '@/components/icons/thumbs-down-icon'
import { ThumbsUpIcon } from '@/components/icons/thumbs-up-icon'
import { useState } from 'react'
import { toast } from 'sonner'

interface FeedbackSectionProps {
  messageId: string
}

export function FeedbackSection({ messageId }: FeedbackSectionProps) {
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null)

  const handleLike = () => {
    const next = feedback === 'liked' ? null : 'liked'
    setFeedback(next)
    if (next === 'liked') {
      toast.success('Thanks for your feedback')
    }
    console.log('Thumbs up clicked for message:', messageId)
  }

  const handleDislike = () => {
    const next = feedback === 'disliked' ? null : 'disliked'
    setFeedback(next)
    if (next === 'disliked') {
      toast.success('Thanks for your feedback')
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
        <ThumbsUpIcon className="h-4 w-4.5" liked={feedback === 'liked'} />
      </button>
      <button
        onClick={handleDislike}
        className="cursor-pointer rounded p-1 transition-colors hover:bg-black/5 focus:outline-none"
        aria-label="Thumbs down"
      >
        <ThumbsDownIcon className="h-4 w-4.5" disliked={feedback === 'disliked'} />
      </button>
    </div>
  )
}
