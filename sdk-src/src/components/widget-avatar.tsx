import { BubbleChatIcon } from '@/components/icons/bubble-chat-icon'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
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
  // The fallback mark is white, which vanishes on a light icon background
  // (the light theme sets one); it turns dark there.
  const bg = typeof style?.backgroundColor === 'string' ? style.backgroundColor : undefined
  const markClass = bg && /^#[0-9a-f]{6}$/i.test(bg) && !isDarkBackground(bg) ? 'text-[#1E1E1E]' : 'text-white'

  return showIconFallback ? (
    <Avatar className="h-12.5 w-12.5 rounded-2xl" style={style}>
      <AvatarImage src={useURL ? widgetConfig.avatarUrl : undefined} alt="website avatar" />
      <AvatarFallback
        className="flex size-full items-center justify-center rounded-[inherit] bg-[#4D98E2] text-sm font-medium text-white"
        style={bgStyle}
      >
        <BubbleChatIcon className={markClass} />
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
