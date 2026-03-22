import { BubbleChatIcon } from '@/components/icons/bubble-chat-icon'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { getInitials } from '@/utils/string-utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'

function WidgetAvatar({ showIconFallback = false, useURL = false }: { showIconFallback?: boolean; useURL?: boolean }) {
  const { widgetConfig } = useWidgetConfigContext()
  return showIconFallback ? (
    <Avatar className="h-12.5 w-12.5 rounded-2xl">
      <AvatarImage src={useURL ? widgetConfig.avatarUrl : undefined} alt="website avatar" />
      <AvatarFallback className="flex h-12.5 w-12.5 items-center justify-center gap-2.5 rounded-2xl bg-[#4D98E2] p-3 text-sm font-medium text-white">
        <BubbleChatIcon className="text-white" />
      </AvatarFallback>
    </Avatar>
  ) : (
    <Avatar>
      <AvatarImage src={widgetConfig.avatarUrl} alt="website avatar" />
      <AvatarFallback className="bg-[#e1e9ff] text-sm font-medium text-[#3a5bc7]">
        {getInitials(widgetConfig.name)}
      </AvatarFallback>
    </Avatar>
  )
}
export { WidgetAvatar }
