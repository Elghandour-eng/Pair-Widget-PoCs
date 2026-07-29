import { BubbleChatIcon } from '@/components/icons/bubble-chat-icon'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { getInitials } from '@/utils/string-utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'

function WidgetAvatar({
  showIconFallback = false,
  useURL = false,
  style,
}: {
  showIconFallback?: boolean
  useURL?: boolean
  style?: React.CSSProperties
}) {
  const { widgetConfig } = useWidgetConfigContext()
  const bgStyle = style?.backgroundColor ? { backgroundColor: style.backgroundColor } : {}

  return showIconFallback ? (
    <Avatar className="h-12.5 w-12.5 rounded-2xl" style={style}>
      <AvatarImage src={useURL ? widgetConfig.avatarUrl : undefined} alt="website avatar" />
      <AvatarFallback
        className="flex size-full items-center justify-center rounded-2xl bg-[#4D98E2] text-sm font-medium text-white"
        style={bgStyle}
      >
        <BubbleChatIcon className="text-white" />
      </AvatarFallback>
    </Avatar>
  ) : (
    <Avatar style={style}>
      <AvatarImage src={widgetConfig.avatarUrl} alt="website avatar" />
      <AvatarFallback
        className="flex size-full items-center justify-center bg-[#e1e9ff] text-sm font-medium text-[#3a5bc7]"
        style={bgStyle}
      >
        {getInitials(widgetConfig.name)}
      </AvatarFallback>
    </Avatar>
  )
}
export { WidgetAvatar }
