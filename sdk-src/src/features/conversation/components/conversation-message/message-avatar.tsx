import { WidgetAvatar } from '@/components/widget-avatar'

interface MessageAvatarProps {
  show: boolean
}

function MessageAvatar({ show }: MessageAvatarProps) {
  if (!show) {
    return null
  }

  return (
    <div className="mt-1 flex shrink-0">
      <WidgetAvatar />
    </div>
  )
}

export { MessageAvatar }
