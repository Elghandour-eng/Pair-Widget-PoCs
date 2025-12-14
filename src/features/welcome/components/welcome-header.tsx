import { WidgetAvatar } from '@/components/widget-avatar'
import { WidgetCloseBtn } from '@/components/widget-close-btn'
import { WidgetHeader } from '@/components/widget-header'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { parseMarkdown } from '@/lib/parseMarkdown'

function WelcomeHeader() {
  const { widgetConfig } = useWidgetConfigContext()

  return (
    <WidgetHeader className="pt-6">
      {widgetConfig.avatarUrl ? (
        <div className="flex w-full justify-between gap-2">
          <WidgetAvatar />

          <div className="flex flex-1 justify-end">
            <WidgetCloseBtn />
          </div>
        </div>
      ) : (
        <div className="flex w-full justify-between gap-2">
          <div className="flex flex-1 justify-end">
            <WidgetCloseBtn />
          </div>
        </div>
      )}

      {widgetConfig.welcomeTitle && (
        <h1 className="mt-4 mb-1.5 line-clamp-4 text-2xl font-medium text-[#1c2024]">{widgetConfig.welcomeTitle}</h1>
      )}
      {widgetConfig.welcomeTagline && (
        <div className="line-clamp-6 text-lg leading-normal text-[#60646c]">
          {parseMarkdown(widgetConfig.welcomeTagline)}
        </div>
      )}
    </WidgetHeader>
  )
}
export { WelcomeHeader }
