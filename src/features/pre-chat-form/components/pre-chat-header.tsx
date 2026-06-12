import { BackIcon } from '@/components/icons/back-icon'
import { Button } from '@/components/ui/button'
import { WidgetHeader } from '@/components/widget-header'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
// import { useWidgetConfigContext } from '@/contexts/widget-config-context'
// import { REPLY_TIME_MAP } from '@/constants/reply-time'

function PreChatHeader() {
  // const { widgetConfig } = useWidgetConfigContext()
  const { navigateToIntro } = useWidgetNavigation()
  // const isHostOnline = true
  // const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time]

  return (
    // Add shadow bottom
    <WidgetHeader className="flex-row items-center gap-2 py-4 shadow-xs">
      <Button variant="ghost" size="icon-sm" onClick={navigateToIntro}>
        <BackIcon className="h-5 w-auto" />
      </Button>
      {/* <div className="flex items-center gap-2">
        <WidgetAvatar />

        <div>
          <div className="flex items-center gap-1">
            <h1 className="align-middle text-[20px] leading-[130%] font-medium tracking-[0%] text-[#1E1E1E]">
              {widgetConfig.name}
            </h1>
            
            {isHostOnline && <div className="size-2 rounded-full bg-green-500" />}
          </div>
          <span className="text-[16px] leading-[150%] font-normal tracking-[0%] text-[#85888E]">
            {isHostOnline ? replyTimeText : 'We will be back as soon as possible'}
          </span>
        </div>
      </div> */}

      {/* <div className="flex flex-1 justify-end self-start">
        <WidgetCloseBtn />
      </div> */}
    </WidgetHeader>
  )
}
export { PreChatHeader }
