import { Button } from '@/components/ui/button'
import { WidgetAvatar } from '@/components/widget-avatar'
import { WidgetCloseBtn } from '@/components/widget-close-btn'
import { WidgetHeader } from '@/components/widget-header'
import { REPLY_TIME_MAP } from '@/constants/reply-time'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { ChevronLeft } from 'lucide-react'

function PreChatHeader() {
  const { widgetConfig } = useWidgetConfigContext()
  const { navigateToWelcome } = useWidgetNavigation()
  const isHostOnline = true
  const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time]

  return (
    // Add shadow bottom
    <WidgetHeader className="flex-row items-center gap-2 ps-2 pt-5 pb-1 shadow-xs">
      <Button variant="ghost" size="icon-sm" onClick={navigateToWelcome}>
        <ChevronLeft className="size-7" />
      </Button>
      <div className="flex items-center gap-2">
        <WidgetAvatar />

        <div>
          <div className="flex items-center gap-1">
            <h1 className="leading-none font-medium">{widgetConfig.name}</h1>
            {/* Green circle */}
            {isHostOnline && <div className="size-2 rounded-full bg-green-500" />}
          </div>
          <span className="text-muted-foreground text-xs leading-none">
            {isHostOnline ? replyTimeText : 'We will be back as soon as possible'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 justify-end self-start">
        <WidgetCloseBtn />
      </div>
    </WidgetHeader>
  )
}
export { PreChatHeader }
