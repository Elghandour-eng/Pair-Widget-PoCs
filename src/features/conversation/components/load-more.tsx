import { Spinner } from '@/components/ui/spinner'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { isDarkBackground } from '@/lib/utils'
import { localizeDefault } from '@/lib/ui-strings'

function LoadMore() {
  const { widgetConfig } = useWidgetConfigContext()
  const design = widgetConfig.messagesConfig?.loadingOlder
  const dark = isDarkBackground(widgetConfig.widgetBgColor)
  const text = localizeDefault(widgetConfig.locale, design?.text, 'loadingOlder')

  return (
    // pointer-events-none: the pill floats over the list; wheel and touch
    // scrolling must keep reaching the messages underneath it.
    <div className="from-background/95 pointer-events-none absolute top-0 right-0 left-0 z-10 flex items-center justify-center bg-linear-to-b to-transparent py-3 backdrop-blur-[0.5px] transition-opacity duration-200">
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2 shadow-sm"
        style={{ background: design?.background ?? (dark ? 'rgba(28,28,30,.85)' : 'rgba(255,255,255,.85)') }}
      >
        <Spinner className="size-4" style={{ color: design?.spinnerColor ?? widgetConfig.primaryColor }} />
        <span className="text-xs" style={{ color: design?.textColor ?? (dark ? '#A1A1A6' : '#5E5E63') }}>
          {text}
        </span>
      </div>
    </div>
  )
}

export { LoadMore }
