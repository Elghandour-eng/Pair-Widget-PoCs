import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { getInitials } from '@/utils/string-utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'

function WidgetAvatar() {
  const { widgetConfig } = useWidgetConfigContext()
  return (
    <Avatar>
      <AvatarImage src={widgetConfig.avatarUrl} alt="website avatar" />
      <AvatarFallback className="bg-[#e1e9ff] text-sm font-medium text-[#3a5bc7]">
        {getInitials(widgetConfig.name)}
      </AvatarFallback>
    </Avatar>
  )
}
export { WidgetAvatar }
