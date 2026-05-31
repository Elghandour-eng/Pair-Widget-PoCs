import { BackIcon } from '@/components/icons/back-icon'
import { Button } from '@/components/ui/button'
import { WidgetAvatar } from '@/components/widget-avatar'
import { WidgetCloseBtn } from '@/components/widget-close-btn'
import { WidgetHeader } from '@/components/widget-header'
import { REPLY_TIME_MAP } from '@/constants/reply-time'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'

interface ConversationHeaderProps {
  isHostOnline?: boolean
}

function ConversationHeader({ isHostOnline = true }: ConversationHeaderProps) {
  const { widgetConfig } = useWidgetConfigContext()
  const { navigateToIntro } = useWidgetNavigation()
  const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time || 'in_a_few_hours']

  const handleBack = () => {
    navigateToIntro()
  }

  return (
    <WidgetHeader className="flex-row items-center gap-2 ps-2 pt-5 pb-5 shadow-xs">
      <Button variant="ghost" size="icon-sm" onClick={handleBack}>
        <BackIcon className="h-3 w-auto" />
      </Button>
      <div className="flex items-center gap-2">
        <WidgetAvatar showIconFallback={true} />

        <div>
          <div className="flex items-center gap-1">
            <h1 className="align-middle text-[20px] leading-[130%] font-medium tracking-[0%] text-[#1E1E1E]">
              {widgetConfig.name}
            </h1>
            {/* Green circle */}
            {isHostOnline && <div className="size-1.5 rounded-full bg-[#3AA36B]" />}
          </div>
          <span className="text-[16px] leading-[150%] font-normal tracking-[0%] text-[#85888E]">
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
