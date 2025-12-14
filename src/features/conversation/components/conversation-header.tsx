import { Button } from '@/components/ui/button'
import { WidgetAvatar } from '@/components/widget-avatar'
import { WidgetCloseBtn } from '@/components/widget-close-btn'
import { WidgetHeader } from '@/components/widget-header'
import { REPLY_TIME_MAP } from '@/constants/reply-time'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { ChevronLeft } from 'lucide-react'

interface ConversationHeaderProps {
  isHostOnline?: boolean
}

function ConversationHeader({ isHostOnline = true }: ConversationHeaderProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const { navigateToWelcome } = useWidgetNavigation()
  const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time || 'in_a_few_hours']

  const handleBack = () => {
    navigateToWelcome()
  }

  return (
    <WidgetHeader className="flex-row items-center gap-2 ps-2 pt-5 pb-5 shadow-xs">
      <Button variant="ghost" size="icon-sm" onClick={handleBack}>
        <ChevronLeft className="size-5" />
      </Button>
      <div className="flex items-center gap-2">
        <WidgetAvatar />

        <div>
          <div className="flex gap-1">
            <h1 className="leading-none font-medium">{widgetConfig.name}</h1>
            {/* Green circle */}
            {isHostOnline && <div className="size-1.5 rounded-full bg-green-500" />}
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

export { ConversationHeader }
