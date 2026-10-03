import { HeaderActionsRow } from '@/components/header-actions-row'
import { HeaderControls } from '@/components/header-controls'
import { BackIcon } from '@/components/icons/back-icon'
import { Button } from '@/components/ui/button'
import { WidgetCloseBtn } from '@/components/widget-close-btn'
import { WidgetHeader } from '@/components/widget-header'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { useWidgetNavigation } from '@/contexts/widget-navigation-context'
import { isDarkBackground } from '@/lib/utils'
// import { useWidgetConfigContext } from '@/contexts/widget-config-context'
// import { REPLY_TIME_MAP } from '@/constants/reply-time'

function PreChatHeader() {
  const { widgetConfig } = useWidgetConfigContext()
  const { navigateToIntro } = useWidgetNavigation()
  // The back chevron follows the theme; ghost hover stays currentColor-based
  // so a dark header never grows a white chip behind it.
  const dark = isDarkBackground(widgetConfig.widgetBgColor)
  // Before the intro the form is the first screen, so there is nowhere to go back to.
  const gate = widgetConfig.requiresPreChat && widgetConfig.preChatPlacement === 'before_intro'
  // const isHostOnline = true
  // const replyTimeText = REPLY_TIME_MAP[widgetConfig.reply_time]

  return (
    // Add shadow bottom
    <WidgetHeader className="flex-row items-center gap-2 py-4 shadow-xs">
      {!gate && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={navigateToIntro}
          className="hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] hover:text-current"
          style={{ color: dark ? '#FFFFFF' : undefined }}
        >
          <BackIcon className="h-5 w-auto" />
        </Button>
      )}
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

      {/* The same language / theme / close row the intro and conversation
          headers carry, so a visitor who lands on the form first can still
          switch language or leave. */}
      <HeaderActionsRow style={{ color: dark ? '#FFFFFF' : undefined }}>
        <HeaderControls />
        <WidgetCloseBtn />
      </HeaderActionsRow>
    </WidgetHeader>
  )
}
export { PreChatHeader }
